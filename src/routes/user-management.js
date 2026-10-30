import {pagination} from '../lib/pagination.js';
import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { hashPin } from '../lib/security.js';
import { ACCOUNT_TYPES } from '../lib/accounts.js';
import { validateSchedule, readSchedule, scheduleStatement } from '../lib/work-schedule.js';
import { identityFields,corporateEmail } from '../lib/identity.js';
import { nowLocal } from '../lib/dates.js';

const ALL_BASE = `SELECT E.ID_Empleado AS id, E.Nombre_Completo AS nombre, E.Correo AS correo, E.Telefono AS telefono,
 E.Estado AS estado, 'admin' AS rol, A.Codigo_Administrador AS codigo, A.PIN_Acceso AS pin
 FROM Empleados E JOIN Administrador A ON A.ID_Empleado=E.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE COALESCE(C.Rol,'admin')='admin'
 UNION ALL
 SELECT E.ID_Empleado AS id, E.Nombre_Completo AS nombre, E.Correo AS correo, E.Telefono AS telefono,
 E.Estado AS estado, 'trabajador' AS rol, T.Codigo_Trabajador AS codigo, T.PIN_Acceso AS pin
 FROM Empleados E JOIN Trabajadores T ON T.ID_Empleado=E.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 WHERE COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador A WHERE A.ID_Empleado=E.ID_Empleado)
 THEN 'admin' ELSE 'trabajador' END)='trabajador'`;
const ALL=`SELECT B.*,I.Nombres AS nombres,I.Apellido_Paterno AS apellido_paterno,I.Apellido_Materno AS apellido_materno,I.Correo_Personal AS correo_personal,I.Correo_Corporativo AS correo_corporativo,I.Revisar_Nombre AS revisar_nombre,I.Requiere_Clave AS requiere_clave FROM (${ALL_BASE}) B LEFT JOIN Identidad_Usuario I ON I.ID_Empleado=B.id`;
const PUBLIC = 'id,nombre,correo,telefono,estado,rol,codigo,nombres,apellido_paterno,apellido_materno,correo_personal,correo_corporativo,revisar_nombre,requiere_clave';
const role = (v) => { if (!Object.hasOwn(ACCOUNT_TYPES, v)) throw new HttpError(400, 'Rol no válido.'); return v; };
const idOf = (params) => intParam(params.id, { min: 1 });

async function getAccount(db, id) {
  const row = await db.prepare(`SELECT * FROM (${ALL}) WHERE id=?`).bind(id).first();
  if (!row) throw new HttpError(404, 'Usuario no encontrado.');
  return row;
}
async function fields(db, body, id = 0, { creating = false } = {}) {
  const identity=identityFields(body);
  const nombre=identity.full,correo=identity.personal;
  const telefono = text(body.telefono, { field: 'Teléfono', max: 32, required: false });
  if (telefono && !/^[+\d\s().-]{5,32}$/.test(telefono)) throw new HttpError(400, 'Teléfono no válido.');
  const rol = role(body.rol);
  const pin = body.pin;
  if ((creating || (pin !== undefined && pin !== '')) && (typeof pin !== 'string' || pin.length < 8 || pin.length > 128 || !pin.trim())) {
    throw new HttpError(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
  }
  const existing = await db.prepare('SELECT ID_Empleado FROM Empleados WHERE lower(Correo)=? AND ID_Empleado<>? LIMIT 1').bind(correo,id).first();
  if (correo && existing) throw new HttpError(409, 'Ese correo ya está registrado.');
  return { ...identity, nombre, correo, telefono, rol, pin: pin || null, corporate:await corporateEmail(db,identity.names,rol,id) };
}
async function batch(db, stmts) {
  try { return await db.batch(stmts); }
  catch (err) {
    if (String(err).includes('ULTIMO_ADMIN')) throw new HttpError(409, 'Debe quedar al menos un administrador activo.');
    if (String(err).includes('UNIQUE constraint')) throw new HttpError(409, 'La cuenta ya existe. Actualiza la lista e inténtalo otra vez.');
    throw err;
  }
}

export async function list({ env, url }) {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0,120);
  const rol = url.searchParams.get('rol') || '';
  const estado = url.searchParams.get('estado') || '';
  if (rol) role(rol);
  if (estado && !['Activo','Inactivo'].includes(estado)) throw new HttpError(400, 'Estado no válido.');
  const {page,limit}=pagination(url.searchParams);
  const clauses = [], args = [];
  if (q) { clauses.push('(nombre LIKE ? OR codigo LIKE ? OR correo_corporativo LIKE ?)'); args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (rol) { clauses.push('rol=?'); args.push(rol); }
  if (estado) { clauses.push('estado=?'); args.push(estado); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${ALL}) ${where}`).bind(...args).first();
  const pages = Math.max(1,Math.ceil(total.n / limit)), current = Math.min(page,pages);
  const { results } = await env.DB.prepare(`SELECT ${PUBLIC} FROM (${ALL}) ${where} ORDER BY nombre COLLATE NOCASE,id LIMIT ? OFFSET ?`)
    .bind(...args,limit,(current-1)*limit).all();
  const stats = await env.DB.prepare(`SELECT COUNT(*) AS activos,
    COALESCE(SUM(rol='admin'),0) AS administradores, COALESCE(SUM(rol='trabajador'),0) AS trabajadores
    FROM (${ALL}) WHERE estado='Activo'`).first();
  return json({ users: results, total: total.n, page: current, pages, limit, has_more:current<pages, stats });
}
export async function detail({ env, params }) {
  const { pin, ...user } = await getAccount(env.DB,idOf(params));
  return json({ user: { ...user, horario: await readSchedule(env.DB,user.id), zona_horaria: 'America/Lima' } });
}
export async function create({ env, request }) {
  const body=await readJson(request);
  const horario=Object.hasOwn(body,'horario')?validateSchedule(body.horario):null;
  const f = await fields(env.DB,body,0,{creating:true});
  const a = ACCOUNT_TYPES[f.rol];
  const codigo = (f.rol === 'admin' ? 'AD' : 'EM') + crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  const pin = await hashPin(f.pin);
  const insertAccount = f.rol === 'admin'
    ? 'INSERT INTO Administrador(ID_Empleado,Codigo_Administrador,PIN_Acceso,ID_Rol) VALUES(last_insert_rowid(),?,?,2)'
    : "INSERT INTO Trabajadores(ID_Empleado,Codigo_Trabajador,PIN_Acceso,ID_Rol,Rol_Cargo) VALUES(last_insert_rowid(),?,?,1,'Trabajador')";
  const stmts=[
    env.DB.prepare("INSERT INTO Empleados(Nombre_Completo,Correo,Telefono,Estado) VALUES(?,?,?,'Activo')").bind(f.nombre,f.correo,f.telefono),
    env.DB.prepare(insertAccount).bind(codigo,pin),
    env.DB.prepare(`INSERT INTO Cuentas_Usuario(ID_Empleado,Rol) SELECT ID_Empleado,? FROM ${a.table} WHERE ${a.code}=?`).bind(f.rol,codigo),
  ];
  if(horario!==null)stmts.push(env.DB.prepare(`INSERT INTO Horarios_Laborales(ID_Empleado,Horario_JSON,Actualizado_En)
    SELECT ID_Empleado,?,? FROM ${a.table} WHERE ${a.code}=?`).bind(JSON.stringify(horario),nowLocal('America/Lima').fechaHora,codigo));
  stmts.push(env.DB.prepare(`INSERT INTO Identidad_Usuario(ID_Empleado,Nombres,Apellido_Paterno,Apellido_Materno,Correo_Personal,Correo_Corporativo) SELECT ID_Empleado,?,?,?,?,? FROM ${a.table} WHERE ${a.code}=?`).bind(f.names,f.paternal,f.maternal,f.personal,f.corporate,codigo));
  const r=await batch(env.DB,stmts);
  return json({ user: { horario, zona_horaria:'America/Lima', id:r[0].meta.last_row_id, correo_corporativo:f.corporate,nombres:f.names,apellido_paterno:f.paternal,apellido_materno:f.maternal,correo_personal:f.personal, nombre:f.nombre, correo:f.correo, telefono:f.telefono, rol:f.rol, estado:'Activo', codigo } },201);
}
export async function update({ env, params, request, user }) {
  const id=idOf(params), current=await getAccount(env.DB,id);
  const body=await readJson(request);
  const horario=Object.hasOwn(body,'horario')?validateSchedule(body.horario):undefined;
  const f=await fields(env.DB,body,id);
  if (id===user.empleado_id && f.rol!==current.rol) throw new HttpError(409,'No puedes cambiar tu propio rol.');
  const pin=f.pin ? await hashPin(f.pin) : current.pin;
  const invalidate=Boolean(f.pin) || f.rol!==current.rol || f.corporate!==current.correo_corporativo;
  const stmts=[
    env.DB.prepare('UPDATE Empleados SET Nombre_Completo=?,Correo=?,Telefono=? WHERE ID_Empleado=?').bind(f.nombre,f.correo,f.telefono,id),
    env.DB.prepare('INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol) VALUES(?,?)').bind(id,current.rol),
    env.DB.prepare('UPDATE Cuentas_Usuario SET Rol=?,Version_Sesion=Version_Sesion+? WHERE ID_Empleado=?').bind(f.rol,invalidate?1:0,id),
  ];
  if (f.rol==='admin') {
    stmts.push(env.DB.prepare(`INSERT INTO Administrador(ID_Empleado,Codigo_Administrador,PIN_Acceso,ID_Rol)
      SELECT ?,?,?,2 WHERE NOT EXISTS(SELECT 1 FROM Administrador WHERE ID_Empleado=?)`).bind(id,current.codigo,pin,id));
  } else {
    stmts.push(env.DB.prepare(`INSERT INTO Trabajadores(ID_Empleado,Codigo_Trabajador,PIN_Acceso,ID_Rol,Rol_Cargo)
      SELECT ?,?,?,1,'Trabajador' WHERE NOT EXISTS(SELECT 1 FROM Trabajadores WHERE ID_Empleado=?)`).bind(id,current.codigo,pin,id));
  }
  // Mantiene el código de acceso al cambiar de rol. Las filas históricas no se eliminan.
  for (const a of Object.values(ACCOUNT_TYPES)) {
    stmts.push(env.DB.prepare(`UPDATE ${a.table} SET ${a.code}=?,PIN_Acceso=? WHERE ID_Empleado=?`).bind(current.codigo,pin,id));
  }
  if(horario!==undefined)stmts.push(scheduleStatement(env.DB,id,horario,nowLocal('America/Lima').fechaHora));
  stmts.push(env.DB.prepare(`UPDATE Identidad_Usuario SET Nombres=?,Apellido_Paterno=?,Apellido_Materno=?,Correo_Personal=?,Correo_Corporativo=?,Revisar_Nombre=0,Requiere_Clave=CASE WHEN ? THEN 0 ELSE Requiere_Clave END WHERE ID_Empleado=?`).bind(f.names,f.paternal,f.maternal,f.personal,f.corporate,f.pin?1:0,id));
  await batch(env.DB,stmts);
  const { pin:secret,...safe }=await getAccount(env.DB,id);
  return json({ user:{...safe,horario:await readSchedule(env.DB,id),zona_horaria:'America/Lima'}, reauthenticate:id===user.empleado_id && invalidate });
}
export async function setStatus({ env,params,request,user }) {
  const id=idOf(params),current=await getAccount(env.DB,id);
  const {estado}=await readJson(request);
  if (!['Activo','Inactivo'].includes(estado)) throw new HttpError(400,'Estado no válido.');
  if (id===user.empleado_id && estado==='Inactivo') throw new HttpError(409,'No puedes desactivar tu propia cuenta.');
  if (current.estado===estado) return json({ok:true});
  await batch(env.DB,[
    env.DB.prepare('UPDATE Empleados SET Estado=? WHERE ID_Empleado=?').bind(estado,id),
    env.DB.prepare('INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol) VALUES(?,?)').bind(id,current.rol),
    env.DB.prepare('UPDATE Cuentas_Usuario SET Version_Sesion=Version_Sesion+1 WHERE ID_Empleado=?').bind(id),
  ]);
  return json({ok:true});
}
