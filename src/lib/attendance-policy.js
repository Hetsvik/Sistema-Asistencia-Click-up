import {nowLocal,toMs} from './dates.js';
import {HttpError} from './http.js';
export const TOLERANCE_MINUTES=10;
export const peruNow=()=>nowLocal('America/Lima');
const dateOf=ms=>new Date(ms).toISOString().slice(0,10);
export function classifySlot(s,fecha,now){
 const start=toMs(`${fecha} ${s.inicio}:00`),deadline=start+600000;
 const entered=s.entrada?toMs(s.entrada):null;
 const falta=entered!==null?entered>deadline:toMs(now)>deadline;
 return {evaluado:entered!==null||toMs(now)>deadline,puntual:entered!==null&&entered<=deadline,falta,
  motivo:falta?(entered!==null?'Entrada fuera de tolerancia':'Sin entrada tras tolerancia'):null,
  estado:s.salida?'Finalizado':s.entrada?(falta?'Presente · falta':'Presente'):falta?'Falta · sin entrada':toMs(now)<start?'Pendiente':'Dentro de tolerancia'};
}
export async function schedules(db,ids){
 const {results}=await db.prepare(`SELECT V.ID_Empleado empleado_id,V.Desde desde,V.Horario_JSON horario FROM Horarios_Vigencia V ${ids?.length?'WHERE V.ID_Empleado IN ('+ids.map(()=>'?').join(',')+')':''} ORDER BY V.Desde`).bind(...(ids||[])).all();return results.map(v=>({...v,horario:JSON.parse(v.horario)}));
}
export function planFor(versions,id,fecha){
 const v=versions.filter(v=>v.empleado_id===id&&v.desde<=fecha).at(-1);
 if(!v||v.horario===null)return {configurado:false,tramos:[]};
 const dia=(new Date(fecha+'T00:00:00Z').getUTCDay()+6)%7+1;
 return {configurado:true,tramos:(v.horario.find(d=>d.dia===dia)?.tramos||[])};
}
export function mergeSlots(plan,saved){const by=new Map(plan.map((s,i)=>[i+1,{...s,tramo:i+1,entrada:null,salida:null}]));for(const s of saved)by.set(s.tramo,s);return [...by.values()].sort((a,b)=>a.tramo-b.tramo);}
export async function currentPlan(db,employee,worker,now){
 const versions=await schedules(db,[employee]),plan=planFor(versions,employee,now.fecha);
 const {results}=await db.prepare('SELECT Tramo tramo,Inicio_Previsto inicio,Fin_Previsto fin,Entrada entrada,Salida salida FROM Marcaciones_Tramo WHERE ID_Trabajador=? AND Fecha=? ORDER BY Tramo').bind(worker,now.fecha).all();
 return {...plan,tramos:mergeSlots(plan.tramos,results),fijado:results.length>0};
}
/** Calcula solo vigencias conocidas y conserva el plan congelado en cada marcación. */
export async function punctuality(db,{desde,hasta,workerId=null,q='',includeDetails=true,now=peruNow()}){
 const {results:workers}=await db.prepare(`SELECT T.ID_Trabajador id,T.ID_Empleado empleado_id,E.Nombre_Completo nombre FROM Trabajadores T JOIN Empleados E ON E.ID_Empleado=T.ID_Empleado ${workerId?'WHERE T.ID_Trabajador=?':q?'WHERE E.Nombre_Completo LIKE ?':''}`).bind(...(workerId?[workerId]:q?[`%${q}%`]:[])).all();
 if(!workers.length)return {resumen:{evaluados:0,puntuales:0,faltas:0,sin_marca:0,porcentaje:null},detalle:[]};
 const vs=await schedules(db),grouped=new Map();for(const v of vs){if(!grouped.has(v.empleado_id))grouped.set(v.empleado_id,[]);grouped.get(v.empleado_id).push(v);}
 const {results:marks}=await db.prepare(`SELECT ID_Trabajador trabajador_id,Fecha fecha,Tramo tramo,Inicio_Previsto inicio,Fin_Previsto fin,Entrada entrada,Salida salida FROM Marcaciones_Tramo WHERE Fecha BETWEEN ? AND ? ${workerId?'AND ID_Trabajador=?':''}`).bind(desde,hasta,...(workerId?[workerId]:[])).all();
 const by=new Map();for(const m of marks){const k=m.trabajador_id+'|'+m.fecha;if(!by.has(k))by.set(k,[]);by.get(k).push(m);}
 const detalle=[];let count=0,puntuales=0,faltas=0,sin_marca=0;const end=Math.min(toMs(hasta),toMs(now.fecha));
 for(const w of workers){const mine=grouped.get(w.empleado_id)||[];const first=mine[0]?.desde;if(!first)continue;
  const start=Math.max(toMs(desde),toMs(first));
  for(let d=start;d<=end;d+=86400000){const fecha=dateOf(d),plan=planFor(mine,w.empleado_id,fecha);const slots=mergeSlots(plan.tramos,by.get(w.id+'|'+fecha)||[]);
   for(const s of slots){const c=classifySlot(s,fecha,now.fechaHora);if(c.evaluado){count++;if(c.puntual)puntuales++;if(c.falta){faltas++;if(!s.entrada)sin_marca++;}}if(includeDetails){if(detalle.length>=50000)throw new HttpError(413,'Demasiados tramos. Filtra un trabajador o un intervalo de fechas menor.');detalle.push({trabajador_id:w.id,nombre:w.nombre,fecha,tramo:s.tramo,inicio:s.inicio,fin:s.fin,entrada:s.entrada,salida:s.salida,...c});}}
  }
 }
 return {resumen:{evaluados:count,puntuales,faltas,sin_marca,porcentaje:count?Math.round(puntuales/count*1000)/10:null},detalle};
}
