// Rutas dentro de la misma interfaz: filtros, página y tamaño via query string.
export function routeState(defaults){
 const read=()=>{const p=new URLSearchParams(location.search),out={...defaults};for(const [k,v] of Object.entries(defaults)){const value=p.get(k);if(value===null)continue;out[k]=typeof v==='number'?(/^[1-9]\d{0,5}$/.test(value)?Number(value):v):value.slice(0,160);}return out;};
 const write=(values,{replace=false}={})=>{const url=new URL(location.href);for(const [k,v] of Object.entries(values)){if(v===undefined)continue;if(v===''||v===null||v===defaults[k])url.searchParams.delete(k);else url.searchParams.set(k,String(v));}if(url.href!==location.href)history[replace?'replaceState':'pushState']({},'',url);};
 return {read,write,onChange:fn=>window.addEventListener('popstate',fn)};
}
