import { HttpError } from './http.js';
const days=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const minute=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
/** Contrato: null = sin configurar; [] = semana sin jornadas. Dos tramos diurnos máximo. */
export function validateSchedule(value){
 if(value===null)return null;
 if(!Array.isArray(value)||value.length>7)throw new HttpError(400,'Horario: selecciona hasta siete días.');
 const seen=new Set();
 const result=value.map(row=>{
  if(!row||typeof row!=='object'||!Number.isInteger(row.dia)||row.dia<1||row.dia>7||seen.has(row.dia))throw new HttpError(400,'Horario: los días deben ser únicos, de lunes a domingo.');
  seen.add(row.dia);const name=days[row.dia-1];
  if(!Array.isArray(row.tramos)||row.tramos.length<1||row.tramos.length>2)throw new HttpError(400,`${name}: indica uno o dos tramos de trabajo.`);
  const tramos=row.tramos.map(s=>{
   if(!s||typeof s!=='object'||!['inicio','fin'].every(k=>typeof s[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k])))throw new HttpError(400,`${name}: usa horas válidas en formato HH:mm (00:00–23:59).`);
   if(minute(s.inicio)>=minute(s.fin))throw new HttpError(400,`${name}: la salida debe ser posterior a la entrada del mismo día.`);
   return {inicio:s.inicio,fin:s.fin};
  }).sort((a,b)=>a.inicio.localeCompare(b.inicio));
  if(tramos.length===2&&tramos[1].inicio<tramos[0].fin)throw new HttpError(400,`${name}: los tramos no pueden superponerse.`);
  return {dia:row.dia,tramos};
 }).sort((a,b)=>a.dia-b.dia);
 return result;
}
export async function readSchedule(db,id){
 const row=await db.prepare('SELECT Horario_JSON AS horario FROM Horarios_Laborales WHERE ID_Empleado=?').bind(id).first();
 return row?JSON.parse(row.horario):null;
}
export function scheduleStatement(db,id,value,updated){
 if(value===null)return db.prepare('DELETE FROM Horarios_Laborales WHERE ID_Empleado=?').bind(id);
 return db.prepare(`INSERT INTO Horarios_Laborales(ID_Empleado,Horario_JSON,Actualizado_En) VALUES(?,?,?)
 ON CONFLICT(ID_Empleado) DO UPDATE SET Horario_JSON=excluded.Horario_JSON,Actualizado_En=excluded.Actualizado_En`).bind(id,JSON.stringify(value),updated);
}
