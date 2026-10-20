// Bandeja de eventos persistentes. Un solo sondeo en vuelo, con pausa en segundo plano.
import { Notifications } from './api.js';
import { POLL_NOTIFICATIONS_MS, ROUTES } from './config.js';
import { $, esc, fmtDateTime, toast } from './ui.js';
export function notificationText(n) {
 const name=`«${n.nombre}»`;
 return ({Asignada:`Se te ha asignado la tarea ${name}.`, 'En Progreso':`La tarea ${name} está en progreso; aún no está completada.`,
 'En revisión':`La tarea ${name} se ha entregado y está en revisión.`,Completada:`La tarea ${name} se ha completado y aprobado.`,
 Devuelta:`La tarea ${name} no se ha aprobado; requiere correcciones.`})[n.tipo] || `La tarea ${name} cambió a ${n.estado}.`;
}
export function initNotifications(user) {
 const bell=$('#bell'),panel=$('#notif-panel'); if(!bell||!panel)return;
 let items=[],cursor=0,before=null,more=false,initialized=false,busy=false,clearing=false,generation=0,timer,failures=0,signature='';
 bell.setAttribute('aria-controls','notif-panel');bell.setAttribute('aria-expanded','false');panel.setAttribute('aria-label','Notificaciones');
 const paint=()=>{
  const next=JSON.stringify([items,more,failures>0,clearing]);if(signature===next)return;signature=next;
  const old=$('.notif-list',panel),scroll=old?.scrollTop||0,height=old?.scrollHeight||0;
  const focused=document.activeElement,focusId=focused?.dataset?.notice,focusClear=focused?.classList?.contains('notif-clear');
  $('.dot',bell)?.toggleAttribute('hidden',items.length===0);
  panel.innerHTML=`<div class="notif-head"><span>Notificaciones</span><span class="notif-count">${items.length}${more?'+':''}</span></div>
   ${failures?'<p class="notif-connection" role="status">Sin conexión. Se reintentará automáticamente.</p>':''}
   <div class="notif-list" tabindex="0" role="region" aria-label="Lista de notificaciones">${items.length?items.map(n=>`<a class="notif-item" data-notice="${n.id}" href="${ROUTES[user.rol].tareas}?tarea=${encodeURIComponent(n.tarea_id)}"><strong>${esc(notificationText(n))}</strong><span>${esc(n.descripcion)}</span><span>Entrega: ${fmtDateTime(n.fecha_entrega)}</span>${n.tipo==='Devuelta'&&n.observaciones?`<span>Motivo: ${esc(n.observaciones)}</span>`:''}<time datetime="${esc(n.fecha)}">${esc(new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(n.fecha)))}</time></a>`).join(''):'<p class="notif-empty">No tienes notificaciones nuevas.</p>'}${more?'<button type="button" class="notif-older">Ver anteriores</button>':''}</div>
   <div class="notif-footer"><button type="button" class="notif-clear" ${!items.length||clearing?'disabled':''}>${clearing?'Limpiando…':'Eliminar todas'}</button></div>`;
  const list=$('.notif-list',panel);list.scrollTop=scroll>0?Math.max(0,scroll+Math.max(0,list.scrollHeight-height)):0;
  if(focusId)$(`[data-notice="${focusId}"]`,panel)?.focus({preventScroll:true});
  if(focusClear)($('.notif-clear',panel).disabled?list:$('.notif-clear',panel)).focus({preventScroll:true});
 };
 const absorb=(data,{older=false,initial=false}={})=>{
  const hidden=data.cleared_through||0;
  const map=new Map(items.filter(n=>n.id>hidden).map(n=>[n.id,n]));
  for(const n of data.notifications)if(n.id>hidden)map.set(n.id,n);
  items=[...map.values()].sort((a,b)=>b.id-a.id);
  if(!older)cursor=Math.max(cursor,data.cursor,hidden);
  if(initial||older){before=data.next_before;more=data.has_more;}
  paint();
  if(!initial&&!older&&data.notifications.length)document.dispatchEvent(new CustomEvent('erp:task-events',{detail:data.notifications}));
 };
 const schedule=()=>{clearTimeout(timer);if(!document.hidden&&navigator.onLine)timer=setTimeout(refresh,failures?Math.min(30000,POLL_NOTIFICATIONS_MS*2**Math.min(failures,4)):POLL_NOTIFICATIONS_MS);};
 async function refresh(){
  if(busy||clearing||document.hidden||!navigator.onLine){schedule();return;}
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
  if(busy||!more||!before||clearing)return;busy=true;const token=generation;
  try{const data=await Notifications.list({before});if(token===generation){failures=0;absorb(data,{older:true});}}
  catch{failures++;paint();}finally{busy=false;}
 }
 panel.addEventListener('click',async e=>{
  if(e.target.closest('.notif-older')){e.stopPropagation();await older();return;}
  if(!e.target.closest('.notif-clear')||clearing)return;e.stopPropagation();
  clearing=true;generation++;paint();
  try{const data=await Notifications.clear(cursor);items=items.filter(n=>n.id>data.cleared_through);cursor=Math.max(cursor,data.cleared_through);more=false;before=null;failures=0;}
  catch(err){toast(err.message||'No se pudieron limpiar los avisos.','error');}
  finally{clearing=false;paint();schedule();}
 });
 const close=()=>{panel.hidden=true;bell.setAttribute('aria-expanded','false');};
 bell.addEventListener('click',e=>{e.stopPropagation();panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)refresh();});
 document.addEventListener('click',e=>{if(!panel.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();bell.focus();}});
 document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)refresh();});
 window.addEventListener('online',refresh);window.addEventListener('offline',()=>{clearTimeout(timer);failures++;paint();});
 window.addEventListener('pagehide',()=>clearTimeout(timer));
 paint();refresh();
}
