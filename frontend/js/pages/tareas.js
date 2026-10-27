import {renderFiles,fileAction} from '../file-viewer.js';
import { initAttachments } from '../attachments.js';
import { Catalog, Tasks } from '../api.js';
import { initDateTimePicker } from '../date-time-picker.js';
import { ESTADOS, POLL_COMMENTS_MS } from '../config.js';
import { initPage } from '../layout.js';
import { $, $$, badgeEstado, badgePrioridad, debounce, esc, fmtDate, fmtDateTime, icon, openModal, toast, truncate, withBusy } from '../ui.js';

const role = document.body.dataset.role;
const isAdmin = role === 'admin';
const user = await initPage({ role, page: 'inicio' });

const list = $('#task-list');
const filters = { estado: '', q: '' };
let tasks = [];

// ---------- Listado ----------
const actionFor = (t) => {
  if (isAdmin || t.estado === 'Completada' || t.estado === 'En revisión') return { label: 'Ver', next: null, cls: 'outline' };
  return t.estado === 'Asignada' ? { label: 'Aceptar', next: 'En Progreso' } : { label: 'Entregar', next: 'En revisión' };
};

function render() {
  if (!tasks.length) {
    list.innerHTML = `<div class="empty-state"><strong>No hay tareas</strong><p>${filters.estado || filters.q ? 'Prueba con otros filtros.' : isAdmin ? 'Crea la primera con “Añadir Tarea”.' : 'Cuando te asignen una, aparecerá aquí.'}</p></div>`;
    return;
  }
  list.innerHTML = tasks.map((t) => {
    const a = actionFor(t);
    return `<article class="task" data-id="${t.id}" tabindex="0">
      <span class="name">${esc(t.proyecto)}${isAdmin ? `<small>${esc(t.trabajador)}</small>` : ''}</span>
      <span class="desc" title="${esc(t.descripcion)}">${esc(truncate(t.descripcion, 50))}</span>
      <span class="date">${fmtDate(t.fecha_entrega)}</span>
      <span class="prio">${badgePrioridad(t.prioridad)}</span>
      <span class="estado">${badgeEstado(t.estado)}</span>
      <span class="act"><button class="btn sm ${a.cls ?? ''}" data-action>${a.label}</button></span>
    </article>`;
  }).join('');
}

async function load() {
  try {
    tasks = (await Tasks.list({ estado: filters.estado, q: filters.q })).tasks;
    render();
  } catch (err) { toast(err.message, 'error'); }
}

list.addEventListener('click', async (e) => {
  const row = e.target.closest('.task');
  if (!row) return;
  const task = tasks.find((t) => t.id === Number(row.dataset.id));
  const btn = e.target.closest('[data-action]');
  const a = actionFor(task);
  if (btn && a.next) {
    await withBusy(btn, async () => {
      try { await Tasks.setStatus(task.id, a.next, undefined, task.estado); toast(a.next === 'En Progreso' ? 'Tarea aceptada.' : 'Entrega enviada a revisión.', 'success'); await load(); }
      catch (err) { toast(err.message, 'error'); }
    });
    return;
  }
  openDetail(task.id);
});
list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('task')) openDetail(Number(e.target.dataset.id)); });

// ---------- Filtros ----------
const menu = $('#filter-menu');
menu.innerHTML = ['', ...ESTADOS].map((s) => `<button type="button" data-estado="${esc(s)}" class="${s === '' ? 'is-active' : ''}">${s || 'Todas'}</button>`).join('');
$('#btn-filter').addEventListener('click', (e) => { e.stopPropagation(); menu.toggleAttribute('hidden'); });
document.addEventListener('click', () => menu.setAttribute('hidden', ''));
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-estado]');
  if (!b) return;
  filters.estado = b.dataset.estado;
  $$('button', menu).forEach((x) => x.classList.toggle('is-active', x === b));
  load();
});
$('#task-search').addEventListener('input', debounce((e) => { filters.q = e.target.value.trim(); load(); }, 350));

document.addEventListener('erp:task-events',()=>load());

// ---------- Detalle + chat ----------
async function openDetail(id) {
  let task;
  try { task = (await Tasks.get(id)).task; } catch (err) { return toast(err.message, 'error'); }

  const allowed = {Asignada:['En Progreso'],'En Progreso':['En revisión'],'En revisión':['Completada','En Progreso'],Completada:['En Progreso']};
  let timer,attachments,closed=false,painting=false,sending=false;const fileMap=new Map();
  const leaveGuard=e=>{if(sending){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leaveGuard);
  const modal = openModal({
    title: `Tarea · ${task.proyecto}`,
    wide: true,
    onClose: () => {window.removeEventListener('beforeunload',leaveGuard);closed=true;clearInterval(timer);attachments?.destroy();},
    html: `
      <dl class="detail">
        <div><dt>Descripción</dt><dd>${esc(task.descripcion)}</dd></div>
        <div><dt>Asignada a</dt><dd>${esc(task.trabajador)}</dd></div>
        <div><dt>Área</dt><dd>${esc(task.area)}</dd></div>
        <div><dt>Inicio</dt><dd>${fmtDateTime(task.fecha_inicio)}</dd></div>
        <div><dt>Entrega</dt><dd>${fmtDateTime(task.fecha_entrega)}</dd></div>
        <div><dt>Estado</dt><dd id="d-estado">${badgeEstado(task.estado)} ${badgePrioridad(task.prioridad)}</dd></div>
        ${task.observaciones ? `<div class="full"><dt>Observaciones</dt><dd>${esc(task.observaciones)}</dd></div>` : ''}
      </dl>
      ${isAdmin ? `<div class="inline-form"><label for="d-set">Cambiar estado</label>
        <select id="d-set" class="input plain">${[task.estado,...(allowed[task.estado]||[])].map((s) => `<option value="${s}" ${s === task.estado ? 'selected' : ''}>${s==='Completada'&&task.estado==='En revisión'?'Aprobar · Completada':s==='En Progreso'&&task.estado==='En revisión'?'Devolver · En progreso':s}</option>`).join('')}</select>
        <button type="button" class="btn sm" id="d-save">Guardar</button></div>` : ''}
      ${isAdmin?'<label class="review-note">Observaciones de revisión<textarea class="input plain" id="d-review-note" maxlength="500" rows="2" placeholder="Obligatorio si devuelves la tarea para correcciones"></textarea></label>':''}
      ${task.estado==='En revisión'?'<p class="review-hint">Entrega pendiente de aprobación del administrador.</p>':''}
      <h3 class="sub">Conversación</h3>
      <div class="module-actions"><button type="button" class="btn outline sm" id="chat-older" hidden>Ver mensajes anteriores</button><button type="button" class="btn outline sm" id="chat-latest" hidden>Volver a mensajes recientes</button></div><div class="chat" id="chat" aria-live="polite"></div>
      <form class="chat-form" id="chat-form">
        <input class="input plain" id="chat-input" maxlength="1000" placeholder="Escribe un mensaje…" autocomplete="off">
        <button class="btn sm" type="submit" aria-label="Enviar">${icon('send')}</button>
      </form>`,
  });

  const chatInput=$('#chat-input',modal.el),sendButton=$('#chat-form [type=submit]',modal.el);
  const updateSend=()=>{sendButton.disabled=sending||(!chatInput.value.trim()&&!attachments?.count);};
  modal.el.addEventListener('cancel',e=>{if(sending){e.preventDefault();toast('Espera la confirmación del envío antes de cerrar.');}});
  modal.el.addEventListener('click',e=>{if(sending&&(e.target===modal.el||e.target.closest('[data-close]'))){e.preventDefault();e.stopImmediatePropagation();toast('Espera la confirmación del envío antes de cerrar.');}},true);
  attachments=initAttachments(modal.el,{onChange:updateSend});chatInput.addEventListener('input',updateSend);updateSend();
  const chat = $('#chat', modal.el);
  let chatRows=[],hasOlder=false,browsingOlder=false;const latestButton=$('#chat-latest',modal.el);const olderButton=$('#chat-older',modal.el);
  const paintChat = async (older=false) => {
    if(closed||painting||document.hidden)return;painting=true;
    try {
      const first=chatRows[0]?.id,last=chatRows.at(-1)?.id;
      const data=await Tasks.comments(id,older?{before:first}:last?{after:last}:{});
      if(closed)return;
      if(!last||older)hasOlder=data.has_more;
      const map=new Map(chatRows.map(c=>[c.id,c]));for(const c of data.comments)map.set(c.id,c);
      chatRows=[...map.values()].sort((a,b)=>a.id-b.id);
      // Máximo 200 mensajes en DOM; el historial completo sigue paginado en el servidor.
      if(chatRows.length>200){chatRows=older?chatRows.slice(0,200):chatRows.slice(-200);hasOlder=true;}
      olderButton.hidden=!hasOlder;olderButton.disabled=false;
      const comments=chatRows;
      fileMap.clear();for(const c of comments)for(const f of c.attachments||[])fileMap.set(f.id,f);
      const stick = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
      chat.innerHTML = comments.length ? comments.map((c) => `
        <div class="msg ${c.autor === user.nombre ? 'mine' : ''}">
          <b>${esc(c.autor)} <i>${esc(c.rol)}</i></b><p>${esc(c.mensaje)}</p>${renderFiles(c.attachments)}<time>${fmtDateTime(c.fecha)}</time>
        </div>`).join('') : '<p class="muted center">Aún no hay mensajes.</p>';
      if (stick) chat.scrollTop = chat.scrollHeight;
    } catch(e) { if(older)toast(e.message,'error'); } finally {painting=false;olderButton.disabled=false;}
  };
  olderButton.onclick=()=>{browsingOlder=true;latestButton.hidden=false;olderButton.disabled=true;paintChat(true);};
  latestButton.onclick=()=>{browsingOlder=false;latestButton.hidden=true;chatRows=[];paintChat();};
  timer = setInterval(()=>{if(!browsingOlder)paintChat();}, POLL_COMMENTS_MS);
  await paintChat();
  chat.scrollTop = chat.scrollHeight;

  chat.addEventListener('click',async e=>{
    const b=e.target.closest('[data-file]');if(!b)return;const f=fileMap.get(b.dataset.file);if(!f)return;
    await withBusy(b,()=>fileAction(id,f,b.dataset.action));
  });
  $('#chat-form', modal.el).addEventListener('submit', async (e) => {
    e.preventDefault();if(sending||closed)return;
    const text=chatInput.value.trim();if(!text&&!attachments.count)return;
    const hasFiles=attachments.count>0,body=hasFiles?attachments.formData(text):null;
    sending=true;attachments.setBusy(true);chatInput.disabled=true;sendButton.setAttribute('aria-label',hasFiles?'Subiendo archivos':'Enviando mensaje');sendButton.innerHTML='<svg class="file-spinner" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="40 20"/></svg>';e.currentTarget.setAttribute('aria-busy','true');updateSend();
    try {
      if(hasFiles)await Tasks.sendAttachments(id,body);else await Tasks.addComment(id,text);
      if(!closed){chatInput.value='';attachments.clear();browsingOlder=false;latestButton.hidden=true;chatRows=[];await paintChat();chat.scrollTop=chat.scrollHeight;toast(hasFiles?'Archivos enviados.':'Mensaje enviado.','success');}
    }catch(err){if(!closed)toast(err.message,'error');}
    finally{sending=false;if(!closed){attachments.setBusy(false);chatInput.disabled=false;sendButton.innerHTML=icon('send');sendButton.setAttribute('aria-label','Enviar');$('#chat-form',modal.el).setAttribute('aria-busy','false');updateSend();}}
  });

  $('#d-save', modal.el)?.addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    try {
      const res = await Tasks.setStatus(id, $('#d-set', modal.el).value, $('#d-review-note', modal.el).value.trim() || undefined, task.estado);
      $('#d-estado', modal.el).innerHTML = `${badgeEstado(res.task.estado)} ${badgePrioridad(res.task.prioridad)}`;
      toast('Estado actualizado.', 'success');
      modal.close();
      await load();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

// ---------- Crear tarea (admin) ----------
async function openCreate() {
  let users, projects=[];
  try {
    users=(await Catalog.users()).users;
    let before;
    do {const data=await Catalog.projects({before});projects.push(...data.projects);before=data.has_more?data.next_before:null;} while(before);
  } catch(err) {return toast(err.message,'error');}
  const modal=openModal({title:'Añadir tarea',html:`<form id="new-task" class="form-grid">
    <label class="full">Trabajador<select class="input plain" name="trabajador_id" required><option value="">Selecciona…</option>${users.map(u=>`<option value="${u.id}">${esc(u.nombre)} · ${esc(u.cargo)}</option>`).join('')}</select></label>
    <label class="full">Proyecto<select class="input plain" name="proyecto_id" required><option value="">Selecciona…</option>${projects.map(p=>`<option value="${p.id}">${esc(p.nombre)} (${esc(p.area)})</option>`).join('')}</select></label>
    <a class="project-form-link full" href="/admin/proyectos/nuevo">+ Crear un proyecto antes de asignar la tarea</a>
    <label class="full">Descripción<textarea class="input plain" name="descripcion" rows="3" maxlength="500" required></textarea></label>
    <label class="full">Prioridad<select class="input plain" name="prioridad" required><option>Alta</option><option selected>Media</option><option>Baja</option></select></label>
    <div id="task-datetime" class="full"></div><p class="form-message is-error full" id="f-error" hidden role="alert"></p>
    <div class="modal-actions full"><button type="button" class="btn outline" data-close>Cancelar</button><button type="submit" class="btn">Crear tarea</button></div></form>`});
  const form=$('#new-task',modal.el),picker=initDateTimePicker($('#task-datetime',form),{label:'Fecha y hora de entrega'});
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const err = $('#f-error', modal.el);
    err.hidden = true;
    const body = {
      trabajador_id: Number(f.trabajador_id) || null,
      descripcion: f.descripcion,
      fecha_entrega: picker.getValue(),
      prioridad: f.prioridad,
    };
    body.proyecto_id = Number(f.proyecto_id) || null;

    await withBusy($('[type=submit]', form), async () => {
      try {
        await Tasks.create(body);
        modal.close();
        toast('Tarea creada.', 'success');
        load();
      } catch (e2) { err.textContent = e2.message; err.hidden = false; }
    });
  });
}
$('#btn-add')?.addEventListener('click', openCreate);

await load();
// El identificador se conserva internamente para abrir una tarea desde calendario/notificaciones.
const linkedTask = new URLSearchParams(location.search).get('tarea');
if (linkedTask && /^[1-9]\d*$/.test(linkedTask)) await openDetail(Number(linkedTask));