import {Catalog,WorkAreas} from './api.js';
import {$,debounce,esc,openModal} from './ui.js';

/** Directorio paginado; en modo múltiple conserva la selección entre páginas. */
export function openWorkerPicker({query='',area='',selected=[],multiple=false,maxSelect=50,onSelect,onApply}={}){
 let modal=null,page=1,pages=1,search=String(query).trim(),areaId=String(area||''),generation=0,displayedUsers=new Map();
 const chosen=new Map((selected||[]).map(user=>[Number(user.id),user]));
 const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('es');
 const updateSelection=()=>{const count=$('#worker-selected-count');if(count)count.textContent=`${chosen.size} de ${maxSelect} seleccionados`;const apply=$('#worker-apply');if(apply)apply.disabled=!chosen.size;};
 async function showWorkers(next=1){
  if(!modal)return;const seq=++generation;page=next;const root=$('#worker-cards');root.setAttribute('aria-busy','true');root.innerHTML='<p class="empty">Cargando trabajadores…</p>';
  try{
   const data=await Catalog.users({q:search,area:areaId,rol:'trabajador',page,limit:10});if(!modal||seq!==generation)return;page=data.page;pages=data.pages;displayedUsers=new Map(data.users.map(user=>[Number(user.id),user]));
   root.innerHTML=data.users.map(u=>`<button type="button" class="worker-card" data-id="${u.id}" ${multiple?`aria-pressed="${chosen.has(Number(u.id))}"`:''}><span class="worker-avatar">${u.tiene_foto?`<img class="worker-photo" src="/api/user-photo/${u.empleado_id}" alt="Foto de ${esc(u.nombre)}" loading="lazy">`:''}<span class="worker-initials" ${u.tiene_foto?'hidden':''}>${esc(initials(u.nombre))}</span></span><strong>${esc(u.nombre)}</strong><span>${esc(u.cargo||'Cargo no asignado')}</span><small>${esc(u.area||'Área no asignada')}</small>${multiple?`<span class="sr-only">${chosen.has(Number(u.id))?'Seleccionado':'No seleccionado'}</span>`:''}</button>`).join('')||'<p class="empty">No se encontraron trabajadores.</p>';
   $('#worker-results').textContent=`Página ${page} de ${pages} · ${data.total} trabajadores`;
   $('#worker-prev').disabled=page<=1;$('#worker-next').disabled=page>=pages;$('#worker-pagination').hidden=pages<=1;updateSelection();
  }catch(error){if(modal&&seq===generation)root.innerHTML=`<p class="empty">${esc(error.message)}</p>`;}
  finally{if(modal&&seq===generation)root.setAttribute('aria-busy','false');}
 }
 const areaControl=multiple?'<label class="worker-modal-search">Área<select class="input plain" id="worker-modal-area"><option value="">Todas las áreas</option></select></label>':'';
 const multiControls=multiple?'<div class="worker-picker-actions"><span id="worker-selected-count" class="muted" role="status"></span><button id="worker-select-page" class="btn outline sm" type="button">Seleccionar página</button></div>':'';
 const applyControl=multiple?'<div class="modal-actions"><button type="button" class="btn outline" data-close>Cancelar</button><button id="worker-apply" class="btn" type="button" disabled>Usar seleccionados</button></div>':'';
 modal=openModal({title:multiple?'Seleccionar destinatarios':'Seleccionar trabajador',wide:true,html:`<label class="worker-modal-search">Buscar por nombre o código<input class="input plain" id="worker-modal-search" type="search" autocomplete="off"></label>${areaControl}${multiControls}<p id="worker-results" class="muted" role="status"></p><div id="worker-cards" class="worker-card-grid" aria-live="polite"></div><nav id="worker-pagination" class="worker-card-pagination" aria-label="Páginas de trabajadores" hidden><button id="worker-prev" class="btn outline" type="button">Anterior</button><button id="worker-next" class="btn outline" type="button">Siguiente</button></nav>${applyControl}`,onClose:()=>{generation++;modal=null;}});
 modal.el.classList.add('worker-directory');const input=$('#worker-modal-search');input.value=search;
 input.addEventListener('input',debounce(()=>{search=input.value.trim();showWorkers(1);},250));
 $('#worker-prev').onclick=()=>showWorkers(page-1);$('#worker-next').onclick=()=>showWorkers(page+1);
 $('#worker-cards').addEventListener('error',event=>{if(!event.target.matches('.worker-photo'))return;event.target.hidden=true;event.target.nextElementSibling.hidden=false;},true);
 $('#worker-cards').addEventListener('click',event=>{const card=event.target.closest('[data-id]');if(!card)return;const worker=displayedUsers.get(Number(card.dataset.id));if(!worker)return;
  if(!multiple){onSelect?.(worker);modal?.close();return;}
  if(chosen.has(Number(worker.id)))chosen.delete(Number(worker.id));else {if(chosen.size>=maxSelect){$('#worker-results').textContent=`Puedes seleccionar hasta ${maxSelect} trabajadores por tarea.`;return;}chosen.set(Number(worker.id),worker);}
  card.setAttribute('aria-pressed',String(chosen.has(Number(worker.id))));updateSelection();
 });
 if(multiple){
  const areaSelect=$('#worker-modal-area');
  WorkAreas.list().then(data=>{if(!modal)return;for(const item of data.areas)areaSelect.add(new Option(item.nombre,String(item.id)));areaSelect.add(new Option('Sin área asignada','sin-area'));areaSelect.value=areaId;}).catch(error=>{$('#worker-results').textContent=error.message;});
  areaSelect.onchange=()=>{areaId=areaSelect.value;showWorkers(1);};
  $('#worker-select-page').onclick=()=>{for(const worker of displayedUsers.values()){if(chosen.has(Number(worker.id)))continue;if(chosen.size>=maxSelect)break;chosen.set(Number(worker.id),worker);}showWorkers(page);};
  $('#worker-apply').onclick=()=>{onApply?.([...chosen.values()]);modal?.close();};
 }
 showWorkers(1);return modal;
}
