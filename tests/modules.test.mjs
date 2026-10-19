import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleApi } from '../src/index.js';
import { createTestDb } from './d1-shim.mjs';
import { nowLocal } from '../src/lib/dates.js';

function setup(t){
 const db=createTestDb({seed:false});
 db.raw.exec(readFileSync(new URL('./fixtures/modules_data.sql',import.meta.url),'utf8'));
 const env={DB:db,SESSION_SECRET:'secreto-ficticio-para-pruebas-modulos',TIMEZONE:'America/Bogota'};
 t.after(()=>env.DB.raw.close());
 const call=async(method,path,body,cookie)=>{
  const res=await handleApi(new Request('http://localhost'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),'CF-Connecting-IP':'qa'},body:body?JSON.stringify(body):undefined}),env);
  return {status:res.status,data:await res.json(),cookie:res.headers.get('Set-Cookie')?.split(';')[0]};
 };
 const login=(codigo='TESTADM',pin='admin1234',es_admin=true)=>call('POST','/api/auth/login',{codigo,pin,es_admin});
 const form=(more={})=>({nombre:'Nueva Persona',correo:'nueva@example.com',telefono:'+51 999 111 222',rol:'trabajador',pin:'Clave-Ficticia-908!',...more});
 return {env,call,login,form};
}

test('anuncios: autenticación y autorización por rol',async t=>{
 const {call,login}=setup(t),worker=(await login('TEST001','1234',false)).cookie;
 assert.equal((await call('GET','/api/announcements')).status,401);
 assert.equal((await call('GET','/api/announcements',null,worker)).status,200);
 assert.equal((await call('POST','/api/announcements',{nombre:'Prueba',motivo:'Texto'},worker)).status,403);
});
test('anuncios: fecha del servidor en Perú y contenido válido',async t=>{
 const {call,login}=setup(t),cookie=(await login()).cookie;
 const before=nowLocal('America/Lima').fechaHora;
 const r=await call('POST','/api/announcements',{nombre:'Aviso',motivo:'Reunión de equipo',fecha:'1900-01-01'},cookie);
 assert.equal(r.status,201);assert.equal(r.data.tz,'America/Lima');assert.ok(r.data.announcement.fecha>=before);
 assert.equal(r.data.announcement.fecha.slice(0,10),nowLocal('America/Lima').fecha);
});
test('anuncios: búsqueda, orden en ambas direcciones y paginación',async t=>{
 const {env,call,login}=setup(t),cookie=(await login()).cookie;
 for(let i=0;i<25;i++)env.DB.raw.prepare('INSERT INTO Anuncios(Nombre,Motivo,Fecha_Creacion,ID_Administrador) VALUES(?,?,?,1)').run(`Aviso ${String(i).padStart(2,'0')}`,'Comunicado',`2026-01-${String(i+1).padStart(2,'0')} 12:00:00`);
 const first=await call('GET','/api/announcements?sort=nombre&order=asc',null,cookie);
 assert.equal(first.data.total,25);assert.equal(first.data.announcements.length,20);assert.equal(first.data.announcements[0].nombre,'Aviso 00');
 const second=await call('GET','/api/announcements?page=2&sort=nombre&order=asc',null,cookie);
 assert.equal(second.data.announcements.length,5);assert.equal(second.data.announcements[0].nombre,'Aviso 20');
 const desc=await call('GET','/api/announcements?sort=fecha&order=desc',null,cookie);assert.equal(desc.data.announcements[0].nombre,'Aviso 24');
 const asc=await call('GET','/api/announcements?sort=fecha&order=asc',null,cookie);assert.equal(asc.data.announcements[0].nombre,'Aviso 00');
 assert.equal((await call('GET','/api/announcements?q=24',null,cookie)).data.total,1);
 assert.equal((await call('GET','/api/announcements?q=%27%20OR%201%3D1--',null,cookie)).data.total,0);
});
test('anuncios: rechaza datos vacíos, enormes y orden no permitido',async t=>{
 const {call,login}=setup(t),cookie=(await login()).cookie;
 for(const body of [{nombre:' ',motivo:'Texto'},{nombre:'Prueba',motivo:' '},{nombre:'x'.repeat(161),motivo:'Texto'},{nombre:'Prueba',motivo:'x'.repeat(5001)}])assert.equal((await call('POST','/api/announcements',body,cookie)).status,400);
 for(const q of ['sort=DROP','order=DELETE','page=0','page=abc'])assert.equal((await call('GET','/api/announcements?'+q,null,cookie)).status,400);
});
test('usuarios: rutas de gestión exclusivas del administrador y respuestas sin PIN',async t=>{
 const {call,login}=setup(t),cookie=(await login()).cookie,worker=(await login('TEST001','1234',false)).cookie;
 assert.equal((await call('GET','/api/admin/users')).status,401);
 assert.equal((await call('GET','/api/admin/users',null,worker)).status,403);
 const list=await call('GET','/api/admin/users',null,cookie);
 assert.equal(list.data.stats.activos,4);assert.equal(list.data.stats.administradores,1);
 assert.equal(list.data.users.length,4);assert.ok(!JSON.stringify(list.data).includes('PIN_Acceso'));assert.ok(list.data.users.every(u=>!('pin' in u)));
 const detail=await call('GET','/api/admin/users/2',null,cookie);assert.equal(detail.data.user.codigo,'TEST001');assert.ok(!('pin' in detail.data.user));
 assert.equal((await call('GET','/api/users',null,cookie)).data.users.length,3);
});
test('usuarios: crear trabajador, generar código y guardar contraseña con hash',async t=>{
 const {env,call,login,form}=setup(t),cookie=(await login()).cookie;
 const r=await call('POST','/api/admin/users',form(),cookie);assert.equal(r.status,201);assert.match(r.data.user.codigo,/^EM[A-F0-9]{12}$/);
 const stored=env.DB.raw.prepare('SELECT PIN_Acceso AS pin FROM Trabajadores WHERE Codigo_Trabajador=?').get(r.data.user.codigo);assert.match(stored.pin,/^pbkdf2\$/);
 assert.equal((await login(r.data.user.codigo.toLowerCase(),form().pin,false)).status,200);
 assert.equal((await login(r.data.user.codigo,form().pin,true)).status,401);
 assert.ok(!JSON.stringify(r.data).includes(form().pin));
});
test('usuarios: crear administrador operativo',async t=>{
 const {call,login,form}=setup(t),cookie=(await login()).cookie;
 const r=await call('POST','/api/admin/users',form({rol:'admin'}),cookie);assert.equal(r.status,201);assert.match(r.data.user.codigo,/^AD/);
 const other=await login(r.data.user.codigo,form().pin,true);assert.equal(other.status,200);
 assert.equal((await call('GET','/api/admin/users',null,other.cookie)).status,200);
});
test('usuarios: valida campos y evita correo duplicado sin dejar filas huérfanas',async t=>{
 const {env,call,login,form}=setup(t),cookie=(await login()).cookie;
 for(const patch of [{correo:'mal'},{correo:'ana@example.com'},{pin:'corta'},{pin:null},{rol:'superadmin'},{telefono:'abc'},{nombre:' '}]){
  const r=await call('POST','/api/admin/users',form(patch),cookie);assert.ok([400,409].includes(r.status));
 }
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Empleados').get().n,4);
});
test('usuarios: edición conserva contraseña vacía y actualiza datos',async t=>{
 const {call,login,form}=setup(t),cookie=(await login()).cookie;
 const old=(await login('TEST001','1234',false)).cookie;
 const r=await call('PUT','/api/admin/users/2',form({nombre:'Ana Actualizada',correo:'ana@example.com',pin:''}),cookie);
 assert.equal(r.status,200);assert.equal(r.data.user.codigo,'TEST001');
 const me=await call('GET','/api/auth/me',null,old);assert.equal(me.status,200);assert.equal(me.data.user.nombre,'Ana Actualizada');
 assert.equal((await login('TEST001','1234',false)).status,200);
});
test('usuarios: cambiar contraseña revoca cookies anteriores y nunca devuelve el secreto',async t=>{
 const {call,login,form}=setup(t),cookie=(await login()).cookie,old=(await login('TEST001','1234',false)).cookie;
 const r=await call('PUT','/api/admin/users/2',form({correo:'ana@example.com'}),cookie);assert.equal(r.status,200);
 assert.equal((await call('GET','/api/auth/me',null,old)).status,401);
 assert.equal((await login('TEST001','1234',false)).status,401);
 assert.equal((await login('TEST001',form().pin,false)).status,200);assert.ok(!JSON.stringify(r.data).includes('pbkdf2'));
});
test('usuarios: desactivar bloquea acceso inmediato y reactivar no revive cookies',async t=>{
 const {call,login}=setup(t),cookie=(await login()).cookie,old=(await login('TEST001','1234',false)).cookie;
 assert.equal((await call('PUT','/api/admin/users/2/status',{estado:'Inactivo'},cookie)).status,200);
 assert.equal((await call('GET','/api/auth/me',null,old)).status,401);assert.equal((await login('TEST001','1234',false)).status,401);
 assert.equal((await call('PUT','/api/admin/users/2/status',{estado:'Activo'},cookie)).status,200);
 assert.equal((await call('GET','/api/auth/me',null,old)).status,401);assert.equal((await login('TEST001','1234',false)).status,200);
});
test('usuarios: no permite autodesactivación ni cambio del propio rol',async t=>{
 const {call,login,form}=setup(t),cookie=(await login()).cookie;
 assert.equal((await call('PUT','/api/admin/users/1/status',{estado:'Inactivo'},cookie)).status,409);
 assert.equal((await call('PUT','/api/admin/users/1',form({correo:'admin@example.com',pin:'',rol:'trabajador'}),cookie)).status,409);
});
test('usuarios: cambiar rol conserva tareas y asistencia y cambia el acceso',async t=>{
 const {env,call,login,form}=setup(t),cookie=(await login()).cookie,old=(await login('TEST001','1234',false)).cookie;
 const before=env.DB.raw.prepare('SELECT COUNT(*) n FROM Tareas WHERE ID_Trabajador=1').get().n;
 const r=await call('PUT','/api/admin/users/2',form({correo:'ana@example.com',pin:'',rol:'admin'}),cookie);assert.equal(r.status,200);
 assert.equal((await login('TEST001','1234',false)).status,401);const adm=await login('TEST001','1234',true);assert.equal(adm.status,200);
 assert.equal((await call('GET','/api/auth/me',null,old)).status,401);
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Tareas WHERE ID_Trabajador=1').get().n,before);
 assert.equal((await call('GET','/api/users',null,cookie)).data.users.some(u=>u.codigo==='TEST001'),false);
 const back=await call('PUT','/api/admin/users/2',form({correo:'ana@example.com',pin:''}),cookie);assert.equal(back.status,200);
 assert.equal((await login('TEST001','1234',false)).status,200);assert.equal((await login('TEST001','1234',true)).status,401);
 assert.equal((await call('GET','/api/auth/me',null,adm.cookie)).status,401);
});
test('usuarios: bajar un administrador conserva sus anuncios y el código',async t=>{
 const {env,call,login,form}=setup(t),cookie=(await login()).cookie;
 const created=await call('POST','/api/admin/users',form({rol:'admin'}),cookie),id=created.data.user.id;
 const other=await login(created.data.user.codigo,form().pin,true);
 assert.equal((await call('POST','/api/announcements',{nombre:'Conservar',motivo:'Historial'},other.cookie)).status,201);
 assert.equal((await call('PUT',`/api/admin/users/${id}`,form({rol:'trabajador',pin:''}),cookie)).status,200);
 assert.equal((await login(created.data.user.codigo,form().pin,false)).status,200);
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Anuncios').get().n,1);
});
test('usuarios: filtros de búsqueda, rol y estado y validación de ID',async t=>{
 const {call,login}=setup(t),cookie=(await login()).cookie;
 assert.equal((await call('GET','/api/admin/users?rol=trabajador&q=Ana',null,cookie)).data.total,1);
 await call('PUT','/api/admin/users/2/status',{estado:'Inactivo'},cookie);
 const data=(await call('GET','/api/admin/users?estado=Inactivo',null,cookie)).data;assert.equal(data.total,1);assert.equal(data.stats.activos,3);
 for(const path of ['/api/admin/users?rol=bad','/api/admin/users?estado=bad','/api/admin/users?page=-1','/api/admin/users/abc'])assert.equal((await call('GET',path,null,cookie)).status,400);
 assert.equal((await call('GET','/api/admin/users/9999',null,cookie)).status,404);
});
test('usuarios: los triggers impiden perder el último administrador',async t=>{
 const {env}=setup(t);
 env.DB.raw.exec("INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado,Rol) VALUES(1,'admin')");
 assert.throws(()=>env.DB.raw.exec("UPDATE Empleados SET Estado='Inactivo' WHERE ID_Empleado=1"),/ULTIMO_ADMIN/);
 assert.throws(()=>env.DB.raw.exec("UPDATE Cuentas_Usuario SET Rol='trabajador' WHERE ID_Empleado=1"),/ULTIMO_ADMIN/);
});
test('migración: repetirla preserva usuarios, credenciales e historial',async t=>{
 const {env}=setup(t),before=env.DB.raw.prepare('SELECT PIN_Acceso AS pin FROM Trabajadores WHERE ID_Trabajador=1').get().pin;
 const sql=readFileSync(new URL('../database/migrations/0003_anuncios_y_usuarios.sql',import.meta.url),'utf8');
 env.DB.raw.exec(sql);env.DB.raw.exec(sql);
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Empleados').get().n,4);assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Tareas').get().n,4);
 assert.equal(env.DB.raw.prepare('SELECT PIN_Acceso AS pin FROM Trabajadores WHERE ID_Trabajador=1').get().pin,before);
});
test('usuarios: batch revierte cambios si falla el cambio de cuenta',async t=>{
 const {env}=setup(t);
 await assert.rejects(env.DB.batch([
  env.DB.prepare("INSERT INTO Empleados(Nombre_Completo) VALUES('No debe persistir')"),
  env.DB.prepare("INSERT INTO Administrador(ID_Empleado,Codigo_Administrador,PIN_Acceso) VALUES(last_insert_rowid(),'TESTADM','ficticio')"),
 ]));
 assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM Empleados').get().n,4);
});
