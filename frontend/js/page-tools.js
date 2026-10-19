import { $, esc } from './ui.js';
export function message(error) {
  const el = $('#page-message');
  el.hidden = !error;
  el.textContent = error?.message || (typeof error === 'string' ? error : '');
}
export function pager(data, change) {
  const el = $('#pagination');
  el.innerHTML = `<span>${data.total} ${data.total === 1 ? 'resultado' : 'resultados'} · Página ${data.page} de ${data.pages}</span><div><button class="btn outline sm" data-prev type="button" ${data.page <= 1 ? 'disabled' : ''}>Anterior</button><button class="btn outline sm" data-next type="button" ${data.page >= data.pages ? 'disabled' : ''}>Siguiente</button></div>`;
  $('[data-prev]',el).onclick = () => change(data.page - 1);
  $('[data-next]',el).onclick = () => change(data.page + 1);
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
