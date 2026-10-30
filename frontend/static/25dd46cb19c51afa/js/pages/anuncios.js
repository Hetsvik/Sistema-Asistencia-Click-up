import {routeState} from '../list-state.js';
import { Announcements } from '../api.js';
import { initPage } from '../layout.js';
import { $, $$, debounce, esc } from '../ui.js';
import { enableMenuKeyboard, message, pager, peruDateTime } from '../page-tools.js';

async function main() {
  await initPage({role:document.body.dataset.role,page:'anuncios'});
  enableMenuKeyboard();
  const route=routeState({page:1,limit:20,q:'',sort:'fecha',order:'desc'});
  let sort='fecha',order='desc',sequence=0;
  const restore=()=>{const s=route.read();sort=s.sort;order=s.order;$('#announcement-search').value=s.q;return s;};
  const load=async(page=1)=>{
    const seq=++sequence;
    message(null); $('#announcement-table').setAttribute('aria-busy','true');
    try {
      const data=await Announcements.list({q:$('#announcement-search').value.trim(),sort,order,page,limit:route.read().limit});
      if(seq!==sequence) return;
      $('#announcement-list').innerHTML=data.announcements.length ? data.announcements.map(a=>{
        const long=a.motivo.length>180;
        const preview=long ? a.motivo.slice(0,180).trimEnd()+'…' : a.motivo;
        return `<tr><td><h2 class="announcement-name">${esc(a.nombre)}</h2>${long
          ? `<p class="announcement-preview">${esc(preview)}</p><details class="announcement-details"><summary>Leer comunicado completo</summary><p class="announcement-reason">${esc(a.motivo)}</p></details>`
          : `<p class="announcement-reason">${esc(preview)}</p>`}</td><td><time class="announcement-date" datetime="${esc(a.fecha.replace(' ','T'))}-05:00">${peruDateTime(a.fecha)}</time></td></tr>`;
      }).join('') : '<tr><td colspan="2"><div class="module-empty">No hay anuncios para mostrar.</div></td></tr>';
      $$('[data-sort]').forEach(button=>{
        const selected=button.dataset.sort===sort;
        button.closest('th').setAttribute('aria-sort',selected?(order==='asc'?'ascending':'descending'):'none');
        $('[data-arrow]',button).textContent=selected?(order==='asc'?'↑':'↓'):'⇅';
        button.setAttribute('aria-label',`Ordenar por ${button.dataset.sort==='nombre'?'nombre':'fecha'} ${selected && order==='asc'?'de mayor a menor':'de menor a mayor'}`);
      });
      route.write({page:data.page,limit:data.limit,q:$('#announcement-search').value.trim(),sort,order});pager(data,load,{onSize:limit=>{route.write({limit,page:1});load();}});
    } catch(err) { if(seq===sequence) {message(err);$('#announcement-list').innerHTML='<tr><td colspan="2">No se pudieron cargar los anuncios. Cambia la búsqueda para volver a intentar.</td></tr>';$('#pagination').replaceChildren();} }
    finally { if(seq===sequence) $('#announcement-table').setAttribute('aria-busy','false'); }
  };
  $$('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
    const next=button.dataset.sort;
    order=next===sort?(order==='asc'?'desc':'asc'):(next==='nombre'?'asc':'desc');sort=next;load();
  }));
  $('#announcement-search').addEventListener('input',debounce(()=>load()));
  route.onChange(()=>load(restore().page));await load(restore().page);
}
main().catch(err=>console.error('Anuncios:',err));
