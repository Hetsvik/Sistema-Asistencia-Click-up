import { HttpError, intParam, json } from '../lib/http.js';
import { isDate, nowLocal } from '../lib/dates.js';

import { currentPlan, classifySlot, peruNow, schedules, planFor, punctuality, mergeSlots } from '../lib/attendance-policy.js';

const SELECT = `
  SELECT a.ID_Asistencia AS id, a.ID_Trabajador AS trabajador_id, e.Nombre_Completo AS nombre,
         a.Fecha_Calculada AS fecha, a.Fecha_Entrada AS entrada, a.Fecha_Salida AS salida,
         a.Estado_Asistencia AS estado
  FROM Asistencia a
  JOIN Trabajadores t ON t.ID_Trabajador = a.ID_Trabajador
  JOIN Empleados e ON e.ID_Empleado = t.ID_Empleado`;

const todayRecord = (db, id, fecha) =>
  db.prepare(`${SELECT} WHERE a.ID_Trabajador = ? AND a.Fecha_Calculada = ?`).bind(id, fecha).first();

export async function today({env,user}){
 const now=peruNow(),plan=await currentPlan(env.DB,user.empleado_id,user.id,now);
 return json({tz:'America/Lima',...now,registro:await todayRecord(env.DB,user.id,now.fecha),plan:{...plan,tramos:plan.tramos.map(s=>({...s,...classifySlot(s,now.fecha,now.fechaHora)}))}});
}
export async function checkIn(ctx){
 const {env,user,url}=ctx,now=peruNow(),plan=await currentPlan(env.DB,user.empleado_id,user.id,now);
 if(!plan.configurado&&!plan.fijado)return legacyIn({...ctx,tz:'America/Lima'});
 if(!plan.tramos.length)throw new HttpError(409,'Hoy es día de descanso según tu horario.');
 if(plan.tramos.some(s=>s.entrada&&!s.salida))throw new HttpError(409,'Marca primero la salida del tramo abierto.');
 const requested=intParam(url.searchParams.get('tramo'),{min:1,max:2});
 const slot=requested?plan.tramos.find(s=>s.tramo===requested):plan.tramos.find((s,i)=>!s.entrada&&now.hora<s.fin+':00'&&(i===0||now.hora>=plan.tramos[i-1].fin+':00'));
 if(!slot)throw new HttpError(409,'No hay un tramo disponible para marcar entrada en este momento.');
 const i=slot.tramo-1;
 if(slot.entrada)throw new HttpError(409,'La entrada de este tramo ya está registrada.');
 if(now.hora>=slot.fin+':00'||(i>0&&now.hora<plan.tramos[i-1].fin+':00'))throw new HttpError(409,'La entrada no corresponde a la ventana de este tramo.');
 const stmts=plan.tramos.map(s=>env.DB.prepare('INSERT OR IGNORE INTO Marcaciones_Tramo(ID_Trabajador,Fecha,Tramo,Inicio_Previsto,Fin_Previsto) VALUES(?,?,?,?,?)').bind(user.id,now.fecha,s.tramo,s.inicio,s.fin));
 stmts.push(env.DB.prepare('UPDATE Marcaciones_Tramo SET Entrada=? WHERE ID_Trabajador=? AND Fecha=? AND Tramo=? AND Entrada IS NULL AND NOT EXISTS(SELECT 1 FROM Marcaciones_Tramo M WHERE M.ID_Trabajador=? AND M.Fecha=? AND M.Entrada IS NOT NULL AND M.Salida IS NULL)').bind(now.fechaHora,user.id,now.fecha,slot.tramo,user.id,now.fecha));
 const result=await env.DB.batch(stmts);if(!result.at(-1).meta.changes)throw new HttpError(409,'La entrada ya se registró. Actualiza la asistencia.');
 return json({message:'Entrada registrada.',tramo:slot.tramo},201);
}
export async function checkOut(ctx){
 const {env,user}=ctx,now=peruNow(),plan=await currentPlan(env.DB,user.empleado_id,user.id,now);
 if(!plan.configurado&&!plan.fijado)return legacyOut({...ctx,tz:'America/Lima'});
 const open=plan.tramos.find(s=>s.entrada&&!s.salida);if(!open)throw new HttpError(409,'No hay un tramo abierto. Primero marca una entrada.');
 const r=await env.DB.prepare('UPDATE Marcaciones_Tramo SET Salida=? WHERE ID_Trabajador=? AND Fecha=? AND Tramo=? AND Entrada IS NOT NULL AND Salida IS NULL').bind(now.fechaHora,user.id,now.fecha,open.tramo).run();
 if(!r.meta.changes)throw new HttpError(409,'La salida ya se registró.');return json({message:'Salida registrada.',tramo:open.tramo});
}
async function legacyIn({ env, user, tz }) {
  const ahora = nowLocal(tz);
  if (await todayRecord(env.DB, user.id, ahora.fecha)) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
  try {
    await env.DB.prepare('INSERT INTO Asistencia (ID_Trabajador, Fecha_Entrada) VALUES (?, ?)').bind(user.id, ahora.fechaHora).run();
  } catch (err) {
    if (/UNIQUE/i.test(String(err?.message))) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
    throw err;
  }
  return json({ message: 'Entrada registrada.', registro: await todayRecord(env.DB, user.id, ahora.fecha) }, 201);
}

async function legacyOut({ env, user, tz }) {
  const ahora = nowLocal(tz);
  const res = await env.DB.prepare(
    'UPDATE Asistencia SET Fecha_Salida = ? WHERE ID_Trabajador = ? AND Fecha_Calculada = ? AND Fecha_Salida IS NULL',
  ).bind(ahora.fechaHora, user.id, ahora.fecha).run();
  if (!res.meta?.changes) {
    const existing = await todayRecord(env.DB, user.id, ahora.fecha);
    throw new HttpError(409, existing ? 'Ya registraste tu salida hoy.' : 'Primero debes marcar tu entrada.');
  }
  return json({ message: 'Salida registrada.', registro: await todayRecord(env.DB, user.id, ahora.fecha) });
}

/** Trabajador: solo su historial. Administrador: todos, con filtros ?q=nombre &trabajador=id &desde &hasta */
export async function list({ env, user, url }) {
  const p = url.searchParams;
  const where = [];
  const binds = [];

  if (user.rol === 'trabajador') {
    where.push('a.ID_Trabajador = ?'); binds.push(user.id);
  } else {
    const trabajador = intParam(p.get('trabajador'), { min: 1 });
    if (trabajador) { where.push('a.ID_Trabajador = ?'); binds.push(trabajador); }
    const q = (p.get('q') ?? '').trim().slice(0, 60);
    if (q) { where.push('e.Nombre_Completo LIKE ?'); binds.push(`%${q}%`); }
  }
  for (const [name, op] of [['desde', '>='], ['hasta', '<=']]) {
    const v = p.get(name);
    if (v) {
      if (!isDate(v)) throw new HttpError(400, `La fecha "${name}" no es válida (AAAA-MM-DD).`);
      where.push(`a.Fecha_Calculada ${op} ?`); binds.push(v);
    }
  }
  const limit = intParam(p.get('limit'), { min: 1, max: 200, fallback: 50 });
  const offset = intParam(p.get('offset'), { min: 0, max:10000, fallback: 0 });
  const sql = `${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY a.Fecha_Entrada DESC LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(sql).bind(...binds, limit+offset, 0).all();
  const worker=user.rol==='trabajador'?user.id:intParam(p.get('trabajador'),{min:1});
  const modern=await punctuality(env.DB,{desde:p.get('desde')||'0000-01-01',hasta:p.get('hasta')||peruNow().fecha,workerId:worker,q:user.rol==='admin'?(p.get('q')||'').trim().slice(0,60):''});
  const records=[...results.map(r=>({...r,tramo:null,origen:'Registro anterior'})),...modern.detalle.filter(r=>r.evaluado||r.entrada).map(r=>({...r,origen:'Horario laboral'}))].sort((a,b)=>b.fecha.localeCompare(a.fecha)||(b.tramo||0)-(a.tramo||0)).slice(offset,offset+limit);
  return json({records,limit,offset});
}

/** Lista diaria de todos los trabajadores activos, incluso sin entrada. */
export async function daily({env,url}){
 const now=peruNow(),q=(url.searchParams.get('q')||'').trim().slice(0,60);
 const from=`FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador' ${q?'AND E.Nombre_Completo LIKE ?':''}`;
 const args=q?[`%${q}%`]:[];
 const total=(await env.DB.prepare('SELECT COUNT(*) n '+from).bind(...args).first()).n,pages=Math.max(1,Math.ceil(total/50)),page=Math.min(intParam(url.searchParams.get('page'),{min:1,fallback:1}),pages);
 const {results:workers}=await env.DB.prepare('SELECT T.ID_Trabajador id,T.ID_Empleado empleado_id,E.Nombre_Completo nombre '+from+' ORDER BY E.Nombre_Completo,T.ID_Trabajador LIMIT 50 OFFSET ?').bind(...args,(page-1)*50).all();
 if(!workers.length)return json({fecha:now.fecha,tz:'America/Lima',workers:[],total,page,pages});
 const vs=await schedules(env.DB,workers.map(w=>w.empleado_id));
 const ids=workers.map(w=>w.id),ph=ids.map(()=>'?').join(',');
 const {results:marks}=await env.DB.prepare(`SELECT ID_Trabajador trabajador_id,Tramo tramo,Inicio_Previsto inicio,Fin_Previsto fin,Entrada entrada,Salida salida FROM Marcaciones_Tramo WHERE Fecha=? AND ID_Trabajador IN (${ph})`).bind(now.fecha,...ids).all();
 const {results:old}=await env.DB.prepare(SELECT+` WHERE a.Fecha_Calculada=? AND a.ID_Trabajador IN (${ph})`).bind(now.fecha,...ids).all();
 const rows=workers.map(w=>{const p=planFor(vs,w.empleado_id,now.fecha),saved=marks.filter(m=>m.trabajador_id===w.id),slots=mergeSlots(p.tramos,saved);const legacy=old.find(r=>r.trabajador_id===w.id);
  const tramos=slots.map(s=>({...s,...classifySlot(s,now.fecha,now.fechaHora)}));
  const estado=tramos.length?(tramos.some(s=>s.entrada&&!s.salida)?'Presente':tramos.every(s=>s.salida)?'Jornada finalizada':tramos.some(s=>s.falta)?'Falta registrada':'Pendiente'):(legacy?(legacy.salida?'Jornada finalizada':'Presente'):p.configurado?'Descanso':'Sin horario / sin marcar');
  return {...w,estado,tramos,registro_anterior:legacy||null,faltas:tramos.filter(s=>s.falta).length};});
 return json({fecha:now.fecha,tz:'America/Lima',workers:rows,total,page,pages});
}