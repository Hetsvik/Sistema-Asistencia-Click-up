// Bandeja de eventos persistentes. Un solo sondeo en vuelo, con pausa en segundo plano.
import { readPreferences,noticeVisible } from './preferences.js';
import { Notifications } from './api.js';
import { POLL_NOTIFICATIONS_MS, ROUTES } from './config.js';
import { $, esc, fmtDateTime, toast } from './ui.js';
export function notificationText(n) {
 const name=`«${n.nombre}»`;
 if (/^Vencimiento:(1|5|10|30|60)$/.test(n.tipo)) { const nmin=Number(n.tipo.split(':')[1]); return `Aviso de ${nmin} ${nmin===1?'minuto':'minutos'} para entregar ${name}.`; }
 return ({Asignada:`Se te ha asignado la tarea ${name}.`, 'En Progreso':`La tarea ${name} está en progreso; aún no está completada.`,
 'En revisión':`La tarea ${name} se ha entregado y está en revisión.`,Completada:`La tarea ${name} se ha completado y aprobado.`,
 Devuelta:`La tarea ${name} no se ha aprobado; requiere correcciones.`})[n.tipo] || `La tarea ${name} cambió a ${n.estado}.`;
}
export function initNotifications(user) {
 const bell=$('#bell'),panel=$('#notif-panel'); if(!bell||!panel)return;
 let items=[],cursor=0,before=null,more=false,initialized=false,busy=false,clearing=false,markingRead=false,readThrough=0,generation=0,timer,failures=0,signature='',browsingOlder=false;
 const showAlarms=user.rol==='trabajador'?alarmPopups(user):()=>{};
 bell.setAttribute('aria-controls','notif-panel');bell.setAttribute('aria-expanded','false');panel.setAttribute('aria-label','Notificaciones');
 const paint=()=>{
  const prefs=readPreferences(user),visible=items.filter(n=>noticeVisible(n,prefs)),unread=visible.filter(n=>n.id>readThrough);
  const next=JSON.stringify([items,more,failures>0,clearing,markingRead,readThrough,prefs]);if(signature===next)return;signature=next;
  const old=$('.notif-list',panel),scroll=old?.scrollTop||0,height=old?.scrollHeight||0;
  const focused=document.activeElement,focusId=focused?.dataset?.notice,focusClear=focused?.classList?.contains('notif-clear');
  $('.dot',bell)?.toggleAttribute('hidden',unread.length===0);
  panel.innerHTML=`<div class="notif-head"><span>Notificaciones</span><span class="notif-count">${visible.length}${more?'+':''}</span></div>
   ${failures?'<p class="notif-connection" role="status">Sin conexión. Se reintentará automáticamente.</p>':''}
   <div class="notif-list" tabindex="0" role="region" aria-label="Lista de notificaciones">${visible.length?visible.map(n=>{const unread=n.id>readThrough;return `<a class="notif-item${unread?' is-unread':''}" data-notice="${n.id}" href="${ROUTES[user.rol].tareas}?tarea=${encodeURIComponent(n.tarea_id)}"><span class="notif-status">${unread?'No leída':'Leída'}</span><strong>${esc(notificationText(n))}</strong><span>${esc(n.descripcion)}</span><span>Entrega: ${fmtDateTime(n.fecha_entrega)}</span>${n.tipo==='Devuelta'&&n.observaciones?`<span>Motivo: ${esc(n.observaciones)}</span>`:''}<time datetime="${esc(n.fecha)}">${esc(new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(n.fecha)))}</time></a>`;}).join(''):`<p class="notif-empty">${items.length?'No hay avisos visibles según tus preferencias.':'No tienes notificaciones nuevas.'}</p>`}${more?'<button type="button" class="notif-older">Ver anteriores</button>':''}</div>
   <div class="notif-footer"><button type="button" class="notif-read" ${!unread.length||markingRead?'disabled':''}>${markingRead?'Marcando…':'Marcar todas como leídas'}</button><button type="button" class="notif-clear" ${!items.length||clearing?'disabled':''}>${clearing?'Limpiando…':'Eliminar todas'}</button></div>`;
  const list=$('.notif-list',panel);list.scrollTop=scroll>0?Math.max(0,scroll+Math.max(0,list.scrollHeight-height)):0;
  if(focusId)$(`[data-notice="${focusId}"]`,panel)?.focus({preventScroll:true});
  if(focusClear)($('.notif-clear',panel).disabled?list:$('.notif-clear',panel)).focus({preventScroll:true});
 };
 const absorb=(data,{older=false,initial=false}={})=>{
  const hidden=data.cleared_through||0;readThrough=Math.max(readThrough,data.read_through||0);
  const map=new Map(items.filter(n=>n.id>hidden).map(n=>[n.id,n]));
  for(const n of data.notifications)if(n.id>hidden)map.set(n.id,n);
  items=[...map.values()].sort((a,b)=>b.id-a.id);

  if(!older)cursor=Math.max(cursor,data.cursor,hidden);
  if(initial||older){before=data.next_before;more=data.has_more;}
  if(items.length>200){items=older?items.slice(-200):items.slice(0,200);before=items.at(-1)?.id;if(!older)more=true;}
  paint();
  if(!older)showAlarms(data.notifications,data.servidor_utc);
  const changes=data.notifications.filter(n=>!n.tipo?.startsWith('Vencimiento:'));
  if(!initial&&!older&&changes.length)document.dispatchEvent(new CustomEvent('erp:task-events',{detail:changes}));
 };
 const schedule=()=>{clearTimeout(timer);if(!document.hidden&&navigator.onLine)timer=setTimeout(refresh,failures?Math.min(30000,POLL_NOTIFICATIONS_MS*2**Math.min(failures,4)):POLL_NOTIFICATIONS_MS);};
 async function refresh(){
  if(busy||clearing||markingRead||document.hidden||!navigator.onLine){schedule();return;}
  busy=true;const token=generation;
  try{
   const initial=!initialized,data=await Notifications.list(initial?{}:{since:cursor});
   if(token!==generation)return;
   failures=0;absorb(data,{initial});initialized=true;
   // Si llegaron >40 eventos juntos, se recuperan por cursor ascendente, sin saltos.
   // El siguiente sondeo continúa desde cursor si hay más eventos.
  }catch{if(token===generation){failures++;paint();}}
  finally{busy=false;schedule();}
 }
 async function older(){
  if(busy||!more||!before||clearing||markingRead)return;browsingOlder=true;busy=true;const token=generation;
  try{const data=await Notifications.list({before});if(token===generation){failures=0;absorb(data,{older:true});}}
  catch{failures++;paint();}finally{busy=false;}
 }
 panel.addEventListener('click',async e=>{
  if(e.target.closest('.notif-older')){e.stopPropagation();await older();return;}
  if(e.target.closest('.notif-read')){
   if(markingRead)return;e.stopPropagation();markingRead=true;paint();
   try{const data=await Notifications.read(cursor);readThrough=Math.max(readThrough,data.read_through||0);failures=0;}
   catch(err){toast(err.message||'No se pudieron marcar los avisos como leídos.','error');}
   finally{markingRead=false;paint();schedule();}return;
  }
  if(!e.target.closest('.notif-clear')||clearing)return;e.stopPropagation();
  clearing=true;generation++;paint();
  try{const data=await Notifications.clear(cursor);items=items.filter(n=>n.id>data.cleared_through);cursor=Math.max(cursor,data.cleared_through);more=false;before=null;failures=0;}
  catch(err){toast(err.message||'No se pudieron limpiar los avisos.','error');}
  finally{clearing=false;paint();schedule();}
 });
 const close=()=>{if(browsingOlder){browsingOlder=false;initialized=false;items=[];}panel.hidden=true;bell.setAttribute('aria-expanded','false');};
 bell.addEventListener('click',e=>{e.stopPropagation();if(!panel.hidden){close();return;}panel.hidden=false;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refresh();});
 document.addEventListener('click',e=>{if(!panel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();bell.focus();}});
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
 window.addEventListener('online',refresh);window.addEventListener('offline',()=>{clearTimeout(timer);failures++;paint();});
 window.addEventListener('pagehide',()=>clearTimeout(timer));
 document.addEventListener('erp:preferences',paint);
 window.addEventListener('storage',()=>{paint();});
 paint();refresh();
}

// Un reloj local compartido para todos los avisos; no se consulta el servidor cada segundo.
function alarmPopups(user){
 const root=document.createElement('section');root.className='deadline-alerts';root.setAttribute('aria-label','Avisos de entrega');document.body.append(root);
 const key=`erp:alarmas-vistas:${user.empleado_id}`;let offset=0;
 const seen=id=>{try{return JSON.parse(localStorage.getItem(key)||'[]').includes(id);}catch{return false;}};
 const mark=id=>{try{const a=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify([...a.filter(x=>x!==id),id].slice(-300)));}catch{}};
 const paint=()=>{for(const el of root.querySelectorAll('[data-deadline]')){
  const left=Math.max(0,Math.ceil((Number(el.dataset.deadline)-(Date.now()+offset))/1000));
  const h=Math.floor(left/3600),m=Math.floor(left%3600/60),s=left%60;
  el.querySelector('.deadline-left').textContent=left?`${h?`${h} h `:''}${m} min ${String(s).padStart(2,'0')} s`:'Plazo vencido';
 }};
 let ticker;const startTicker=()=>{clearInterval(ticker);ticker=setInterval(()=>{if(!document.hidden&&root.childElementCount)paint();},1000);};startTicker();window.addEventListener('pagehide',()=>clearInterval(ticker));window.addEventListener('pageshow',startTicker);
 root.addEventListener('click',e=>{const b=e.target.closest('[data-dismiss-alarm]');if(b)b.closest('.deadline-alert')?.remove();});
 document.addEventListener('erp:task-status',e=>{if(['En revisión','Completada'].includes(e.detail?.estado))for(const el of root.querySelectorAll('.deadline-alert'))if(el.dataset.taskId===String(e.detail.id))el.remove();});
 return (rows,serverUtc)=>{
  if(serverUtc&&Number.isFinite(Date.parse(serverUtc)))offset=Date.parse(serverUtc)-Date.now();
  for(const n of rows){
   if(!/^Vencimiento:(1|5|10|30|60)$/.test(n.tipo)||!n.vigente||seen(n.id))continue;
   const created=Date.parse(n.fecha),now=Date.now()+offset;
   const end=Date.parse(String(n.fecha_entrega).replace(' ','T')+'-05:00');
   if(!Number.isFinite(created)||!Number.isFinite(end)||now-created>120000||end<=now)continue;
   mark(n.id);const el=document.createElement('article');el.className='deadline-alert';el.dataset.deadline=String(end);el.dataset.taskId=String(n.tarea_id);el.setAttribute('role','status');
   el.innerHTML=`<button type="button" class="deadline-close" data-dismiss-alarm aria-label="Cerrar aviso">×</button><strong>Entrega próxima</strong><p>${esc(n.nombre)} · ${esc(n.descripcion)}</p><span>Tiempo restante: <b class="deadline-left" aria-live="off"></b></span><a href="${ROUTES.trabajador.tareas}?tarea=${encodeURIComponent(n.tarea_id)}">Ver tarea</a>`;root.append(el);
  }
  paint();
 };
}
