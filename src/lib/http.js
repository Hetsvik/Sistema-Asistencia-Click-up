// Utilidades HTTP compartidas por todas las rutas de la API.

export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export const fail = (status, detail, headers = {}) => json({ detail }, status, headers);

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición debe ser un JSON válido.');
  }
}

/** Convierte un parámetro de query en entero acotado. */
export function intParam(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, 'Parámetro numérico inválido.');
  return n;
}

export function text(value, { field, min = 1, max = 500, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} es obligatorio.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} no es válido.`);
  const v = value.trim();
  if (v.length < min) throw new HttpError(400, `${field} es obligatorio.`);
  if (v.length > max) throw new HttpError(400, `${field} no puede superar ${max} caracteres.`);
  return v;
}
