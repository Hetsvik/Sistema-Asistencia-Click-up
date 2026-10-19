import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { hashPin } from '../lib/security.js';
import { ACCOUNT_TYPES } from '../lib/accounts.js';

const ALL = `SELECT E.ID_Empleado AS id, E.Nombre_Completo AS nombre, E.Correo AS correo, E.Telefono AS telefono,
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
const PUBLIC = 'id,nombre,correo,telefono,estado,rol,codigo';
const role = (v) => { if (!Object.hasOwn(ACCOUNT_TYPES, v)) throw new HttpError(400, 'Rol no válido.'); return v; };
const idOf = (params) => intParam(params.id, { min: 1 });

async function getAccount(db, id) {
  const row = await db.prepare(`SELECT * FROM (${ALL}) WHERE id=?`).bind(id).first();
  if (!row) throw new HttpError(404, 'Usuario no encontrado.');
  return row;
}
async function fields(db, body, id = 0, { creating = false } = {}) {
  const nombre = text(body.nombre, { field: 'Nombres y apellidos', max: 120 });
  const correo = text(body.correo, { field: 'Correo electrónico', max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new HttpError(400, 'Correo electrónico no válido.');
  const telefono = text(body.telefono, { field: 'Teléfono', max: 32, required: false });
  if (telefono && !/^[+\d\s().-]{5,32}$/.test(telefono)) throw new HttpError(400, 'Teléfono no válido.');
  const rol = role(body.rol);
  const pin = body.pin;
  if ((creating || (pin !== undefined && pin !== '')) && (typeof pin !== 'string' || pin.length < 8 || pin.length > 128 || !pin.trim())) {
    throw new HttpError(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
  }
  const existing = await db.prepare('SELECT ID_Empleado FROM Empleados WHERE lower(Correo)=? AND ID_Empleado<>? LIMIT 1').bind(correo,id).first();
  if (existing) throw new HttpError(409, 'Ese correo ya está registrado.');
  return { nombre, correo, telefono, rol, pin: pin || null };
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
  const page = intParam(url.searchParams.get('page'), { min: 1, max: 100000, fallback: 1 });
  const clauses = [], args = [];
  if (q) { clauses.push('(nombre LIKE ? OR codigo LIKE ? OR correo LIKE ?)'); args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (rol) { clauses.push('rol=?'); args.push(rol); }
  if (estado) { clauses.push('estado=?'); args.push(estado); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM (${ALL}) ${where}`).bind(...args).first();
  const pages = Math.max(1,Math.ceil(total.n / 20)), current = Math.min(page,pages);
  const { results } = await env.DB.prepare(`SELECT ${PUBLIC} FROM (${ALL}) ${where} ORDER BY nombre COLLATE NOCASE,id LIMIT 20 OFFSET ?`)
    .bind(...args,(current-1)*20).all();
  const stats = await env.DB.prepare(`SELECT COUNT(*) AS activos,
    COALESCE(SUM(rol='admin'),0) AS administradores, COALESCE(SUM(rol='trabajador'),0) AS trabajadores
    FROM (${ALL}) WHERE estado='Activo'`).first();
  return json({ users: results, total: total.n, page: current, pages, stats });
}
export async function detail({ env, params }) {
  const { pin, ...user } = await getAccount(env.DB,idOf(params));
  return json({ user });
}
export async function create({ env, request }) {
  const f = await fields(env.DB,await readJson(request),0,{creating:true});
  const a = ACCOUNT_TYPES[f.rol];
  const codigo = (f.rol === 'admin' ? 'AD' : 'EM') + crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase();
  const pin = await hashPin(f.pin);
  const insertAccount = f.rol === 'admin'
    ? 'INSERT INTO Administrador(ID_Empleado,Codigo_Administrador,PIN_Acceso,ID_Rol) VALUES(last_insert_rowid(),?,?,2)'
    : "INSERT INTO Trabajadores(ID_Empleado,Codigo_Trabajador,PIN_Acceso,ID_Rol,Rol_Cargo) VALUES(last_insert_rowid(),?,?,1,'Trabajador')";
  const r = await batch(env.DB,[
    env.DB.prepare("INSERT INTO Empleados(Nombre_Completo,Correo,Telefono,Estado) VALUES(?,?,?,'Activo')").bind(f.nombre,f.correo,f.telefono),
    env.DB.prepare(insertAccount).bind(codigo,pin),
    env.DB.prepare(`INSERT INTO Cuentas_Usuario(ID_Empleado,Rol) SELECT ID_Empleado,? FROM ${a.table} WHERE ${a.code}=?`).bind(f.rol,codigo),
  ]);
  return json({ user: { id:r[0].meta.last_row_id, nombre:f.nombre, correo:f.correo, telefono:f.telefono, rol:f.rol, estado:'Activo', codigo } },201);
}
export async function update({ env, params, request, user }) {
  const id=idOf(params), current=await getAccount(env.DB,id);
  const f=await fields(env.DB,await readJson(request),id);
  if (id===user.empleado_id && f.rol!==current.rol) throw new HttpError(409,'No puedes cambiar tu propio rol.');
  const pin=f.pin ? await hashPin(f.pin) : current.pin;
  const invalidate=Boolean(f.pin) || f.rol!==current.rol;
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
  await batch(env.DB,stmts);
  const { pin:secret,...safe }=await getAccount(env.DB,id);
  return json({ user:safe, reauthenticate:id===user.empleado_id && invalidate });
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
