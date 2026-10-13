// Manejo de fechas "locales" (la BD guarda texto 'YYYY-MM-DD HH:MM:SS' sin zona horaria).
// D1 corre en UTC, por eso la hora local se calcula aquí con la zona configurada en wrangler.toml.

export const DEFAULT_TZ = 'America/Lima';

export function nowLocal(tz = DEFAULT_TZ, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const fecha = `${parts.year}-${parts.month}-${parts.day}`;
  const hora = `${parts.hour}:${parts.minute}:${parts.second}`;
  return { fecha, hora, fechaHora: `${fecha} ${hora}` };
}

/** 'YYYY-MM-DD[ T]HH:MM[:SS]' -> milisegundos (interpretados todos como UTC para poder restarlos). */
export function toMs(value) {
  if (!value) return NaN;
  const s = String(value).trim().replace(' ', 'T');
  return Date.parse((s.length === 10 ? `${s}T00:00:00` : s) + 'Z');
}

/** Valida y normaliza a 'YYYY-MM-DD HH:MM:SS'. Devuelve null si no es válida. */
export function normalizeDateTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const out = `${m[1]} ${m[2]}:${m[3] ?? '00'}`;
  return Number.isNaN(toMs(out)) ? null : out;
}

export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toMs(value));
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

export function weekRange(fecha) {
  const ms = toMs(fecha);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // lunes = 0
  return { desde: iso(ms - dow * DAY), hasta: iso(ms + (6 - dow) * DAY) };
}

export function monthRange(fecha) {
  const d = new Date(toMs(fecha));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return { desde: iso(Date.UTC(y, m, 1)), hasta: iso(Date.UTC(y, m + 1, 0)) };
}

/** Días lunes-viernes entre dos fechas (inclusive). */
export function workdaysBetween(desde, hasta) {
  let count = 0;
  for (let ms = toMs(desde); ms <= toMs(hasta); ms += DAY) {
    const dow = new Date(ms).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/** Prioridad derivada del plazo (la tabla Tareas no tiene columna de prioridad). */
export function priorityFor(fechaEntrega, estado, ahora) {
  if (estado === 'Completada' || !fechaEntrega) return null;
  const horas = (toMs(fechaEntrega) - toMs(ahora)) / 3_600_000;
  if (horas <= 24) return 'Alta';
  if (horas <= 72) return 'Media';
  return 'Baja';
}
