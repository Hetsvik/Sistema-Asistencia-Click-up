// Cookie firmada y sesión individual revocable en D1. Sin compatibilidad con cookies antiguas.

import { HttpError } from './http.js';
import { toB64, fromB64, timingSafeEqual } from './security.js';

export const COOKIE_NAME = 'erp_session';
export const SESSION_TTL = 60 * 60 * 8; // 8 horas
const enc = new TextEncoder();

const b64u = (bytes) => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function hmac(env, data) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new HttpError(500, 'Falta configurar SESSION_SECRET (ver README).');
  }
  const key = await crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function signSession(env, user, ttl = SESSION_TTL) {
  const exp=Math.floor(Date.now()/1000)+ttl,sid=crypto.randomUUID();
  const payload=b64u(enc.encode(JSON.stringify({...user,sid,exp})));
  const token=`${payload}.${b64u(await hmac(env,payload))}`;
  await env.DB.prepare('INSERT INTO Sesiones_Seguras(ID,ID_Empleado,Expira) VALUES(?,?,?)').bind(sid,user.empleado_id,exp).run();
  return token;
}

export async function readSession(request, env) {
  const cookie = request.headers.get('Cookie') ?? '';
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  if(match.length>4096)return null;
  const parts=match.slice(COOKIE_NAME.length+1).split('.');if(parts.length!==2)return null;
  const [payload,sig]=parts;
  if (!payload || !sig) return null;
  try {
    const expected = await hmac(env, payload);
    if (!timingSafeEqual(expected, unb64u(sig))) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(payload)));
    if(!data.sid||data.exp<=Date.now()/1000)return null;
    const session=await env.DB.prepare('SELECT ID_Empleado AS empleado_id FROM Sesiones_Seguras WHERE ID=? AND Expira>?').bind(data.sid,Math.floor(Date.now()/1000)).first();
    return session?.empleado_id===data.empleado_id?data:null;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    return null;
  }
}

export function sessionCookie(token, url, maxAge = SESSION_TTL) {
  const secure = new URL(url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export const clearCookie = (url) => sessionCookie('', url, 0);
