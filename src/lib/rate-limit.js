import { HttpError } from './http.js';
// Reserva atómica ANTES de la operación costosa. No hay SELECT previo vulnerable a carreras.
export async function limit(db, scope, identifier, max, seconds) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identifier));
 const key=scope+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const window=Math.floor(Date.now()/1000/seconds)*seconds;
 const r=await db.prepare(`INSERT INTO Limites_Seguridad(Clave,Ventana,Usados) VALUES(?,?,1)
 ON CONFLICT(Clave) DO UPDATE SET Ventana=excluded.Ventana,
 Usados=CASE WHEN Ventana<>excluded.Ventana THEN 1 ELSE Usados+1 END
 WHERE Ventana<>excluded.Ventana OR Usados<? RETURNING Usados`).bind(key,window,max).first();
 if(!r)throw new HttpError(429,'Demasiadas solicitudes. Inténtalo más tarde.',{'Retry-After':String(window+seconds-Math.floor(Date.now()/1000))});
 return ()=>db.prepare('UPDATE Limites_Seguridad SET Usados=max(0,Usados-1) WHERE Clave=? AND Ventana=?').bind(key,window).run();
}
export async function cleanupSecurity(env){
 await env.DB.batch([
 env.DB.prepare('DELETE FROM Sesiones_Seguras WHERE Expira<=?').bind(Math.floor(Date.now()/1000)),
 env.DB.prepare('DELETE FROM Limites_Seguridad WHERE Ventana<?').bind(Math.floor(Date.now()/1000)-86400)
 ]);
}
