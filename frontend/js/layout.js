// Estructura común de las páginas internas: barra lateral, notificaciones y guardas de sesión.
import { Tasks } from './api.js';
import { notificationKey, visibleNotifications } from './task-events.js';
import { NAV, POLL_NOTIFICATIONS_MS, ROL_LABEL, ROUTES } from './config.js';
import { requireSession, logout } from './session.js';
import { $, $$, esc, fmtDateTime, icon, toast } from './ui.js';

const sidebarHtml = (user, page) => {
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.rol)).map((n) => {
    const href = n.soon ? '#' : n.href(user.rol);
    return `<a href="${href}" class="${n.key === page ? 'active' : ''}" ${n.soon ? 'data-soon' : ''}>${icon(n.icon)}${n.label}</a>`;
  }).join('');
  const first = esc(user.nombre.split(' ')[0]);
  return `
  <aside class="sidebar" aria-label="Menú principal">
    <div class="brand"><span class="mark">A</span>Arquitectura &amp; SG</div>
    <div class="profile">
      <div class="avatar"><span>${icon('user')}</span></div>
      <small>Bienvenido</small>
      <strong title="${esc(user.nombre)}">${first}</strong><br>
      <span class="role">${ROL_LABEL[user.rol]}</span>
    </div>
    <nav class="nav">${items}<div class="sep"></div>
      <a href="#" data-soon>${icon('cog')}Configuración</a>
      <a href="${ROUTES.login}" class="logout" data-logout>${icon('out')}Cerrar Sesión</a>
    </nav>
  </aside>`;
};

/** Notificaciones: tareas vencidas o con plazo en las próximas 24 h. */
function initNotifications(user) {
  const bell = $('#bell'), panel = $('#notif-panel');
  if (!bell || !panel) return;
  const storageKey = `erp:notifications:v1:${user.empleado_id ?? `${user.rol}:${user.id}`}`;
  let dismissed = [], urgent = [], busy = false, signature = ''; 
  try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) dismissed = saved.filter(x => typeof x === 'string'); } catch { /* almacenamiento privado no disponible */ }
  bell.setAttribute('aria-controls', 'notif-panel');
  bell.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-label', 'Notificaciones');
  const paint = () => {
    const items = visibleNotifications(urgent, dismissed);
    const nextSignature = JSON.stringify(items);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const scroll = $('.notif-list', panel)?.scrollTop || 0;
    const hadFocus = panel.contains(document.activeElement);
    $('.dot', bell)?.toggleAttribute('hidden', !items.length);
    panel.innerHTML = `<div class="notif-head">Notificaciones <span class="notif-count">${items.length}</span></div>
      <div class="notif-list" tabindex="0" role="region" aria-label="Lista de notificaciones">${items.length
        ? items.map(t => `<a class="notif-item" href="${ROUTES[user.rol].tareas}?tarea=${encodeURIComponent(t.id)}"><strong>${esc(t.proyecto)}</strong><span>${esc(t.descripcion)}</span><span>Vence ${fmtDateTime(t.fecha_entrega)}</span></a>`).join('')
        : '<p class="notif-empty">No tienes notificaciones nuevas.</p>'}</div>
      <div class="notif-footer"><button type="button" class="notif-clear" ${items.length ? '' : 'disabled'}>Eliminar todas</button></div>`;
    $('.notif-list', panel).scrollTop = scroll;
    if (hadFocus) $('.notif-clear', panel).disabled ? $('.notif-list', panel).focus() : $('.notif-clear', panel).focus();
  };
  const refresh = async () => {
    if (busy) return;
    busy = true;
    try { urgent = (await Tasks.list({ notifications: '1' })).tasks; paint(); }
    catch { /* no interrumpir la página ni borrar el estado previo */ }
    finally { busy = false; }
  };
  panel.addEventListener('click', e => {
    if (!e.target.closest('.notif-clear')) return;
    e.stopPropagation();
    dismissed = [...new Set([...dismissed, ...urgent.map(notificationKey)])];
    try { localStorage.setItem(storageKey, JSON.stringify(dismissed)); } catch { toast('Se limpiaron por esta sesión; el navegador no permite guardar la preferencia.'); }
    paint();
  });
  const close = () => { panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); };
  bell.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; bell.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) refresh(); });
  document.addEventListener('click', e => { if (!panel.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { close(); bell.focus(); } });
  window.addEventListener('storage', e => {
    if (e.key !== storageKey) return;
    try { const value = JSON.parse(e.newValue || '[]'); dismissed = Array.isArray(value) ? value.filter(x => typeof x === 'string') : []; paint(); } catch { /* ignorar valores ajenos */ }
  });
  refresh();
  setInterval(refresh, POLL_NOTIFICATIONS_MS);
}

/**
 * Punto de entrada de cada página interna.
 * @param {{role: 'admin'|'trabajador', page: string}} opts
 */
export async function initPage({ role, page }) {
  let user;
  try {
    user = await requireSession(role);
  } catch (err) {
    if (err.status === 401) await new Promise(() => {}); // api.js ya está redirigiendo al login
    document.body.classList.remove('is-loading');
    toast(err.message || 'No se pudo cargar la página.', 'error');
    throw err;
  }
  document.body.insertAdjacentHTML('afterbegin', '<input type="checkbox" id="menu-check" aria-hidden="true" tabindex="-1">');
  $('.app').insertAdjacentHTML('afterbegin', sidebarHtml(user, page));

  $$('[data-soon]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast('Esta sección estará disponible pronto.'); }));
  $('[data-logout]').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  initNotifications(user);
  document.body.classList.remove('is-loading');
  return user;
}