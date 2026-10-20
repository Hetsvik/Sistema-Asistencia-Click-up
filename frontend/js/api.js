// Cliente HTTP único: todas las llamadas al backend pasan por aquí.
import { API, ROUTES } from './config.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

async function request(method, url, { body, params, silent401 = false } = {}) {
  let res;
  try {
    res = await fetch(url + qs(params), {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !silent401 && location.pathname !== ROUTES.login) {
      location.replace(ROUTES.login);
    }
    throw new ApiError(res.status, data.detail || 'Ocurrió un error inesperado.');
  }
  return data;
}

export const Auth = {
  login: (codigo, pin, esAdmin) => request('POST', API.login, { body: { codigo, pin, es_admin: esAdmin }, silent401: true }),
  logout: () => request('POST', API.logout, { silent401: true }),
  me: (opts) => request('GET', API.me, opts),
};

export const Attendance = {
  today: () => request('GET', API.attendanceToday),
  checkIn: () => request('POST', API.checkIn),
  checkOut: () => request('PUT', API.checkOut),
  list: (params) => request('GET', API.attendance, { params }),
};

export const Tasks = {
  list: (params) => request('GET', API.tasks, { params }),
  get: (id) => request('GET', API.task(id)),
  create: (body) => request('POST', API.tasks, { body }),
  setStatus: (id, estado, observaciones, expected_estado) => request('PUT', API.taskStatus(id), { body: { estado, observaciones, expected_estado } }),
  comments: (id) => request('GET', API.taskComments(id)),
  addComment: (id, mensaje) => request('POST', API.taskComments(id), { body: { mensaje } }),
};

export const Catalog = {
  projects: (params) => request('GET', API.projects, {params}),
  users: (q) => request('GET', API.users, { params: { q } }),
};

export const Reports = {
  summary: (params) => request('GET', API.reportSummary, { params }),
};

// Nuevos módulos. El catálogo Catalog.users sigue siendo compatible con Tareas y Reportes.
export const Announcements = {
  list: (params) => request('GET', API.announcements, { params }),
  create: (body) => request('POST', API.announcements, { body }),
};
export const ManagedUsers = {
  list: (params) => request('GET', API.managedUsers, { params }),
  get: (id) => request('GET', API.managedUser(id)),
  create: (body) => request('POST', API.managedUsers, { body }),
  update: (id, body) => request('PUT', API.managedUser(id), { body }),
  setStatus: (id, estado) => request('PUT', API.managedUserStatus(id), { body: { estado } }),
};

export const Notifications = {
 list: params => request('GET',API.notifications,{params}),
 clear: through_id => request('POST',API.clearNotifications,{body:{through_id}}),
};
export const Projects = {
 list: params => request('GET',API.projects,{params}),
 create: body => request('POST',API.projects,{body}),
};