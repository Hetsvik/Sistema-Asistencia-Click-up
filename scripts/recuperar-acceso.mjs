// Genera SQL privado, no consulta ni exporta contraseñas. Nunca pasar la clave como argumento.
import {stdin,stdout} from 'node:process';
import {mkdir,writeFile} from 'node:fs/promises';
import {hashPin} from '../src/lib/security.js';
import {identityFields,emailBase} from '../src/lib/identity.js';
const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
const id=Number(args.id);if(!Number.isSafeInteger(id)||id<1)throw Error('Uso: node scripts/recuperar-acceso.mjs --id ID_EMPLEADO --nombres "Nombres" --paterno "Apellido" --materno "Apellido" --rol admin');
if(!['admin','trabajador'].includes(args.rol))throw Error('Indica --rol admin o trabajador. El rol NO se cambiará: debe coincidir con la cuenta existente.');
const f=identityFields({nombres:args.nombres,apellido_paterno:args.paterno,apellido_materno:args.materno});
const email=emailBase(f.names,args.rol)+(args.sufijo||'')+'@arqyservgen.com';
if(args.sufijo&&!/^\d{1,5}$/.test(args.sufijo))throw Error('Sufijo numérico no válido.');
async function secret(label){
 if(!stdin.isTTY)throw Error('Ejecuta esta herramienta en una terminal interactiva, sin redirigir entrada.');
 stdin.setRawMode(true);stdin.resume();stdout.write(label);let value='';
 return await new Promise((resolve,reject)=>{
 const done=()=>{stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};
 const read=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){done();reject(Error('Cancelado'));return;}if(c==='\r'||c==='\n'){done();resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;}};
 stdin.on('data',read);
 });
}
const password=await secret('Nueva contraseña (no se mostrará): '),again=await secret('Repite la contraseña: ');
if(password!==again||password.length<12||password.length>128||!password.trim())throw Error('Las contraseñas deben coincidir y tener de 12 a 128 caracteres.');
const hash=await hashPin(password),q=s=>"'"+String(s).replaceAll("'","''")+"'";
// Guardias idénticas en cada sentencia: si ID/rol no coinciden no modifica otra cuenta.
const guard=`EXISTS(SELECT 1 FROM Cuentas_Usuario WHERE ID_Empleado=${id} AND Rol=${q(args.rol)})`;
const sql=`-- Privado: contiene hash de contraseña. No subir a Git ni compartir.\nUPDATE Identidad_Usuario SET Nombres=${q(f.names)},Apellido_Paterno=${q(f.paternal)},Apellido_Materno=${q(f.maternal)},Correo_Corporativo=${q(email)},Revisar_Nombre=0,Requiere_Clave=0 WHERE ID_Empleado=${id} AND ${guard};\nUPDATE Empleados SET Nombre_Completo=${q(f.full)} WHERE ID_Empleado=${id} AND ${guard};\nUPDATE Administrador SET PIN_Acceso=${q(hash)} WHERE ID_Empleado=${id} AND ${guard};\nUPDATE Trabajadores SET PIN_Acceso=${q(hash)} WHERE ID_Empleado=${id} AND ${guard};\nUPDATE Cuentas_Usuario SET Version_Sesion=Version_Sesion+1 WHERE ID_Empleado=${id} AND Rol=${q(args.rol)};\nSELECT I.ID_Empleado,I.Correo_Corporativo,I.Requiere_Clave,C.Rol FROM Identidad_Usuario I JOIN Cuentas_Usuario C USING(ID_Empleado) WHERE I.ID_Empleado=${id};\n`;
await mkdir('database/private',{recursive:true});await writeFile('database/private/recuperar_acceso.sql',sql,{mode:0o600});
console.log(`Archivo privado generado: database/private/recuperar_acceso.sql\nCorreo previsto: ${email}\nRevisa el ID y aplica con wrangler d1 execute. Elimina después el archivo.`);
