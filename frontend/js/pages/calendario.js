import {routeState} from '../list-state.js';
import {pager} from '../page-tools.js';
import { initPage } from '../layout.js';
import { Tasks } from '../api.js';
import { ROUTES } from '../config.js';
import { $, $$, esc } from '../ui.js';
import { groupTaskEvents } from '../task-events.js';
import { enableMenuKeyboard } from '../page-tools.js';

const iso = d => d.toISOString().slice(0,10);
const fullDate = d => new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
async function main() {
  const user = await initPage({role:document.body.dataset.role,page:'calendario'});
  enableMenuKeyboard();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  let selected = today, view = new Date(`${today.slice(0,7)}-01T00:00:00Z`), days = new Map(), loading = true, error = '', serial = 0;
  const route=routeState({mes:today.slice(0,7),dia:today,page:1,limit:20});
  let agendaPage=1,agendaSerial=0;
  const restore=()=>{const v=route.read();if(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(v.mes))view=new Date(v.mes+'-01T00:00:00Z');if(/^\d{4}-\d{2}-\d{2}$/.test(v.dia)&&!isNaN(Date.parse(v.dia)))selected=v.dia;agendaPage=v.page;};restore();
  const grid = $('#calendar-grid');
  const agenda = document.createElement('section'); agenda.className = 'calendar-agenda'; agenda.setAttribute('aria-label','Tareas del día seleccionado');
  $('.calendar-footer').after(agenda);
  const taskLink = task => `${ROUTES[user.rol].tareas}?tarea=${encodeURIComponent(task.id)}`;
  async function paintAgenda(next=agendaPage){
    if(loading||error){agenda.innerHTML=`<p class="agenda-message">${loading?'Cargando calendario…':esc(error)}</p>`;return;}
    const token=++agendaSerial,day=selected;agenda.setAttribute('aria-busy','true');
    try{const d=await Tasks.list({dia:day,page:next,limit:route.read().limit});if(token!==agendaSerial||day!==selected)return;agendaPage=d.page;
    agenda.innerHTML=`<div class="agenda-heading"><h3>Tareas del día</h3><span>${d.total} tareas · Hora de Perú</span></div>`+(d.tasks.length?`<div class="agenda-list">${d.tasks.map(t=>`<a class="agenda-event" href="${taskLink(t)}"><time>${esc(t.fecha_entrega?.slice(11,16)||'—')}</time><span><strong>${esc(t.proyecto)}</strong><span class="agenda-description">${esc(t.descripcion)}</span>${user.rol==='admin'?`<span class="agenda-description">${esc(t.trabajador)}</span>`:''}</span><span class="agenda-state">${esc(t.estado)}</span></a>`).join('')}</div>`:'<p class="agenda-message">No hay tareas con entrega en esta fecha.</p>')+'<nav class="agenda-pagination"></nav>';
    route.write({mes:iso(view).slice(0,7),dia:selected,page:d.page,limit:d.limit});pager(d,paintAgenda,{element:$('.agenda-pagination',agenda),onSize:limit=>{route.write({limit,page:1});paintAgenda(1);}});
    }catch(e){if(token===agendaSerial){agenda.innerHTML=`<p class="agenda-message" role="alert">${esc(e.message)}</p><button class="btn outline" type="button">Reintentar</button>`;$('button',agenda).onclick=()=>paintAgenda(next);}}finally{if(token===agendaSerial)agenda.setAttribute('aria-busy','false');}
  }
  const render = () => {
    const y = view.getUTCFullYear(), m = view.getUTCMonth(), offset = (view.getUTCDay()+6)%7;
    $('#month-label').textContent = new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(view);
    grid.setAttribute('aria-busy',String(loading));
    grid.innerHTML = Array.from({length:42},(_,i)=>{
      const date = new Date(Date.UTC(y,m,1-offset+i)), key = iso(date), isToday = key===today, count = days.get(key)||0;
      return `<div class="calendar-cell${date.getUTCMonth()!==m?' other-month':''}${isToday?' today':''}${key===selected?' selected':''}">
        <button type="button" class="calendar-day" data-date="${key}" aria-label="${fullDate(date)}${isToday?', hoy':''}, ${count} tareas" aria-pressed="${key===selected}"${isToday?' aria-current="date"':''}>${date.getUTCDate()}${count?`<span class="day-event-count" aria-hidden="true">· ${count}</span>`:''}</button>
        <div class="calendar-events"></div></div>`;
    }).join('');
    $('#selected-date').textContent = fullDate(new Date(`${selected}T00:00:00Z`));
    $('#month-prev').disabled = y<=1900 && m===0;
    $('#month-next').disabled = y>=2100 && m===11;
    paintAgenda();
  };
  async function load() {
    const token = ++serial, month = iso(view).slice(0,7);
    loading = true; error = ''; days = new Map(); render();
    try { const result = await Tasks.list({calendar:month,vista:'resumen'}); if (token!==serial) return; days=new Map(result.days.map(d=>[d.fecha,d.total])); }
    catch(err) { if (token!==serial) return; error = err.message || 'No se pudieron cargar las tareas.'; }
    if(token!==serial)return;
    loading = false; render();
  }
  function select(key) {
    selected = key;agendaPage=1;
    $$('.calendar-cell',grid).forEach(cell => { const b = $('[data-date]',cell); cell.classList.toggle('selected',b.dataset.date===selected); b.setAttribute('aria-pressed',String(b.dataset.date===selected)); });
    $('#selected-date').textContent = fullDate(new Date(`${selected}T00:00:00Z`)); paintAgenda();
  }
  grid.addEventListener('click',e=>{
    const target = e.target.closest('[data-date],[data-select]'); if(!target)return;
    select(target.dataset.date || target.dataset.select);
    if(target.dataset.select) { agenda.tabIndex=-1; agenda.focus({preventScroll:true}); agenda.scrollIntoView({behavior:'auto',block:'nearest'}); }
  });
  grid.addEventListener('keydown',async e=>{
    const delta = {ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}[e.key], current = e.target.closest('[data-date]');
    if(!delta || !current)return;
    e.preventDefault();const next = new Date(`${current.dataset.date}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+delta);
    if(next.getUTCFullYear()<1900 || next.getUTCFullYear()>2100)return;
    const key = iso(next); if(key.slice(0,7)!==iso(view).slice(0,7)){selected=key;view=new Date(`${key.slice(0,7)}-01T00:00:00Z`);await load();}else select(key);
    $(`[data-date="${key}"]`,grid)?.focus();
  });
  $('#month-prev').onclick = ()=>{view.setUTCMonth(view.getUTCMonth()-1);selected=iso(view);agendaPage=1;load();};
  $('#month-next').onclick = ()=>{view.setUTCMonth(view.getUTCMonth()+1);selected=iso(view);agendaPage=1;load();};
  $('#calendar-today').onclick = ()=>{selected=today;agendaPage=1;view=new Date(`${today.slice(0,7)}-01T00:00:00Z`);load();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  document.addEventListener('erp:task-events',()=>{ if(!document.hidden) load(); });
  route.onChange(()=>{restore();load();});await load();
}
main().catch(err=>console.error('Calendario:',err));
