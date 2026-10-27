// Punto de entrada del Worker.
//  - /api/*  -> API (D1)
//  - resto   -> archivos estáticos de /frontend (binding ASSETS)

import { Router } from './router.js';
import { HttpError, fail } from './lib/http.js';
import { readSession } from './lib/session.js';
import { DEFAULT_TZ } from './lib/dates.js';
import * as attachments from './routes/attachments.js';
import * as auth from './routes/auth.js';
import * as attendance from './routes/attendance.js';
import * as tasks from './routes/tasks.js';
import * as reports from './routes/reports.js';
import * as account from './routes/account.js';
import * as projects from './routes/projects.js';
import * as notifications from './routes/notifications.js';
import * as users from './routes/users.js';
import * as announcements from './routes/announcements.js';
import * as userManagement from './routes/user-management.js';
import { preview } from './lib/identity.js';
import { limit,cleanupSecurity } from './lib/rate-limit.js';
import { secureResponse } from './lib/headers.js';
import { validateAccountSession } from './lib/accounts.js';

export const router = new Router();

// Autenticación
router.post('/api/auth/login', auth.login, { auth: false });
router.post('/api/auth/logout', auth.logout, { auth: false });
router.get('/api/auth/me', auth.me, { auth: 'any' });

// Asistencia
router.get('/api/attendance/daily', attendance.daily, { auth: 'admin' });
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

// Objetos privados R2: siempre autenticados y autorizados por tarea.
router.get('/api/storage/status',attachments.status,{auth:'any'});
router.post('/api/tasks/:id/attachments',attachments.send,{auth:'any'});
router.get('/api/tasks/:id/attachments/:attachment/download',attachments.download,{auth:'any'});

// Catálogos
router.get('/api/projects', projects.list, { auth: 'admin' });
router.post('/api/projects', projects.create, { auth: 'admin' });
router.get('/api/projects/:id', projects.detail, { auth: 'admin' });
router.put('/api/projects/:id', projects.update, { auth: 'admin' });
router.delete('/api/projects/:id', projects.remove, { auth: 'admin' });
router.get('/api/account', account.detail, { auth: 'any' });
router.put('/api/account', account.update, { auth: 'any' });
router.put('/api/account/password', account.password, { auth: 'any' });
router.get('/api/notifications', notifications.list, { auth: 'any' });
router.post('/api/notifications/clear', notifications.clear, { auth: 'any' });
router.get('/api/users', users.list, { auth: 'admin' });

// Anuncios: lectura para ambos roles, creación exclusiva del administrador.
router.get('/api/announcements', announcements.list, { auth: 'any' });
router.post('/api/announcements', announcements.create, { auth: 'admin' });

// Gestión de cuentas; /api/users conserva el catálogo de trabajadores.
router.post('/api/admin/users/preview-email',preview,{auth:'admin'});
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

  try {
  const found = router.match(request.method, url.pathname);
  if (!found) return fail(404, 'Ruta no encontrada.');
  if (found.methodNotAllowed) return fail(405, 'Método no permitido.');

  const { route, params } = found;
    let user = null;
    if (route.options.auth) {
      user = await readSession(request, env);
      if (!user) throw new HttpError(401, 'Sesión no válida o expirada.');
      user = await validateAccountSession(env, user);
      if (route.options.auth !== 'any' && user.rol !== route.options.auth) {
        throw new HttpError(403, 'No tienes permisos para esta acción.');
      }
    }
    if(user){
      await limit(env.DB,'api-account',String(user.empleado_id),600,60);
      if(MUTATING.has(request.method))await limit(env.DB,'write-account',String(user.empleado_id),60,60);
    }
    return await route.handler({ request, env, url, params, user, tz: env.TIMEZONE || DEFAULT_TZ });
  } catch (err) {
    if(err instanceof URIError)return fail(400,'Ruta mal codificada.');
    if (err instanceof HttpError) return fail(err.status, err.message, err.headers);
    console.error('[api]', request.method, url.pathname, err?.name||'Error');
    return fail(500, 'Error interno del servidor.');
  }
}

export default {
  async scheduled(event,env,ctx) {ctx.waitUntil(Promise.all([attachments.cleanup(env),cleanupSecurity(env)]));},
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/')) return secureResponse(await handleApi(request, env));
    return secureResponse(await env.ASSETS.fetch(request));
  },
};