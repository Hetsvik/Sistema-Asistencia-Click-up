// Configuración central del frontend: rutas de páginas, endpoints de la API y menú.
// Si cambias una URL, cámbiala solo aquí.

export const ROUTES = {
  login: '/',
  admin: {
    inicio: '/admin/inicio',
    asistencia: '/admin/asistencia',
    tareas: '/admin/tareas',
    reportes: '/admin/reportes',
  },
  trabajador: {
    inicio: '/usuarios/inicio',
    asistencia: '/usuarios/asistencia',
    tareas: '/usuarios/tareas',
    reportes: '/usuarios/reportes',
  },
};

export const API = {
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  attendanceToday: '/api/attendance/today',
  checkIn: '/api/attendance/check-in',
  checkOut: '/api/attendance/check-out',
  attendance: '/api/attendance',
  tasks: '/api/tasks',
  task: (id) => `/api/tasks/${id}`,
  taskStatus: (id) => `/api/tasks/${id}/status`,
  taskComments: (id) => `/api/tasks/${id}/comments`,
  projects: '/api/projects',
  users: '/api/users',
  reportSummary: '/api/reports/summary',
};

/** Elementos del menú lateral. `soon: true` = aún sin página (muestra aviso). */
export const NAV = [
  { key: 'inicio', label: 'Inicio', icon: 'home', href: (rol) => ROUTES[rol].inicio },
  { key: 'anuncios', label: 'Anuncios', icon: 'mega', soon: true },
  { key: 'calendario', label: 'Calendario', icon: 'cal', soon: true },
  { key: 'usuarios', label: 'Usuarios', icon: 'users', soon: true, roles: ['admin'] },
  { key: 'cuenta', label: 'Cuenta', icon: 'user', soon: true },
];

export const ESTADOS = ['Asignada', 'En Progreso', 'Completada'];
export const ROL_LABEL = { admin: 'Administrador', trabajador: 'Usuario' };
export const POLL_COMMENTS_MS = 8000;
export const POLL_NOTIFICATIONS_MS = 60000;
