import { HttpError,text } from './http.js';
export function identityFields(body){
 const names=text(body.nombres,{field:'Nombres',max:70});
 const paternal=text(body.apellido_paterno,{field:'Apellido paterno',max:50,required:false})||'';
 const maternal=text(body.apellido_materno,{field:'Apellido materno',max:50,required:false})||'';
 for(const v of [names,paternal,maternal])if(v&&!/^[\p{L}\p{M} '\-]+$/u.test(v))throw new HttpError(400,'Los nombres y apellidos solo admiten letras, espacios, apóstrofos y guiones.');
 const full=[names,paternal,maternal].filter(Boolean).join(' ');
 if(full.length>120)throw new HttpError(400,'El nombre completo no puede superar 120 caracteres.');
 const personal=text(body.correo_personal,{field:'Correo personal',max:254,required:false})?.toLowerCase()||null;
 if(personal&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal))throw new HttpError(400,'Correo personal no válido.');
 return {names,paternal,maternal,personal,full};
}
export function emailBase(names,rol){
 const first=names.trim().split(/\s+/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'').slice(0,40);
 if(!first)throw new HttpError(400,'El primer nombre debe permitir generar un identificador con letras latinas.');
 return (rol==='admin'?'admin.':'user.')+first;
}
export async function corporateEmail(db,names,rol,id=0){
 const base=emailBase(names,rol);
 // Se usa el menor sufijo libre. UNIQUE en D1 resuelve también creaciones concurrentes.
 const {results}=await db.prepare('SELECT Correo_Corporativo AS correo FROM Identidad_Usuario WHERE ID_Empleado<>? AND Correo_Corporativo LIKE ?').bind(id,base+'%@arqyservgen.com').all();
 const used=new Set(results.map(x=>x.correo.toLowerCase()));
 for(let i=1;i<=10000;i++){const email=base+(i===1?'':i)+'@arqyservgen.com';if(!used.has(email))return email;}
 throw new HttpError(409,'No hay un correo disponible para ese nombre.');
}
export async function preview({env,request}){
 const b=await (await import('./http.js')).readJson(request);
 if(!['admin','trabajador'].includes(b.rol))throw new HttpError(400,'Rol no válido.');
 const f=identityFields(b),id=b.id===undefined?0:Number(b.id);
 if(!Number.isSafeInteger(id)||id<0)throw new HttpError(400,'Identificador no válido.');
 return (await import('./http.js')).json({correo_corporativo:await corporateEmail(env.DB,f.names,b.rol,id)});
}
