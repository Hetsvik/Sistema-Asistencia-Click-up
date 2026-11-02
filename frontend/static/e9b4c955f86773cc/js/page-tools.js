import { $, esc } from './ui.js';
export function message(error) {
  const el = $('#page-message');
  el.hidden = !error;
  el.textContent = error?.message || (typeof error === 'string' ? error : '');
}
export function pager(data,change,{element=$('#pagination'),onSize}={}){
 const el=element;if(!el)return;
 el.classList.add('list-pagination');el.setAttribute('aria-label','Paginación del listado');
 el.innerHTML=`<span role="status">${data.total} resultados · Página ${data.page} de ${data.pages}</span><div class="pager-actions"><button class="btn outline sm" data-prev type="button" ${data.page<=1?'disabled':''}>Anterior</button><button class="btn outline sm" data-next type="button" ${data.page>=data.pages?'disabled':''}>Siguiente</button><label>Ir a página<input class="input plain" data-page type="number" min="1" max="${data.pages}" value="${data.page}" inputmode="numeric"></label><button class="btn outline sm" data-go type="button">Ir</button>${onSize?`<label>Por página<select class="input plain" data-size>${[10,20,50,100].filter(n=>n<=(data.max_limit||100)).map(n=>`<option ${n===data.limit?'selected':''}>${n}</option>`).join('')}</select></label>`:''}</div>`;
 $('[data-prev]',el).onclick=()=>change(data.page-1);$('[data-next]',el).onclick=()=>change(data.page+1);
 const go=()=>{const n=$('[data-page]',el);if(n.reportValidity())change(Number(n.value));};$('[data-go]',el).onclick=go;$('[data-page]',el).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go();}};
 if(onSize)$('[data-size]',el).onchange=e=>onSize(Number(e.target.value));
}
export function enableMenuKeyboard() {
  const toggle = $('.menu-toggle');
  toggle?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const box=$('#menu-check'); if(box) box.checked=!box.checked; }
  });
}
// La API entrega fecha local de Perú sin zona. Se formatea como texto, sin desplazarla al huso del navegador.
export function peruDateTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(value || '');
  return m ? `${m[3]}/${m[2]}/${m[1]} · ${m[4]}` : '—';
}
export const roles = {admin:'Administrador',trabajador:'Trabajador'};
export const safe = esc;
