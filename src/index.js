// Punto de entrada del Worker.
//  - /api/*  -> API (D1)
//  - resto   -> archivos estáticos de /frontend (binding ASSETS)

import { Router } from './router.js';
import { HttpError, fail } from './lib/http.js';
import { readSession } from './lib/session.js';
import { DEFAULT_TZ } from './lib/dates.js';
import * as auth from './routes/auth.js';
import * as attendance from './routes/attendance.js';
import * as tasks from './routes/tasks.js';
import * as reports from './routes/reports.js';
import * as users from './routes/users.js';
import * as announcements from './routes/announcements.js';
import * as userManagement from './routes/user-management.js';
import { validateAccountSession } from './lib/accounts.js';

export const router = new Router();

// Autenticación
router.post('/api/auth/login', auth.login, { auth: false });
router.post('/api/auth/logout', auth.logout, { auth: false });
router.get('/api/auth/me', auth.me, { auth: 'any' });

// Asistencia
router.get('/api/attendance/today', attendance.today, { auth: 'trabajador' });
router.post('/api/attendance/check-in', attendance.checkIn, { auth: 'trabajador' });
router.put('/api/attendance/check-out', attendance.checkOut, { auth: 'trabajador' });
router.get('/api/attendance', attendance.list, { auth: 'any' });

// Tareas
router.get('/api/tasks', tasks.list, { auth: 'any' });
router.post('/api/tasks', tasks.create, { auth: 'admin' });
router.get('/api/tasks/:id', tasks.detail, { auth: 'any' });
router.put('/api/tasks/:id/status', tasks.updateStatus, { auth: 'any' });
router.get('/api/tasks/:id/comments', tasks.comments, { auth: 'any' });
router.post('/api/tasks/:id/comments', tasks.addComment, { auth: 'any' });

// Catálogos
router.get('/api/projects', tasks.projects, { auth: 'admin' });
router.get('/api/users', users.list, { auth: 'admin' });

// Anuncios: lectura para ambos roles, creación exclusiva del administrador.
router.get('/api/announcements', announcements.list, { auth: 'any' });
router.post('/api/announcements', announcements.create, { auth: 'admin' });

// Gestión de cuentas; /api/users conserva el catálogo de trabajadores.
router.get('/api/admin/users', userManagement.list, { auth: 'admin' });
router.post('/api/admin/users', userManagement.create, { auth: 'admin' });
router.get('/api/admin/users/:id', userManagement.detail, { auth: 'admin' });
router.put('/api/admin/users/:id', userManagement.update, { auth: 'admin' });
router.put('/api/admin/users/:id/status', userManagement.setStatus, { auth: 'admin' });

// Reportes
router.get('/api/reports/summary', reports.summary, { auth: 'any' });

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function handleApi(request, env) {
  const url = new URL(request.url);

  // Defensa CSRF adicional a SameSite=Lax: las mutaciones deben venir del mismo origen.
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return fail(403, 'Origen no permitido.');
  }

  const found = router.match(request.method, url.pathname);
  if (!found) return fail(404, 'Ruta no encontrada.');
  if (found.methodNotAllowed) return fail(405, 'Método no permitido.');

  const { route, params } = found;
  try {
    let user = null;
    if (route.options.auth) {
      user = await readSession(request, env);
      if (!user) throw new HttpError(401, 'Sesión no válida o expirada.');
      user = await validateAccountSession(env, user);
      if (route.options.auth !== 'any' && user.rol !== route.options.auth) {
        throw new HttpError(403, 'No tienes permisos para esta acción.');
      }
    }
    return await route.handler({ request, env, url, params, user, tz: env.TIMEZONE || DEFAULT_TZ });
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message, err.headers);
    console.error('[api]', request.method, url.pathname, err);
    return fail(500, 'Error interno del servidor.');
  }
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};