// Sesión del usuario: la fuente de verdad es la cookie HttpOnly del servidor (/api/auth/me).
import { toast } from './ui.js';
import { Auth } from './api.js';
import { ROUTES } from './config.js';

/**
 * Exige sesión activa. Si el rol no coincide con la página, redirige al inicio del rol real.
 * @param {'admin'|'trabajador'} [rolEsperado]
 */
export async function requireSession(rolEsperado) {
  const { user } = await Auth.me(); // un 401 redirige al login desde api.js
  if (rolEsperado && user.rol !== rolEsperado) {
    location.replace(ROUTES[user.rol].inicio);
    await new Promise(() => {}); // detiene la carga de la página mientras redirige
  }
  return user;
}

export async function logout() {
  try { await Auth.logout(); location.replace(ROUTES.login); }
  catch { toast('No se pudo confirmar el cierre de sesión. Revisa tu conexión y vuelve a intentarlo.','error'); }
}
