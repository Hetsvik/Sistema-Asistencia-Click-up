import {$,esc,debounce} from './ui.js';
/** Opciones paginadas: no descarga el catálogo completo al abrir un formulario. */
export function catalogPicker({select,input,fetchPage,key,label,allLabel='Selecciona…'}){
 const nav=document.createElement('div');nav.className='catalog-pagination';select.after(nav);
 let page=1,serial=0,closed=false;
 async function load(next=1){const seq=++serial;nav.textContent='Cargando opciones…';try{const d=await fetchPage({q:input.value.trim(),page:next,limit:20});if(closed||seq!==serial)return;page=d.page;const value=select.value,previous=select.selectedOptions[0]?.textContent;
 select.innerHTML=`<option value="">${esc(allLabel)}</option>`+d[key].map(u=>`<option value="${u.id}">${esc(label(u))}</option>`).join('');if(value&&!d[key].some(u=>String(u.id)===value))select.insertAdjacentHTML('beforeend',`<option value="${esc(value)}">${esc(previous||'Selección actual')}</option>`);select.value=value;
 nav.innerHTML=`<button type="button" class="btn outline sm" data-back ${page<=1?'disabled':''}>Anterior</button><span role="status">Opciones ${page}/${d.pages} · ${d.total}</span><button type="button" class="btn outline sm" data-forward ${page>=d.pages?'disabled':''}>Siguiente</button>`;
 $('[data-back]',nav).onclick=()=>load(page-1);$('[data-forward]',nav).onclick=()=>load(page+1);
 }catch(e){if(closed||seq!==serial)return;nav.textContent=e.message+' ';const retry=document.createElement('button');retry.type='button';retry.className='btn outline sm';retry.textContent='Reintentar';retry.onclick=()=>load(next);nav.append(retry);}}
 const search=debounce(()=>load(1),350);input.addEventListener('input',search);load();
 return {destroy(){closed=true;serial++;input.removeEventListener('input',search);}};
}
