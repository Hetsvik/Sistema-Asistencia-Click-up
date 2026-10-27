import { HttpError,json,readJson } from '../lib/http.js';
import { hashPin,verifyPin } from '../lib/security.js';
import { clearCookie,readSession,sessionCookie,signSession } from '../lib/session.js';
import { limit } from '../lib/rate-limit.js';
export async function login({request,env,url}){
 await limit(env.DB,'login-ip',request.headers.get('CF-Connecting-IP')||'local',30,900);
 const b=await readJson(request);
 const email=typeof b.correo==='string'?b.correo.trim().toLowerCase():'';
 const pin=typeof b.pin==='string'?b.pin:'';
 if(email.length>254||!/^[-a-z0-9.]+@arqyservgen\.com$/.test(email)||!pin||pin.length>128)throw new HttpError(400,'Ingresa tu correo corporativo y contraseña.');
 const release=await limit(env.DB,'login-account',email,5,900);
 const identity=await env.DB.prepare(`SELECT I.ID_Empleado AS empleado_id,I.Correo_Corporativo AS correo,I.Requiere_Clave AS reset,COALESCE(C.Rol,CASE WHEN EXISTS(SELECT 1 FROM Administrador A WHERE A.ID_Empleado=I.ID_Empleado) THEN 'admin' ELSE 'trabajador' END) AS rol FROM Identidad_Usuario I LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=I.ID_Empleado WHERE I.Correo_Corporativo=?`).bind(email).first();
 const admin=identity?.rol==='admin';
 const row=identity?await env.DB.prepare(`SELECT A.${admin?'ID_Administrador':'ID_Trabajador'} AS id,A.${admin?'Codigo_Administrador':'Codigo_Trabajador'} AS codigo,A.PIN_Acceso AS pin,E.Nombre_Completo AS nombre,E.Estado AS estado,${admin?'NULL':'A.Rol_Cargo'} AS cargo,COALESCE(C.Version_Sesion,0) AS version FROM ${admin?'Administrador':'Trabajadores'} A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE A.ID_Empleado=?`).bind(identity.empleado_id).first():null;
 const valid=row?await verifyPin(pin,row.pin):(await hashPin(pin),false);
 if(!row||!valid||identity.reset||row.estado!=='Activo')throw new HttpError(401,'Correo o contraseña incorrectos. Si necesitas ayuda, contacta al administrador.');
 await release();
 const {pin:secret,estado,...data}=row;
 const user={...data,empleado_id:identity.empleado_id,correo:identity.correo,rol:identity.rol};
 return json({user},200,{'Set-Cookie':sessionCookie(await signSession(env,user),url)});
}
export async function logout({request,env,url}){
 const user=await readSession(request,env);
 if(user)await env.DB.prepare('DELETE FROM Sesiones_Seguras WHERE ID=?').bind(user.sid).run();
 return json({ok:true},200,{'Set-Cookie':clearCookie(url)});
}
export async function me({user}){const {exp,sid,...safe}=user;return json({user:safe});}
