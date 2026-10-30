// Utilidades de interfaz reutilizables (sin dependencias).

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para insertarlo en innerHTML. Úsalo SIEMPRE con datos que vengan de la API. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const truncate = (text, max = 50) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text ?? '');

const pad = (n) => String(n).padStart(2, '0');
// DATE y DATETIME sin offset de D1 ya representan el calendario/hora local de Perú.
// NO usar new Date('YYYY-MM-DD'): JavaScript lo interpreta como UTC y resta un día en Lima.
const displayParts = (value) => {
  if(value===null||value===undefined||value==='')return null;
  const s=String(value),m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if(m){
    const [year,month,day]=m.slice(1,4).map(Number),d=new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if(!Number.isFinite(d.getTime())||d.getUTCFullYear()!==year||d.getUTCMonth()+1!==month||d.getUTCDate()!==day||Number(m[4]||0)>23||Number(m[5]||0)>59||Number(m[6]||0)>59)return null;
    return {year:m[1],month:m[2],day:m[3],hour:m[4]||'00',minute:m[5]||'00'};
  }
  // Solamente instantes explícitos con Z/offset se convierten a America/Lima.
  if(!(value instanceof Date)&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(s))return null;
  const d=value instanceof Date?value:new Date(s);if(!Number.isFinite(d.getTime()))return null;
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
};
export const fmtDate = s => {const p=displayParts(s);return p?`${p.day}/${p.month}/${p.year.slice(-2)}`:'—';};
export const fmtTime = s => {const p=displayParts(s);return p?`${p.hour}:${p.minute}`:'—';};
export const fmtDateTime = s => {const p=displayParts(s);return p?`${p.day}/${p.month}/${p.year.slice(-2)} ${p.hour}:${p.minute}`:'—';};

export const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  mega: '<path d="M3 11v3a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 9a4 4 0 010 6M18 6a8 8 0 010 12"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.4.6 4 2.5 4 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  out: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  in: '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l-5-5 5-5M5 12h12"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

// ---------- Toasts ----------
export function toast(message, type = 'info') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3800);
}

// ---------- Botones con estado de carga ----------
export async function withBusy(button, task) {
  if (!button) return task();
  const label = button.innerHTML;
  button.disabled = true;
  button.classList.add('loading');
  try { return await task(); } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = label;
  }
}

// ---------- Modal accesible (<dialog>) ----------
export function openModal({ title, html, wide = false, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal${wide ? ' wide' : ''}`;
  dialog.innerHTML = `
    <div class="modal-head"><h2>${esc(title)}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Cerrar">${icon('close')}</button></div>
    <div class="modal-body">${html}</div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.addEventListener('close', () => { onClose?.(); dialog.remove(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.closest('[data-close]')) close(); });
  dialog.showModal();
  return { el: dialog, close };
}

export const badgePrioridad = (p) => (p ? `<span class="badge ${p.toLowerCase()}">${esc(p)}</span>` : '<span class="muted">—</span>');
export const badgeEstado = (e) => `<span class="badge estado-${esc(e).toLowerCase().replace(/\s+/g, '-')}">${esc(e)}</span>`;
