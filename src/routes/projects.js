import { HttpError, intParam, json, readJson, text } from '../lib/http.js';
import { normalizeDateTime, toMs } from '../lib/dates.js';
export async function list({env,url}) {
 const q=(url.searchParams.get('q')||'').trim().slice(0,120);
 const limit=intParam(url.searchParams.get('limit'),{min:1,max:500,fallback:200});
 const before=intParam(url.searchParams.get('before'),{min:1});
 const where=[],binds=[];
 if(q){where.push('(P.Nombre_Proyecto LIKE ? OR P.Area_Departamento LIKE ? OR D.Descripcion LIKE ?)');binds.push(...Array(3).fill('%'+q+'%'));}
 if(before!==null){where.push('P.ID_Proyecto<?');binds.push(before);}
 const {results}=await env.DB.prepare(`SELECT P.ID_Proyecto AS id,P.Nombre_Proyecto AS nombre,P.Area_Departamento AS area,
 COALESCE(D.Descripcion,'') AS descripcion,D.Fecha_Programada AS fecha,D.Fecha_Creacion AS creado
 FROM Proyectos P LEFT JOIN Proyectos_Detalle D ON D.ID_Proyecto=P.ID_Proyecto
 ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY P.ID_Proyecto DESC LIMIT ?`).bind(...binds,limit+1).all();
 return json({projects:results.slice(0,limit),has_more:results.length>limit,next_before:results.length?results[Math.min(results.length,limit)-1].id:null});
}
export async function create({request,env}) {
 const b=await readJson(request),nombre=text(b.nombre,{field:'El nombre',max:120}),area=text(b.area,{field:'El área / departamento',max:80});
 const descripcion=text(b.descripcion,{field:'La descripción',max:2000});
 const fecha=normalizeDateTime(b.fecha);
 if(!fecha || new Date(toMs(fecha)).toISOString().slice(0,19).replace('T',' ')!==fecha || !/^(19|20|21)\d{2}-/.test(fecha))throw new HttpError(400,'Selecciona una fecha y hora válidas.');
 const rows=await env.DB.batch([
 env.DB.prepare('INSERT INTO Proyectos(Nombre_Proyecto,Area_Departamento) VALUES(?,?)').bind(nombre,area),
 env.DB.prepare('INSERT INTO Proyectos_Detalle(ID_Proyecto,Descripcion,Fecha_Programada) VALUES(last_insert_rowid(),?,?)').bind(descripcion,fecha)
 ]);
 return json({message:'Proyecto creado.',project:{id:rows[0].meta.last_row_id,nombre,area,descripcion,fecha}},201);
}
