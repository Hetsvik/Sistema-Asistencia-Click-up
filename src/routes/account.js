import { HttpError,json,readJson,text } from '../lib/http.js';
import { ACCOUNT_TYPES } from '../lib/accounts.js';
import { hashPin,verifyPin } from '../lib/security.js';
import { clearCookie } from '../lib/session.js';
export async function detail({env,user}){
 const a=ACCOUNT_TYPES[user.rol];
 const profile=await env.DB.prepare(`SELECT E.Nombre_Completo AS nombre,E.Correo AS correo,E.Telefono AS telefono,${user.rol==='trabajador'?'A.Rol_Cargo':'NULL'} AS cargo FROM Empleados E JOIN ${a.table} A ON A.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=?`).bind(user.empleado_id).first();
 return json({profile:{...profile,codigo:user.codigo,rol:user.rol}});
}
export async function update({env,user,request}){
 const b=await readJson(request),nombre=text(b.nombre,{field:'El nombre',max:120});
 const correo=typeof b.correo==='string'?b.correo.trim():'';const telefono=typeof b.telefono==='string'?b.telefono.trim():'';
 if(correo.length>254||(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)))throw new HttpError(400,'Correo electrónico no válido.');
 if(telefono.length>30||(telefono&&!/^[+\d\s().-]+$/.test(telefono)))throw new HttpError(400,'Teléfono no válido.');
 if(correo&&await env.DB.prepare('SELECT ID_Empleado FROM Empleados WHERE Correo=? COLLATE NOCASE AND ID_Empleado<>?').bind(correo,user.empleado_id).first())throw new HttpError(409,'Ese correo ya pertenece a otra cuenta.');
 await env.DB.prepare('UPDATE Empleados SET Nombre_Completo=?,Correo=?,Telefono=? WHERE ID_Empleado=?').bind(nombre,correo||null,telefono||null,user.empleado_id).run();
 return json({message:'Información personal actualizada.'});
}
export async function password({env,user,request,url}){
 const b=await readJson(request),current=b.actual,next=b.nueva;
 if(typeof current!=='string'||!current||current.length>128||typeof next!=='string'||next.length<8||next.length>128)throw new HttpError(400,'La nueva contraseña debe tener de 8 a 128 caracteres.');
 if(current===next)throw new HttpError(400,'La nueva contraseña debe ser diferente.');
 const key=`clave:${user.empleado_id}`,now=Date.now();const attempt=await env.DB.prepare('SELECT Bloqueado_Hasta AS hasta FROM Intentos_Login WHERE Clave=?').bind(key).first();
 if(attempt?.hasta>now)throw new HttpError(429,'Demasiados intentos. Espera 15 minutos.');
 if(attempt?.hasta&&attempt.hasta<=now)await env.DB.prepare('DELETE FROM Intentos_Login WHERE Clave=?').bind(key).run();
 const a=ACCOUNT_TYPES[user.rol];const row=await env.DB.prepare(`SELECT PIN_Acceso AS pin FROM ${a.table} WHERE ID_Empleado=?`).bind(user.empleado_id).first();
 if(!await verifyPin(current,row.pin)){
 await env.DB.prepare(`INSERT INTO Intentos_Login(Clave,Intentos,Bloqueado_Hasta,Actualizado) VALUES(?,1,0,?) ON CONFLICT(Clave) DO UPDATE SET Intentos=Intentos+1,Actualizado=excluded.Actualizado,Bloqueado_Hasta=CASE WHEN Intentos+1>=5 THEN ? ELSE 0 END`).bind(key,now,now+900000).run();
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
 await env.DB.prepare('DELETE FROM Intentos_Login WHERE Clave=?').bind(key).run();
 return json({message:'Contraseña actualizada. Inicia sesión de nuevo en tus dispositivos.'},200,{'Set-Cookie':clearCookie(url)});
}
