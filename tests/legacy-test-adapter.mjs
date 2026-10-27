// Adaptación SOLO de entradas de escenarios de regresión anteriores al cambio de contrato.
// No se importa desde src/ o frontend/. La suite security-identity usa handleApi DIRECTAMENTE.
import {handleApi as actual} from '../src/index.js';
export async function handleApi(request,env){
 env={...env,SESSION_SECRET:env.SESSION_SECRET.padEnd(40,'-')};
 const path=new URL(request.url).pathname;
 if(request.headers.get('Content-Type')?.includes('application/json')){
  let b;try{b=await request.clone().json();}catch{return actual(request,env);}
  if(path==='/api/auth/login'&&b.codigo){
   const row=await env.DB.prepare(`SELECT I.Correo_Corporativo AS correo FROM Identidad_Usuario I JOIN ${b.es_admin?'Administrador':'Trabajadores'} A ON A.ID_Empleado=I.ID_Empleado WHERE A.${b.es_admin?'Codigo_Administrador':'Codigo_Trabajador'}=? COLLATE NOCASE`).bind(b.codigo).first();
   b={correo:row?.correo||'user.inexistente@arqyservgen.com',pin:b.pin};
  }else if(/^\/api\/admin\/users(?:\/\d+)?$/.test(path)&&['POST','PUT'].includes(request.method)&&'nombre' in b){
   const parts=typeof b.nombre==='string'?b.nombre.trim().split(/\s+/):[];
   b={...b,nombres:parts[0]||'',apellido_paterno:parts.slice(1).join(' '),apellido_materno:'',correo_personal:b.correo};
  }
  request=new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify(b)});
 }
 return actual(request,env);
}
