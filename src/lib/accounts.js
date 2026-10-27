import { HttpError } from './http.js';

// Campos controlados por el servidor, nunca por parámetros o JSON del cliente.
export const ACCOUNT_TYPES = {
  admin: { table: 'Administrador', id: 'ID_Administrador', code: 'Codigo_Administrador', roleId: 2 },
  trabajador: { table: 'Trabajadores', id: 'ID_Trabajador', code: 'Codigo_Trabajador', roleId: 1 },
};

/** Revalida cada sesión: desactivar, cambiar contraseña o rol invalida las cookies anteriores. */
export async function validateAccountSession(env, user) {
  const a = ACCOUNT_TYPES[user.rol];
  if (!a) throw new HttpError(401, 'Sesión no válida.');
  const row = await env.DB.prepare(`SELECT E.ID_Empleado AS empleado_id, E.Nombre_Completo AS nombre,
      E.Estado AS estado, I.Correo_Corporativo AS correo, I.Requiere_Clave AS reset, COALESCE(C.Rol, ?) AS rol, COALESCE(C.Version_Sesion,0) AS version
      FROM ${a.table} A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado
      LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado LEFT JOIN Identidad_Usuario I ON I.ID_Empleado=E.ID_Empleado WHERE A.${a.id}=?`)
    .bind(user.rol, user.id).first();
  if (!row || row.reset || row.estado !== 'Activo' || row.rol !== user.rol || row.version !== (user.version ?? 0)) {
    throw new HttpError(401, 'La cuenta cambió o fue desactivada. Inicia sesión nuevamente.');
  }
  return { ...user, empleado_id: row.empleado_id, nombre: row.nombre, correo:row.correo };
}
