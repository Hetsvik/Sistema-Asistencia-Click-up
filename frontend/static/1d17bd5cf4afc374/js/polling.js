/** Un solo sondeo en vuelo, pausa offline/oculto y espera progresiva ante errores.
 * trigger() agrupa cambios ocurridos durante una petición; nunca solapa peticiones.
 */
export function createPoll(task,{interval=15000,maxDelay=120000,active=()=>true,onError=()=>{}}={}){
 let timer,busy=false,stopped=false,pending=false,failures=0;
 const available=()=>!document.hidden&&navigator.onLine!==false&&active();
 const schedule=()=>{clearTimeout(timer);if(!stopped&&available())timer=setTimeout(run,Math.min(maxDelay,interval*2**Math.min(failures,4)));};
 async function run(){clearTimeout(timer);if(stopped||!available())return;if(busy){pending=true;return;}busy=true;try{await task();failures=0;}catch(e){failures++;onError(e);}finally{busy=false;if(pending){pending=false;if(!stopped&&available())timer=setTimeout(run,failures?interval:0);}else schedule();}}
 const resume=()=>{clearTimeout(timer);if(available())run();};
 document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('offline',resume);
 const pause=()=>clearTimeout(timer);
 const stop=()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('pagehide',pause);};
 window.addEventListener('pagehide',pause);window.addEventListener('pageshow',resume);
 return {start:run,trigger:run,stop};
}
