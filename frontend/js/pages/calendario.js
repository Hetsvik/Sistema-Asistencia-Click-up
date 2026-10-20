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
  const grid = $('#calendar-grid');
  const agenda = document.createElement('section'); agenda.className = 'calendar-agenda'; agenda.setAttribute('aria-label','Tareas del día seleccionado');
  $('.calendar-footer').after(agenda);
  const taskLink = task => `${ROUTES[user.rol].tareas}?tarea=${encodeURIComponent(task.id)}`;
  const paintAgenda = () => {
    const events = days.get(selected) || [];
    agenda.innerHTML = `<div class="agenda-heading"><h3>Tareas del día</h3><span>${events.length} ${events.length===1?'tarea':'tareas'} · Hora de Perú</span></div>
      ${loading ? '<p role="status" class="agenda-message">Cargando tareas…</p>' : error ? `<p role="alert" class="agenda-message">${esc(error)} <button type="button" class="agenda-retry">Reintentar</button></p>` : events.length ? `<div class="agenda-list">${events.map(t=>`<a class="agenda-event" href="${taskLink(t)}"><time>${esc(t.time)}</time><span><strong>${esc(t.name)}</strong><span class="agenda-description">${esc(t.descripcion)}</span>${user.rol==='admin'?`<span class="agenda-description">${esc(t.trabajador)}</span>`:''}</span><span class="agenda-state">${esc(t.estado)}</span></a>`).join('')}</div>` : '<p class="agenda-message">No hay tareas con entrega en esta fecha.</p>'}`;
    $('.agenda-retry',agenda)?.addEventListener('click',load);
  };
  const render = () => {
    const y = view.getUTCFullYear(), m = view.getUTCMonth(), offset = (view.getUTCDay()+6)%7;
    $('#month-label').textContent = new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(view);
    grid.setAttribute('aria-busy',String(loading));
    grid.innerHTML = Array.from({length:42},(_,i)=>{
      const date = new Date(Date.UTC(y,m,1-offset+i)), key = iso(date), isToday = key===today, events = days.get(key)||[];
      return `<div class="calendar-cell${date.getUTCMonth()!==m?' other-month':''}${isToday?' today':''}${key===selected?' selected':''}">
        <button type="button" class="calendar-day" data-date="${key}" aria-label="${fullDate(date)}${isToday?', hoy':''}, ${events.length} tareas" aria-pressed="${key===selected}"${isToday?' aria-current="date"':''}>${date.getUTCDate()}${events.length?`<span class="day-event-count" aria-hidden="true">· ${events.length}</span>`:''}</button>
        <div class="calendar-events">${events.slice(0,2).map(t=>`<div class="calendar-event${t.estado==='Completada'?' completed':''}" title="${esc(`${t.name} · ${t.time} · ${t.descripcion}`)}"><span>${esc(t.name)}</span><time>${esc(t.time)}</time></div>`).join('')}${events.length>2?`<button type="button" class="calendar-more" data-select="${key}" aria-label="Ver las ${events.length} tareas del ${fullDate(date)}">+${events.length-2} más</button>`:''}</div></div>`;
    }).join('');
    $('#selected-date').textContent = fullDate(new Date(`${selected}T00:00:00Z`));
    $('#month-prev').disabled = y<=1900 && m===0;
    $('#month-next').disabled = y>=2100 && m===11;
    paintAgenda();
  };
  async function load() {
    const token = ++serial, month = iso(view).slice(0,7);
    loading = true; error = ''; days = new Map(); render();
    try { const result = await Tasks.list({calendar:month}); if (token!==serial) return; days = groupTaskEvents(result.tasks); }
    catch(err) { if (token!==serial) return; error = err.message || 'No se pudieron cargar las tareas.'; }
    if(token!==serial)return;
    loading = false; render();
  }
  function select(key) {
    selected = key;
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
  $('#month-prev').onclick = ()=>{view.setUTCMonth(view.getUTCMonth()-1);selected=iso(view);load();};
  $('#month-next').onclick = ()=>{view.setUTCMonth(view.getUTCMonth()+1);selected=iso(view);load();};
  $('#calendar-today').onclick = ()=>{selected=today;view=new Date(`${today.slice(0,7)}-01T00:00:00Z`);load();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  document.addEventListener('erp:task-events',()=>{ if(!document.hidden) load(); });
  await load();
}
main().catch(err=>console.error('Calendario:',err));