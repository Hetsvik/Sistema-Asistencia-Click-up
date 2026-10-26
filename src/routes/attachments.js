import {HttpError,intParam,json,text} from '../lib/http.js';
import {LIMITS,safeName,detectType,previewKind,disposition,limitedForm} from '../lib/attachment-files.js';
export const configured=env=>Boolean(env.ATTACHMENTS?.put&&env.ATTACHMENTS?.get&&env.ATTACHMENTS?.delete);
const bucket=env=>{if(!configured(env))throw new HttpError(503,'R2 no está configurado. Revisa el binding ATTACHMENTS.');return env.ATTACHMENTS;};
export async function authorizeTask(db,id,user){
 const task=await db.prepare('SELECT ID_Trabajador trabajador_id FROM Tareas WHERE ID_Tarea=?').bind(id).first();
 if(!task||(user.rol!=='admin'&&task.trabajador_id!==user.id))throw new HttpError(404,'Tarea no encontrada.');
 return task;
}
export const status=async({env})=>json({configured:configured(env),limits:{files:LIMITS.count,per_file:LIMITS.file,total:LIMITS.total,per_task:LIMITS.task,per_author:LIMITS.user},preview:['image/png','image/jpeg','image/webp','text/plain','text/csv']});
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value));}
export async function discard(env,row){
 // El estado impide que una recuperación simultánea publique estos objetos.
 const token=crypto.randomUUID(),now=new Date().toISOString(),cutoff=new Date(Date.now()-3600000).toISOString();
 const changed=await env.DB.prepare("UPDATE Envios_R2 SET Estado='limpieza',Intento=?,Creado_UTC=? WHERE ID=? AND Intento=? AND (Estado IN ('pendiente','error') OR (Estado='limpieza' AND Creado_UTC<?))").bind(token,now,row.ID,row.Intento,cutoff).run();
 if(!changed.meta.changes)return;
 try{
  const keys=JSON.parse(row.Plan_JSON).map(f=>f.key);if(keys.length)await bucket(env).delete(keys);
  await env.DB.prepare("UPDATE Envios_R2 SET Estado='error',Bytes=0 WHERE ID=? AND Intento=? AND Estado='limpieza'").bind(row.ID,token).run();
 }catch(err){console.error('[R2 cleanup]',row.ID,err);}
}
export async function cleanup(env){
 if(!configured(env))return;
 const cutoff=new Date(Date.now()-60*60*1000).toISOString();
 const {results}=await env.DB.prepare("SELECT * FROM Envios_R2 WHERE (Estado IN ('pendiente','limpieza') AND Creado_UTC<?) OR (Estado='error' AND Bytes>0) LIMIT 20").bind(cutoff).all();
 for(const row of results)await discard(env,row);
}
export async function send({request,env,user,params}){
 const id=intParam(params.id,{min:1});await authorizeTask(env.DB,id,user);const r2=bucket(env);
 const form=await limitedForm(request);
 if([...form.keys()].some(k=>!['files','mensaje','client_id'].includes(k))||form.getAll('mensaje').length>1||form.getAll('client_id').length!==1)throw new HttpError(400,'Campos de envío inválidos.');
 const mensaje=text(form.get('mensaje'),{field:'El mensaje',required:false,max:1000})||'';
 const client=form.get('client_id');if(typeof client!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(client))throw new HttpError(400,'Identificador de envío inválido.');
 const files=form.getAll('files');if(!files.length||files.length>LIMITS.count)throw new HttpError(400,'Selecciona entre 1 y 5 archivos.');
 let total=0;const data=[];
 for(const file of files){
  if(typeof file==='string'||typeof file.arrayBuffer!=='function')throw new HttpError(400,'Archivo inválido.');
  if(file.size<=0||file.size>LIMITS.file)throw new HttpError(413,'Cada archivo debe pesar entre 1 byte y 10 MiB.');
  total+=file.size;if(total>LIMITS.total)throw new HttpError(413,'El envío no puede superar 25 MiB.');
  const name=safeName(file.name),bytes=new Uint8Array(await file.arrayBuffer()),mime=detectType(name,bytes);
  data.push({name,bytes,mime,size:bytes.length,hash:await digest(bytes)});
 }
 const fingerprint=await digest(JSON.stringify([mensaje,...data.map(f=>[f.name,f.size,f.hash])])),created=new Date().toISOString();
 let row=await env.DB.prepare('SELECT * FROM Envios_R2 WHERE ID_Tarea=? AND ID_Empleado=? AND Clave_Cliente=?').bind(id,user.empleado_id,client).first();
 if(row){
  if(row.Huella!==fingerprint)throw new HttpError(409,'El identificador de reintento corresponde a otro contenido.');
  if(row.Estado==='listo')return json({message:'Archivos ya enviados.',comment_id:row.ID_Comentario,replayed:true});
  if(row.Estado!=='error'||row.Bytes!==0)throw new HttpError(409,'El envío sigue procesándose o recuperándose. Reintenta en unos momentos con la misma selección.');
 }
 const uploadId=row?.ID||crypto.randomUUID(),attempt=crypto.randomUUID();
 const plan=row?JSON.parse(row.Plan_JSON):data.map((f,i)=>({id:crypto.randomUUID(),key:`tasks/${id}/${uploadId}/${i}`,name:f.name,mime:f.mime,size:f.size}));
 const quota=`(SELECT COALESCE(SUM(Bytes),0) FROM Envios_R2 WHERE ID_Tarea=? AND ID<>?) + ? <= ? AND (SELECT COALESCE(SUM(Bytes),0) FROM Envios_R2 WHERE ID_Empleado=? AND ID<>?) + ? <= ? AND (SELECT COALESCE(SUM(json_array_length(Plan_JSON)),0) FROM Envios_R2 WHERE ID_Tarea=? AND ID<>? AND Bytes>0)+?<=? AND (SELECT COALESCE(SUM(json_array_length(Plan_JSON)),0) FROM Envios_R2 WHERE ID_Empleado=? AND ID<>? AND Bytes>0)+?<=?`;
 const binds=[id,uploadId,total,LIMITS.task,user.empleado_id,uploadId,total,LIMITS.user,id,uploadId,data.length,LIMITS.taskCount,user.empleado_id,uploadId,data.length,LIMITS.userCount];
 const reservation=row?
  await env.DB.prepare(`UPDATE Envios_R2 SET Estado='pendiente',Bytes=?,Creado_UTC=?,Intento=? WHERE ID=? AND Estado='error' AND Bytes=0 AND ${quota}`).bind(total,created,attempt,uploadId,...binds).run():
  await env.DB.prepare(`INSERT OR IGNORE INTO Envios_R2(ID,ID_Tarea,ID_Empleado,Clave_Cliente,Huella,Intento,Estado,Bytes,Plan_JSON,Creado_UTC) SELECT ?,?,?,?,?,?,'pendiente',?,?,? WHERE ${quota}`).bind(uploadId,id,user.empleado_id,client,fingerprint,attempt,total,JSON.stringify(plan),created,...binds).run();
 if(!reservation.meta.changes){
  const active=await env.DB.prepare('SELECT Estado,Huella,ID_Comentario FROM Envios_R2 WHERE ID_Tarea=? AND ID_Empleado=? AND Clave_Cliente=?').bind(id,user.empleado_id,client).first();
  if(active?.Estado==='listo'&&active.Huella===fingerprint)return json({message:'Archivos ya enviados.',comment_id:active.ID_Comentario,replayed:true});
  throw new HttpError(active&&active.Estado!=='error'?409:413,active&&active.Estado!=='error'?'El envío ya está en curso. Reintenta en unos momentos.':'Cuota de adjuntos superada: 250 MiB/1000 archivos por tarea o 1 GiB/5000 archivos por autor.');
 }
 row={ID:uploadId,Intento:attempt,Plan_JSON:JSON.stringify(plan)};
 try{
  for(let i=0;i<data.length;i++){
   const object=await r2.put(plan[i].key,data[i].bytes,{httpMetadata:{contentType:data[i].mime},customMetadata:{upload:uploadId}});
   if(!object)throw new Error('R2 no confirmó el objeto.');
  }
  await authorizeTask(env.DB,id,user);
  const statements=[
   env.DB.prepare("INSERT INTO Comentarios_Tarea(ID_Tarea,Autor,Rol,Mensaje) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM Envios_R2 WHERE ID=? AND Intento=? AND Estado='pendiente')").bind(id,user.nombre,user.rol==='admin'?'Administrador':'Empleado',mensaje||'Archivos adjuntos.',uploadId,attempt),
   env.DB.prepare("UPDATE Envios_R2 SET Estado='listo',ID_Comentario=last_insert_rowid() WHERE ID=? AND Intento=? AND Estado='pendiente'").bind(uploadId,attempt),
   ...plan.map(f=>env.DB.prepare("INSERT INTO Adjuntos_R2(ID,ID_Envio,ID_Comentario,Nombre,MIME,Bytes,Clave_Objeto,Creado_UTC) SELECT ?,ID,ID_Comentario,?,?,?,?,? FROM Envios_R2 WHERE ID=? AND Estado='listo'").bind(f.id,f.name,f.mime,f.size,f.key,created,uploadId))
  ];
  const result=await env.DB.batch(statements);if(!result[0].meta.changes)throw new Error('El envío fue recuperado antes de confirmarse.');
 }catch(err){
  // Ante resultado incierto de D1, consultar antes de eliminar: jamás borrar un envío confirmado.
  try{
   const committed=await env.DB.prepare('SELECT Estado,ID_Comentario FROM Envios_R2 WHERE ID=?').bind(uploadId).first();
   if(committed?.Estado==='listo')return json({message:'Archivos enviados.',comment_id:committed.ID_Comentario,replayed:true});
   await discard(env,row);
  }catch(recovery){console.error('[R2 recovery]',uploadId,recovery);}
  console.error('[R2 send]',uploadId,err);throw new HttpError(503,'No se confirmó el envío. Conserva la selección y reintenta; no se duplicarán los archivos confirmados.');
 }
 const done=await env.DB.prepare('SELECT ID_Comentario FROM Envios_R2 WHERE ID=?').bind(uploadId).first();
 return json({message:'Archivos enviados.',comment_id:done.ID_Comentario},201);
}
export async function download({env,user,params,url}){
 const id=intParam(params.id,{min:1});await authorizeTask(env.DB,id,user);const r2=bucket(env);
 if(!/^[a-f0-9-]{36}$/.test(params.attachment))throw new HttpError(404,'Archivo no encontrado.');
 const f=await env.DB.prepare("SELECT A.* FROM Adjuntos_R2 A JOIN Envios_R2 E ON E.ID=A.ID_Envio WHERE A.ID=? AND E.ID_Tarea=? AND E.Estado='listo'").bind(params.attachment,id).first();
 if(!f)throw new HttpError(404,'Archivo no encontrado.');
 const preview=url.searchParams.get('preview')==='1';if(preview&&!previewKind(f.MIME))throw new HttpError(415,'Este formato solo está disponible para descarga.');
 const object=await r2.get(f.Clave_Objeto);if(!object)throw new HttpError(404,'El objeto no está disponible. Contacta al administrador.');
 return new Response(object.body,{headers:{'Content-Type':preview&&previewKind(f.MIME)==='text'?'text/plain; charset=utf-8':f.MIME,'Content-Length':String(f.Bytes),'Content-Disposition':disposition(f.Nombre,preview),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'self'",'Referrer-Policy':'no-referrer'}});
}
export async function commentFiles(db,id){
 return (await db.prepare("SELECT A.ID id,A.ID_Comentario comment_id,A.Nombre nombre,A.MIME mime,A.Bytes bytes FROM Adjuntos_R2 A JOIN Envios_R2 E ON E.ID=A.ID_Envio WHERE E.ID_Tarea=? AND E.Estado='listo' ORDER BY A.Creado_UTC,A.ID").bind(id).all()).results.map(f=>({...f,preview:previewKind(f.mime)}));
}
