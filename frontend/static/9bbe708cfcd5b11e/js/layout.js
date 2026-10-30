// Estructura común de las páginas internas: barra lateral, notificaciones y guardas de sesión.
import { applyPreferences } from './preferences.js';
import { initNotifications } from './notifications.js';
import { NAV, ROL_LABEL, ROUTES } from './config.js';
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
      <a href="${ROUTES[user.rol].configuracion}" class="${page==='configuracion'?'active':''}">${icon('cog')}Configuración</a>
      <a href="${ROUTES.login}" class="logout" data-logout>${icon('out')}Cerrar Sesión</a>
    </nav>
  </aside>`;
};

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
  applyPreferences(user);
  window.addEventListener('storage',e=>{if(e.key===`erp:preferences:${user.empleado_id}`||e.key===null){applyPreferences(user);document.dispatchEvent(new Event('erp:preferences'));}});
  initNotifications(user);
  document.body.classList.remove('is-loading');
  return user;
}