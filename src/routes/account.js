import { HttpError,json,readJson,text } from '../lib/http.js';
import { ACCOUNT_TYPES } from '../lib/accounts.js';
import { hashPin,verifyPin } from '../lib/security.js';
import { limit } from '../lib/rate-limit.js';
import { clearCookie } from '../lib/session.js';
export async function detail({env,user}){
 const a=ACCOUNT_TYPES[user.rol];
 const profile=await env.DB.prepare(`SELECT E.Nombre_Completo AS nombre,I.Nombres AS nombres,I.Apellido_Paterno AS apellido_paterno,I.Apellido_Materno AS apellido_materno,I.Correo_Personal AS correo_personal,I.Correo_Corporativo AS correo_corporativo,I.Correo_Corporativo AS correo,E.Telefono AS telefono,${user.rol==='trabajador'?'A.Rol_Cargo':'NULL'} AS cargo FROM Empleados E JOIN ${a.table} A ON A.ID_Empleado=E.ID_Empleado JOIN Identidad_Usuario I ON I.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=?`).bind(user.empleado_id).first();
 return json({profile:{...profile,codigo:user.codigo,rol:user.rol}});
}
export async function update({env,user,request}){
 const b=await readJson(request),correo=text(b.correo_personal,{field:'Correo personal',max:254,required:false})?.toLowerCase()||null;
 const telefono=text(b.telefono,{field:'Teléfono',max:32,required:false});
 if(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))throw new HttpError(400,'Correo personal no válido.');
 if(telefono&&!/^[+\d\s().-]{5,32}$/.test(telefono))throw new HttpError(400,'Teléfono no válido.');
 if(Object.hasOwn(b,'nombres')||Object.hasOwn(b,'nombre')||Object.hasOwn(b,'correo_corporativo')||Object.hasOwn(b,'rol'))throw new HttpError(403,'Solo el administrador puede modificar tu identidad y correo corporativo.');
 await env.DB.batch([
 env.DB.prepare('UPDATE Empleados SET Correo=?,Telefono=? WHERE ID_Empleado=?').bind(correo,telefono,user.empleado_id),
 env.DB.prepare('UPDATE Identidad_Usuario SET Correo_Personal=? WHERE ID_Empleado=?').bind(correo,user.empleado_id)]);
 return json({message:'Información personal actualizada.'});
}
export async function password({env,user,request,url}){
 const b=await readJson(request),current=b.actual,next=b.nueva;
 if(typeof current!=='string'||!current||current.length>128||typeof next!=='string'||next.length<8||next.length>128)throw new HttpError(400,'La nueva contraseña debe tener de 8 a 128 caracteres.');
 if(current===next)throw new HttpError(400,'La nueva contraseña debe ser diferente.');
 await limit(env.DB,'password',String(user.empleado_id),5,900);
 const a=ACCOUNT_TYPES[user.rol];const row=await env.DB.prepare(`SELECT PIN_Acceso AS pin FROM ${a.table} WHERE ID_Empleado=?`).bind(user.empleado_id).first();
 if(!await verifyPin(current,row.pin)){
 throw new HttpError(400,'La contraseña actual no es correcta.');
 }
 const hash=await hashPin(next),v=user.version??0,id=user.empleado_id;
 const guard='EXISTS(SELECT 1 FROM Cuentas_Usuario C WHERE C.ID_Empleado=? AND C.Version_Sesion=?)';
 const results=await env.DB.batch([
 env.DB.prepare('INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol,Version_Sesion) VALUES(?,?,?)').bind(id,user.rol,v),
 env.DB.prepare(`UPDATE Trabajadores SET PIN_Acceso=? WHERE ID_Empleado=? AND ${guard}`).bind(hash,id,id,v),
 env.DB.prepare(`UPDATE Administrador SET PIN_Acceso=? WHERE ID_Empleado=? AND ${guard}`).bind(hash,id,id,v),
 env.DB.prepare('UPDATE Cuentas_Usuario SET Version_Sesion=Version_Sesion+1 WHERE ID_Empleado=? AND Version_Sesion=?').bind(id,v)
 ]);
 if(!results[3].meta.changes)throw new HttpError(409,'La cuenta cambió. Inicia sesión de nuevo.');

 return json({message:'Contraseña actualizada. Inicia sesión de nuevo en tus dispositivos.'},200,{'Set-Cookie':clearCookie(url)});
}
