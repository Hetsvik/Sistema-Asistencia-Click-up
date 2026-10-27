// Hash de PIN (PBKDF2-SHA256) y comparación en tiempo constante.
// No se aceptan credenciales heredadas en texto plano.

const ITERATIONS = 100_000; // máximo permitido por Workers para PBKDF2
const enc = new TextEncoder();

export const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
export const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(secret, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export function timingSafeEqual(a, b) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export const needsRehash = (stored) => !String(stored).startsWith('pbkdf2$');

export async function verifyPin(pin, stored) {
  stored = String(stored ?? '');
  if (stored.startsWith('pbkdf2$')) {
    const [, iterations, salt, hash] = stored.split('$');
    try {
      if(Number(iterations)!==ITERATIONS||fromB64(salt).length!==16||fromB64(hash).length!==32)return false;
      const candidate = await pbkdf2(pin, fromB64(salt), Number(iterations));
      return timingSafeEqual(candidate, fromB64(hash));
    }catch{return false;}
  }
  return false; // Nunca aceptar texto plano ni credenciales deshabilitadas.
}
