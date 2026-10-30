import {intParam,HttpError} from './http.js';
/** Tamaño máximo impuesto en el servidor, nunca solo en la interfaz. */
export function pagination(p,{size=20,max=100}={}){
 const limit=intParam(p.get('limit'),{min:1,max,fallback:size});
 if(p.has('page')&&p.has('offset'))throw new HttpError(400,'Usa page o offset, no ambos.');
 const offset=intParam(p.get('offset'),{min:0,max:1000000,fallback:0});
 const page=intParam(p.get('page'),{min:1,max:100000,fallback:Math.floor(offset/limit)+1});
 return {limit,page,offset};
}
export function pageInfo(total,{limit,page}){const pages=Math.max(1,Math.ceil(total/limit)),current=Math.min(page,pages);return {total,limit,page:current,pages,offset:(current-1)*limit,has_more:current<pages};}
