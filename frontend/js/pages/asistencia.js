import {createServerClock,historyStart} from '../server-clock.js';
import {Attendance} from '../api.js';
import {initPage} from '../layout.js';
import {enableMenuKeyboard,pager} from '../page-tools.js';
import {routeState} from '../list-state.js';
import {createPoll} from '../polling.js';
import {$,debounce,esc,fmtDate,fmtTime,toast,withBusy} from '../ui.js';
const role=document.body.dataset.role,admin=role==='admin';
await initPage({role,page:'inicio'});enableMenuKeyboard();
const route=routeState({vista:admin?'hoy':'historial',page:1,limit:20,q:'',desde:'',hasta:''});
const historyNav=$('#history-page').parentElement,dailyNav=admin?$('#daily-page').parentElement:null;
let view='hoy',page=1,limit=20,generation=0,historySequence=0,nextSlot=null,pushRoute=false;
function restore(){const s=route.read();view=admin&&s.vista!=='historial'?'hoy':'historial';page=s.page;limit=[10,20,50,100].includes(s.limit)?s.limit:20;if(admin&&view==='hoy')limit=Math.min(limit,50);$('#att-from').value=s.desde;$('#att-to').value=s.hasta;if(admin){$('#att-search').value=s.q;$('#daily-search').value=s.q;}setPanels();}
function setPanels(){if(!admin)return;$('#daily-panel').hidden=view!=='hoy';$('#history-panel').hidden=view==='hoy';for(const [id,value] of [['daily','hoy'],['history','historial']]){const el=$('#'+id+'-tab'),on=view===value;el.setAttribute('aria-selected',String(on));el.tabIndex=on?0:-1;el.classList.toggle('outline',!on);}}
function remember(data){route.write({vista:view,page:data.page,limit:data.limit,q:admin?$(view==='hoy'?'#daily-search':'#att-search').value.trim():'',desde:$('#att-from').value,hasta:$('#att-to').value},{replace:!pushRoute});pushRoute=false;}
function initHistory(fecha){if(!$('#att-from').value)$('#att-from').value=historyStart(fecha);}
async function historyList(next=page){
 const seq=++historySequence,gen=generation;$('#att-body').setAttribute('aria-busy','true');
 try{const d=await Attendance.list({page:next,limit,q:admin?$('#att-search').value.trim():'',desde:$('#att-from').value,hasta:$('#att-to').value});if(seq!==historySequence||gen!==generation)return;initHistory(d.fecha);page=d.page;
 $('#att-body').innerHTML=d.records.length?d.records.map(r=>`<tr>${admin?`<td data-label="Trabajador">${esc(r.nombre)}</td>`:''}<td data-label="Fecha / tramo">${fmtDate(r.fecha)}<small class="cell-note">${r.tramo?'Tramo '+r.tramo:'Registro anterior · sin evaluación por horario'}</small></td><td data-label="Entrada">${r.entrada?fmtTime(r.entrada):'Sin entrada'}</td><td data-label="Salida">${r.salida?fmtTime(r.salida):'—'}</td><td data-label="Estado"><span class="badge ${r.falta?'alta':r.estado==='A tiempo'?'baja':'media'}">${esc(r.estado)}</span>${r.motivo?`<small class="cell-note">${esc(r.motivo)}</small>`:''}</td></tr>`).join(''):`<tr><td colspan="${admin?5:4}" class="empty">Sin registros en este periodo.</td></tr>`;
 remember(d);pager(d,n=>{generation++;pushRoute=true;historyList(n);},{element:historyNav,onSize:n=>{limit=n;generation++;pushRoute=true;historyList(1);}});
 }catch(e){if(seq===historySequence&&gen===generation){toast(e.message,'error');historyNav.replaceChildren();}}finally{if(seq===historySequence)$('#att-body').setAttribute('aria-busy','false');}
}
for(const id of ['att-search','att-from','att-to'])$('#'+id)?.addEventListener('input',debounce(()=>{generation++;pushRoute=true;historyList(1);},350));
restore();
if(admin){
 async function daily(){const gen=generation;const d=await Attendance.daily({q:$('#daily-search').value.trim(),page,limit});if(gen!==generation||view!=='hoy')return;initHistory(d.fecha);page=d.page;
 $('#daily-date').textContent=`${fmtDate(d.fecha)} · Hora de Perú · ${d.total} trabajadores`;
 $('#daily-list').innerHTML=d.workers.length?d.workers.map(w=>`<article class="daily-worker"><div><h3>${esc(w.nombre)}</h3><span class="badge ${w.faltas?'alta':w.estado==='Presente'?'baja':''}">${esc(w.estado)}</span>${w.faltas?`<small class="cell-note">${w.faltas} falta(s) por tramo</small>`:''}</div><div class="daily-slots">${w.tramos.map(s=>`<p><strong>Tramo ${s.tramo} · ${esc(s.inicio)}–${esc(s.fin)}</strong><span>${esc(s.estado)} · Entrada: ${s.entrada?fmtTime(s.entrada):'—'} · Salida: ${s.salida?fmtTime(s.salida):'—'}</span></p>`).join('')||`<p>${w.registro_anterior?`Entrada: ${fmtTime(w.registro_anterior.entrada)} · Salida: ${w.registro_anterior.salida?fmtTime(w.registro_anterior.salida):'—'}`:w.estado==='Descanso'?'Sin jornada prevista hoy':'Sin horario vigente; no se calculan faltas'}</p>`}</div></article>`).join(''):'<p class="empty">No hay trabajadores con ese nombre.</p>';
 $('#daily-refresh').textContent='Actualización automática · cada 30 s mientras la página esté visible';remember(d);
 pager({...d,max_limit:50},n=>{generation++;pushRoute=true;page=n;poll.trigger();},{element:dailyNav,onSize:n=>{generation++;pushRoute=true;limit=n;page=1;poll.trigger();}});
 }
 const poll=createPoll(daily,{interval:30000,active:()=>view==='hoy',onError:e=>{$('#daily-refresh').textContent='No se pudo actualizar: '+e.message;}});
 function switchView(value){generation++;view=value;page=1;if(view==='hoy')limit=Math.min(limit,50);setPanels();route.write({vista:view,page,limit});if(view==='historial')historyList();else poll.trigger();}
 for(const [id,value] of [['daily','hoy'],['history','historial']]){const el=$('#'+id+'-tab');el.onclick=()=>switchView(value);el.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const v=e.key==='Home'?'hoy':e.key==='End'?'historial':view==='hoy'?'historial':'hoy';switchView(v);$(v==='hoy'?'#daily-tab':'#history-tab').focus();}};}
 $('#daily-search').addEventListener('input',debounce(()=>{generation++;pushRoute=true;page=1;poll.trigger();},350));
 route.onChange(()=>{generation++;restore();if(view==='historial')historyList();else poll.trigger();});
 if(view==='historial')await historyList();else await poll.start();
}else{
 const clock=createServerClock();
 const tick=()=>{const n=clock.now();$('#clock-time').textContent=n?n.toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit'}):'--:--';$('#clock-date').textContent=n?n.toLocaleDateString('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Sincronizando con el servidor…';};
 const invalidate=()=>{clock.invalidate();tick();$('#btn-in').disabled=true;$('#btn-out').disabled=true;};invalidate();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate();});window.addEventListener('pageshow',e=>{if(e.persisted)invalidate();});
 const poll=createPoll(async()=>{const requestedAt=performance.now(),d=await Attendance.today(),p=d.plan;clock.sync(d.server_epoch_ms,requestedAt);tick();initHistory(d.fecha);
 $('#my-plan').innerHTML=p.tramos.map(s=>`<article class="card"><h2>Tramo ${s.tramo} · ${esc(s.inicio)}–${esc(s.fin)}</h2><p>${esc(s.estado)}</p><p class="muted">Entrada: ${s.entrada?fmtTime(s.entrada):'—'} · Salida: ${s.salida?fmtTime(s.salida):'—'}</p></article>`).join('');
 if(p.configurado||p.fijado){const open=p.tramos.some(s=>s.entrada&&!s.salida);nextSlot=p.tramos.find((s,i)=>!s.entrada&&d.hora<s.fin+':00'&&(i===0||d.hora>=p.tramos[i-1].fin+':00'))?.tramo||null;$('#btn-in').disabled=open||!nextSlot;$('#btn-out').disabled=!open;$('#att-status').textContent=p.tramos.length?'Cada entrada tiene 10 minutos de tolerancia. Pasado el límite se registra una falta por tramo.':'Hoy es día de descanso según tu horario.';}
 else{nextSlot=null;$('#btn-in').disabled=!!d.registro;$('#btn-out').disabled=!d.registro||!!d.registro.salida;$('#att-status').textContent=d.registro?(d.registro.salida?'Jornada cerrada.':'Entrada registrada.'):'Sin horario vigente: marcación diaria sin cálculo de faltas. Un horario nuevo rige desde mañana.';}
 },{interval:15000,onError:e=>{invalidate();$('#att-status').textContent=e.message;}});
 setInterval(()=>{if(!document.hidden)tick();},1000);
 for(const [id,call] of [['btn-in',()=>Attendance.checkIn(nextSlot)],['btn-out',()=>Attendance.checkOut()]])$('#'+id).onclick=()=>withBusy($('#'+id),async()=>{try{const r=await call();toast(r.message,'success');}catch(e){toast(e.message,'error');}}).then(()=>{poll.trigger();historyList();});
 route.onChange(()=>{generation++;restore();historyList();});await poll.start();await historyList();
}
