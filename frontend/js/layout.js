// Estructura común de las páginas internas: barra lateral, notificaciones y guardas de sesión.
import { Tasks } from './api.js';
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
function initNotifications() {
  const bell = $('#bell');
  const panel = $('#notif-panel');
  if (!bell || !panel) return;

  const refresh = async () => {
    try {
      const { tasks } = await Tasks.list();
      const urgent = tasks.filter((t) => t.estado !== 'Completada' && t.prioridad === 'Alta');
      $('.dot', bell)?.toggleAttribute('hidden', urgent.length === 0);
      panel.innerHTML = `<div class="notif-head">Notificaciones</div>` + (urgent.length
        ? urgent.map((t) => `<a class="notif-item" href="${location.pathname.split('/').slice(0, 2).join('/')}/tareas">
            <strong>${esc(t.proyecto)}</strong><span>Vence ${fmtDateTime(t.fecha_entrega)}</span></a>`).join('')
        : '<p class="notif-empty">No tienes notificaciones nuevas.</p>');
    } catch { /* las notificaciones nunca deben romper la página */ }
  };

  bell.addEventListener('click', (e) => { e.stopPropagation(); panel.toggleAttribute('hidden'); });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target)) panel.setAttribute('hidden', ''); });
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
  initNotifications();
  document.body.classList.remove('is-loading');
  return user;
}
