import {Catalog} from './api.js';
import {debounce,esc,openModal} from './ui.js';

export function openWorkerPicker({query='',onSelect}){
 let modal=null,page=1,pages=1,search=String(query).trim(),generation=0;
 const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('es');
 async function showWorkers(next=1){
  if(!modal)return;const seq=++generation;page=next;const root=$('#worker-cards');root.setAttribute('aria-busy','true');root.innerHTML='<p class="empty">Cargando trabajadores…</p>';
  try{
   const data=await Catalog.users({q:search,page,limit:12});if(!modal||seq!==generation)return;page=data.page;pages=data.pages;
   root.innerHTML=data.users.map(u=>`<button type="button" class="worker-card" data-id="${u.id}"><span class="worker-avatar">${u.tiene_foto?`<img class="worker-photo" src="/api/user-photo/${u.empleado_id}" alt="Foto de ${esc(u.nombre)}" loading="lazy">`:''}<span class="worker-initials" ${u.tiene_foto?'hidden':''}>${esc(initials(u.nombre))}</span></span><strong>${esc(u.nombre)}</strong><span>${esc(u.cargo||'Cargo no asignado')}</span><small>${esc(u.area||'Área no asignada')}</small></button>`).join('')||'<p class="empty">No se encontraron trabajadores.</p>';
   $('#worker-results').textContent=`Página ${page} de ${pages} · ${data.total} trabajadores`;
   $('#worker-prev').disabled=page<=1;$('#worker-next').disabled=page>=pages;$('#worker-pagination').hidden=pages<=1;
  }catch(error){if(modal&&seq===generation)root.innerHTML=`<p class="empty">${esc(error.message)}</p>`;}
  finally{if(modal&&seq===generation)root.setAttribute('aria-busy','false');}
 }
 modal=openModal({title:'Seleccionar trabajador',wide:true,html:'<label class="worker-modal-search">Buscar por nombre o código<input class="input plain" id="worker-modal-search" type="search" autocomplete="off"></label><p id="worker-results" class="muted" role="status"></p><div id="worker-cards" class="worker-card-grid" aria-live="polite"></div><nav id="worker-pagination" class="worker-card-pagination" aria-label="Páginas de trabajadores" hidden><button id="worker-prev" class="btn outline" type="button">Anterior</button><button id="worker-next" class="btn outline" type="button">Siguiente</button></nav>',onClose:()=>{generation++;modal=null;}});
 modal.el.classList.add('worker-directory');const input=$('#worker-modal-search');input.value=search;
 input.addEventListener('input',debounce(()=>{search=input.value.trim();showWorkers(1);},250));
 $('#worker-prev').onclick=()=>showWorkers(page-1);$('#worker-next').onclick=()=>showWorkers(page+1);
 $('#worker-cards').addEventListener('error',event=>{if(!event.target.matches('.worker-photo'))return;event.target.hidden=true;event.target.nextElementSibling.hidden=false;},true);
 $('#worker-cards').addEventListener('click',event=>{const card=event.target.closest('[data-id]');if(!card)return;const id=Number(card.dataset.id);const user=[...$('#worker-cards').querySelectorAll('[data-id]')].find(element=>Number(element.dataset.id)===id);if(!user)return;const selected={id,nombre:user.querySelector('strong').textContent};onSelect?.(selected);modal?.close();});
 showWorkers(1);return modal;
}
