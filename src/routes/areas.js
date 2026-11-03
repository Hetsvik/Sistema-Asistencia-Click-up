import {HttpError,json,readJson,text} from '../lib/http.js';
export async function list({env}) {
 const {results}=await env.DB.prepare('SELECT ID_Area AS id,Nombre AS nombre FROM Areas_Trabajo ORDER BY Nombre COLLATE NOCASE,ID_Area LIMIT 501').all();
 return json({areas:results.slice(0,500),has_more:results.length>500});
}
export async function create({env,request}) {
 const body=await readJson(request),nombre=text(body.nombre,{field:'El área de trabajo',max:80});
 if(/[\x00-\x1f\x7f]/.test(nombre))throw new HttpError(400,'El nombre del área contiene caracteres no permitidos.');
 try{const r=await env.DB.prepare('INSERT INTO Areas_Trabajo(Nombre) SELECT ? WHERE (SELECT COUNT(*) FROM Areas_Trabajo)<500').bind(nombre).run();if(!r.meta.changes)throw new HttpError(409,'Se alcanzó el límite de 500 áreas de trabajo.');return json({area:{id:r.meta.last_row_id,nombre}},201);}
 catch(e){if(String(e).includes('UNIQUE constraint'))throw new HttpError(409,'Ya existe un área con ese nombre.');throw e;}
}
export async function validateArea(db,value){
 if(value===undefined)return undefined;
 if(value===null||value==='')throw new HttpError(400,'Selecciona un área de trabajo.');
 const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new HttpError(400,'Área de trabajo no válida.');
 if(!(await db.prepare('SELECT ID_Area FROM Areas_Trabajo WHERE ID_Area=?').bind(n).first()))throw new HttpError(400,'El área de trabajo no existe.');return n;
}
