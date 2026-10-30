import {attendanceCTE,guardAttendance} from './attendance-query.js';
import {nowLocal,toMs} from './dates.js';
import {HttpError} from './http.js';
export const TOLERANCE_MINUTES=10;
export const peruNow=()=>{
 const instant=new Date();
 return {...nowLocal('America/Lima',instant),server_time:instant.toISOString(),server_epoch_ms:instant.getTime()};
};
const dateOf=ms=>new Date(ms).toISOString().slice(0,10);
export function classifySlot(s,fecha,now){
 const start=toMs(`${fecha} ${s.inicio}:00`),deadline=start+600000;
 const entered=s.entrada?toMs(s.entrada):null;
 const falta=entered!==null?entered>deadline:toMs(now)>deadline;
 return {evaluado:entered!==null||toMs(now)>deadline,puntual:entered!==null&&entered<=deadline,falta,
  motivo:falta?(entered!==null?'Entrada fuera de tolerancia':'Sin entrada tras tolerancia'):null,
  estado:s.salida?'Finalizado':s.entrada?(falta?'Presente · falta':'Presente'):falta?'Falta · sin entrada':toMs(now)<start?'Pendiente':'Dentro de tolerancia'};
}
export async function schedules(db,ids,fecha=null){
 const {results}=await db.prepare(`SELECT V.ID_Empleado empleado_id,V.Desde desde,V.Horario_JSON horario FROM Horarios_Vigencia V WHERE 1=1 ${ids?.length?'AND V.ID_Empleado IN ('+ids.map(()=>'?').join(',')+')':''} ${fecha?'AND V.Desde=(SELECT MAX(X.Desde) FROM Horarios_Vigencia X WHERE X.ID_Empleado=V.ID_Empleado AND X.Desde<=?)':''} ORDER BY V.Desde`).bind(...(ids||[]),...(fecha?[fecha]:[])).all();return results.map(v=>({...v,horario:JSON.parse(v.horario)}));
}
export function planFor(versions,id,fecha){
 const v=versions.filter(v=>v.empleado_id===id&&v.desde<=fecha).at(-1);
 if(!v||v.horario===null)return {configurado:false,tramos:[]};
 const dia=(new Date(fecha+'T00:00:00Z').getUTCDay()+6)%7+1;
 return {configurado:true,tramos:(v.horario.find(d=>d.dia===dia)?.tramos||[])};
}
export function mergeSlots(plan,saved){const by=new Map(plan.map((s,i)=>[i+1,{...s,tramo:i+1,entrada:null,salida:null}]));for(const s of saved)by.set(s.tramo,s);return [...by.values()].sort((a,b)=>a.tramo-b.tramo);}
export async function currentPlan(db,employee,worker,now){
 const versions=await schedules(db,[employee],now.fecha),plan=planFor(versions,employee,now.fecha);
 const {results}=await db.prepare('SELECT Tramo tramo,Inicio_Previsto inicio,Fin_Previsto fin,Entrada entrada,Salida salida FROM Marcaciones_Tramo WHERE ID_Trabajador=? AND Fecha=? ORDER BY Tramo').bind(worker,now.fecha).all();
 return {...plan,tramos:mergeSlots(plan.tramos,results),fijado:results.length>0};
}
/** Calcula solo vigencias conocidas y conserva el plan congelado en cada marcación. */
export async function punctuality(db,{desde,hasta,workerId=null,q='',includeDetails=true,now=peruNow()}){
 const query=attendanceCTE({desde,hasta,workerId,q,now});await guardAttendance(db,query);
 const v=await db.prepare(query.sql+`SELECT COUNT(*) evaluados,COALESCE(SUM(puntual),0) puntuales,COALESCE(SUM(falta),0) faltas,COALESCE(SUM(falta AND entrada IS NULL),0) sin_marca FROM evaluated WHERE evaluado`).bind(...query.args).first();
 let detalle=[];
 if(includeDetails){const rows=await db.prepare(query.sql+'SELECT * FROM evaluated ORDER BY fecha,trabajador_id,tramo LIMIT 50001').bind(...query.args).all();if(rows.results.length>50000)throw new HttpError(413,'Demasiados tramos. Filtra un trabajador o un intervalo de fechas menor.');detalle=rows.results.map(s=>({...s,...classifySlot(s,s.fecha,now.fechaHora)}));}
 return {resumen:{...v,porcentaje:v.evaluados?Math.round(v.puntuales/v.evaluados*1000)/10:null},detalle};
}
