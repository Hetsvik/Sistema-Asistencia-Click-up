// Reloj estimado desde una respuesta del servidor y tiempo monotónico del navegador.
// Date.now() del dispositivo NO participa. La BD siempre se marca en el servidor.
export function createServerClock(monotonic=()=>performance.now()){
 let epoch=null,anchor=0;
 return {
  sync(serverEpoch,requestStart=monotonic()){
   if(!Number.isFinite(serverEpoch))throw new Error('El servidor no proporcionó una hora válida. Actualiza la página.');
   const received=monotonic(),rtt=Math.max(0,received-requestStart);
   if(rtt>15000){epoch=null;throw new Error('La sincronización tardó demasiado. Comprueba tu conexión y vuelve a intentarlo.');}
   epoch=serverEpoch+rtt/2;anchor=received;
  },
  now(){return epoch===null?null:new Date(epoch+Math.max(0,monotonic()-anchor));},
  invalidate(){epoch=null;}
 };
}
export function historyStart(fecha){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))throw new Error('Fecha del servidor no válida.');
 const d=new Date(fecha+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-29);return d.toISOString().slice(0,10);
}
