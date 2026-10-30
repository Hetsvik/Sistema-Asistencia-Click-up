import {pagination,pageInfo} from '../lib/pagination.js';
import {attendanceCTE,guardAttendance} from '../lib/attendance-query.js';
import { HttpError, intParam, json } from '../lib/http.js';
import { isDate } from '../lib/dates.js';

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
 if(!plan.configurado&&!plan.fijado)return legacyIn({...ctx,ahora:now});
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
 return json({message:'Entrada registrada.',tz:'America/Lima',...now,tramo:slot.tramo},201);
}
export async function checkOut(ctx){
 const {env,user}=ctx,now=peruNow(),plan=await currentPlan(env.DB,user.empleado_id,user.id,now);
 if(!plan.configurado&&!plan.fijado)return legacyOut({...ctx,ahora:now});
 const open=plan.tramos.find(s=>s.entrada&&!s.salida);if(!open)throw new HttpError(409,'No hay un tramo abierto. Primero marca una entrada.');
 const r=await env.DB.prepare('UPDATE Marcaciones_Tramo SET Salida=? WHERE ID_Trabajador=? AND Fecha=? AND Tramo=? AND Entrada IS NOT NULL AND Salida IS NULL').bind(now.fechaHora,user.id,now.fecha,open.tramo).run();
 if(!r.meta.changes)throw new HttpError(409,'La salida ya se registró.');return json({message:'Salida registrada.',tz:'America/Lima',...now,tramo:open.tramo});
}
async function legacyIn({ env, user, ahora }) {
  if (await todayRecord(env.DB, user.id, ahora.fecha)) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
  try {
    await env.DB.prepare('INSERT INTO Asistencia (ID_Trabajador, Fecha_Entrada) VALUES (?, ?)').bind(user.id, ahora.fechaHora).run();
  } catch (err) {
    if (/UNIQUE/i.test(String(err?.message))) throw new HttpError(409, 'Ya registraste tu entrada hoy.');
    throw err;
  }
  return json({ message: 'Entrada registrada.', tz:'America/Lima',...ahora, registro: await todayRecord(env.DB, user.id, ahora.fecha) }, 201);
}

async function legacyOut({ env, user, ahora }) {
  const res = await env.DB.prepare(
    'UPDATE Asistencia SET Fecha_Salida = ? WHERE ID_Trabajador = ? AND Fecha_Calculada = ? AND Fecha_Salida IS NULL',
  ).bind(ahora.fechaHora, user.id, ahora.fecha).run();
  if (!res.meta?.changes) {
    const existing = await todayRecord(env.DB, user.id, ahora.fecha);
    throw new HttpError(409, existing ? 'Ya registraste tu salida hoy.' : 'Primero debes marcar tu entrada.');
  }
  return json({ message: 'Salida registrada.', tz:'America/Lima',...ahora, registro: await todayRecord(env.DB, user.id, ahora.fecha) });
}

/** Trabajador: solo su historial. Administrador: todos, con filtros ?q=nombre &trabajador=id &desde &hasta */
export async function list({env,user,url}){
 const now=peruNow(),p=url.searchParams,pg=pagination(p,{size:50});
 const start=new Date(now.fecha+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-29);
 const desde=p.get('desde')||start.toISOString().slice(0,10),hasta=p.get('hasta')||now.fecha;
 if(!isDate(desde)||!isDate(hasta)||desde>hasta)throw new HttpError(400,'Intervalo de fechas inválido.');
 if((Date.parse(hasta)-Date.parse(desde))/86400000>365)throw new HttpError(400,'Consulta hasta 366 días por intervalo.');
 const workerId=user.rol==='trabajador'?user.id:intParam(p.get('trabajador'),{min:1}),q=user.rol==='admin'?(p.get('q')||'').trim().slice(0,60):'';
 const query=attendanceCTE({desde,hasta,workerId,q,now});await guardAttendance(env.DB,query);
 const combined=query.sql+`, records AS (
 SELECT a.ID_Asistencia id,a.ID_Trabajador trabajador_id,W.nombre,a.Fecha_Calculada fecha,a.Fecha_Entrada entrada,a.Fecha_Salida salida,a.Estado_Asistencia estado,NULL tramo,0 falta,NULL motivo,'Registro anterior' origen FROM Asistencia a JOIN workers W ON W.trabajador_id=a.ID_Trabajador WHERE a.Fecha_Calculada BETWEEN ? AND ?
 UNION ALL SELECT NULL,trabajador_id,nombre,fecha,entrada,salida,CASE WHEN salida IS NOT NULL THEN 'Finalizado' WHEN entrada IS NOT NULL THEN CASE WHEN falta THEN 'Presente · falta' ELSE 'Presente' END ELSE 'Falta · sin entrada' END,tramo,falta,CASE WHEN falta THEN CASE WHEN entrada IS NULL THEN 'Sin entrada tras tolerancia' ELSE 'Entrada fuera de tolerancia' END END,'Horario laboral' FROM evaluated WHERE evaluado OR entrada IS NOT NULL)
 `;
 const args=[...query.args,desde,hasta];
 const {n}=await env.DB.prepare(combined+'SELECT COUNT(*) n FROM records').bind(...args).first();
 const meta=pageInfo(n,pg);
 // Compatibilidad de offset: se admite, pero la UI utiliza page y tamaños acotados.
 const offset=p.has('offset')?pg.offset:meta.offset;
 const {results}=await env.DB.prepare(combined+'SELECT * FROM records ORDER BY fecha DESC,trabajador_id ASC,tramo DESC,id DESC LIMIT ? OFFSET ?').bind(...args,pg.limit,offset).all();
 return json({tz:'America/Lima',...now,records:results,...meta,offset,desde,hasta});
}

/** Lista diaria de todos los trabajadores activos, incluso sin entrada. */
export async function daily({env,url}){
 const pg=pagination(url.searchParams,{size:20,max:50}),now=peruNow(),q=(url.searchParams.get('q')||'').trim().slice(0,60);
 const from=`FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador' ${q?'AND E.Nombre_Completo LIKE ?':''}`;
 const args=q?[`%${q}%`]:[];
 const total=(await env.DB.prepare('SELECT COUNT(*) n '+from).bind(...args).first()).n,pages=Math.max(1,Math.ceil(total/pg.limit)),page=Math.min(pg.page,pages);
 const {results:workers}=await env.DB.prepare('SELECT T.ID_Trabajador id,T.ID_Empleado empleado_id,E.Nombre_Completo nombre '+from+' ORDER BY E.Nombre_Completo,T.ID_Trabajador LIMIT ? OFFSET ?').bind(...args,pg.limit,(page-1)*pg.limit).all();
 if(!workers.length)return json({...now,tz:'America/Lima',workers:[],total,page,pages,limit:pg.limit,has_more:page<pages});
 const vs=await schedules(env.DB,workers.map(w=>w.empleado_id),now.fecha);
 const ids=workers.map(w=>w.id),ph=ids.map(()=>'?').join(',');
 const {results:marks}=await env.DB.prepare(`SELECT ID_Trabajador trabajador_id,Tramo tramo,Inicio_Previsto inicio,Fin_Previsto fin,Entrada entrada,Salida salida FROM Marcaciones_Tramo WHERE Fecha=? AND ID_Trabajador IN (${ph})`).bind(now.fecha,...ids).all();
 const {results:old}=await env.DB.prepare(SELECT+` WHERE a.Fecha_Calculada=? AND a.ID_Trabajador IN (${ph})`).bind(now.fecha,...ids).all();
 const rows=workers.map(w=>{const p=planFor(vs,w.empleado_id,now.fecha),saved=marks.filter(m=>m.trabajador_id===w.id),slots=mergeSlots(p.tramos,saved);const legacy=old.find(r=>r.trabajador_id===w.id);
  const tramos=slots.map(s=>({...s,...classifySlot(s,now.fecha,now.fechaHora)}));
  const estado=tramos.length?(tramos.some(s=>s.entrada&&!s.salida)?'Presente':tramos.every(s=>s.salida)?'Jornada finalizada':tramos.some(s=>s.falta)?'Falta registrada':'Pendiente'):(legacy?(legacy.salida?'Jornada finalizada':'Presente'):p.configurado?'Descanso':'Sin horario / sin marcar');
  return {...w,estado,tramos,registro_anterior:legacy||null,faltas:tramos.filter(s=>s.falta).length};});
 return json({...now,tz:'America/Lima',workers:rows,total,page,pages,limit:pg.limit,has_more:page<pages});
}
