import { initExpress } from '../express.js';
import {routeState} from '../list-state.js';
import {pager} from '../page-tools.js';
import {createPoll} from '../polling.js';
import {renderFiles,fileAction} from '../file-viewer.js';
import { initAttachments } from '../attachments.js';
import { Catalog, Tasks, WorkAreas } from '../api.js';
import { initDateTimePicker } from '../date-time-picker.js';
import { ESTADOS, POLL_COMMENTS_MS } from '../config.js';
import { initPage } from '../layout.js';
import { $, $$, badgeEstado, badgePrioridad, debounce, esc, fmtDate, fmtDateTime, icon, openModal, toast, truncate, withBusy } from '../ui.js';

const role = document.body.dataset.role;
const isAdmin = role === 'admin';
const user = await initPage({ role, page: 'inicio' });

const isExpress=new URLSearchParams(location.search).get('tab')==='express';
const base=role==='admin'?'/admin/tareas':'/usuarios/tareas';
$('#tab-assigned').href=base;$('#tab-express').href=base+'?tab=express';
$(isExpress?'#tab-express':'#tab-assigned').setAttribute('aria-current','page');
$('#assigned-panel').hidden=isExpress;$('#express-panel').hidden=!isExpress;
const list = $('#task-list');
const route=routeState({page:1,limit:10,estado:'',q:''});
let page=1,sequence=0;const filters={estado:'',q:''};
const restore=()=>{const v=route.read();page=v.page;filters.estado=v.estado;filters.q=v.q;$('#task-search').value=v.q;$$('[data-estado]').forEach(b=>b.classList.toggle('is-active',b.dataset.estado===v.estado));};
const nav=document.createElement('nav');list.after(nav);
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
      <span class="act"><button class="btn sm ${a.cls ?? ''}" data-action>${a.label}</button>${isAdmin?`<span class="task-menu-wrap"><button type="button" class="task-menu-toggle" data-task-menu aria-label="Opciones de la tarea" aria-expanded="false">⋮</button><span class="task-menu" hidden><button type="button" data-task-edit>Editar</button><button type="button" data-task-remove>Borrar</button></span></span>`:''}</span>
    </article>`;
  }).join('');
}

async function load(next=page){
 const seq=++sequence;list.setAttribute('aria-busy','true');
 try{const data=await Tasks.list({estado:filters.estado,q:filters.q,page:next,limit:10});if(seq!==sequence)return;tasks=data.tasks;page=data.page;render();route.write({page,limit:null,...filters});pager(data,load,{element:nav,simple:true});}
 catch(err){if(seq===sequence)toast(err.message,'error');}
 finally{if(seq===sequence)list.setAttribute('aria-busy','false');}
}

list.addEventListener('click', async (e) => {
  const row = e.target.closest('.task');
  if (!row) return;
  const task = tasks.find((t) => t.id === Number(row.dataset.id));
  if(!task)return;
  const toggle=e.target.closest('[data-task-menu]');
  if(toggle){const menu=toggle.nextElementSibling;const open=menu.hidden;closeTaskMenus();menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));return;}
  if(e.target.closest('[data-task-edit]')){closeTaskMenus();return openEdit(task.id);}
  if(e.target.closest('[data-task-remove]')){closeTaskMenus();return confirmRemove(task);}
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

function closeTaskMenus(){for(const m of list.querySelectorAll('.task-menu'))m.hidden=true;for(const b of list.querySelectorAll('[data-task-menu]'))b.setAttribute('aria-expanded','false');}
document.addEventListener('click',e=>{if(!e.target.closest('.task-menu-wrap'))closeTaskMenus();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const open=list.querySelector('[data-task-menu][aria-expanded="true"]');if(open){closeTaskMenus();open.focus();}}});

async function openEdit(id){
 let task;try{task=(await Tasks.get(id)).task;}catch(err){return toast(err.message,'error');}
 const dt=String(task.fecha_entrega||'').replace(' ','T');const parts=dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
 if(!parts)return toast('La fecha de entrega no es válida.','error');
 const hour=Number(parts[2]);const selected=task.prioridad_manual||task.prioridad||'Media';
 const modal=openModal({title:'Editar tarea',html:`<form id="edit-task" class="form-grid">
 <label class="full">Descripción<textarea class="input plain" name="descripcion" rows="3" maxlength="500" required>${esc(task.descripcion)}</textarea></label>
 <label class="full">Prioridad<select class="input plain" name="prioridad">${['Alta','Media','Baja'].map(x=>`<option ${x===selected?'selected':''}>${x}</option>`).join('')}</select></label>
 <div id="edit-task-datetime" class="full"></div><p class="muted full">El trabajador asignado, el proyecto y la conversación no se modifican aquí.</p>
 <p class="form-message is-error full" id="edit-task-error" role="alert" hidden></p><div class="modal-actions full"><button type="button" class="btn outline" data-close>Cancelar</button><button type="submit" class="btn">Guardar cambios</button></div></form>`});
 const form=$('#edit-task',modal.el),picker=initDateTimePicker($('#edit-task-datetime',form),{initialDate:parts[1],hour:hour%12||12,minute:Number(parts[3]),period:hour>=12?'PM':'AM',label:'Fecha y hora de entrega'});
 form.addEventListener('submit',e=>{e.preventDefault();withBusy($('[type=submit]',form),async()=>{try{
  await Tasks.edit(id,{descripcion:form.elements.descripcion.value,prioridad:form.elements.prioridad.value,fecha_entrega:picker.getValue(),expected:{descripcion:task.descripcion,fecha_entrega:task.fecha_entrega,prioridad_manual:task.prioridad_manual??null}});
  modal.close();toast('Tarea actualizada.','success');await load();
 }catch(err){const box=$('#edit-task-error',form);box.textContent=err.message;box.hidden=false;}});});
}
function confirmRemove(task){const modal=openModal({title:'Eliminar tarea',html:`<p>¿Eliminar la tarea de <strong>${esc(task.trabajador)}</strong> en ${esc(task.proyecto)}?</p><p>Dejará de aparecer en tareas, reportes y alarmas. El historial y los adjuntos se conservarán de forma privada; no se borrarán definitivamente.</p><p class="form-message is-error" id="delete-task-error" hidden role="alert"></p><div class="modal-actions"><button type="button" class="btn outline" data-close>Cancelar</button><button type="button" class="btn" id="delete-task-confirm">Eliminar tarea</button></div>`});
 $('#delete-task-confirm',modal.el).onclick=e=>withBusy(e.currentTarget,async()=>{try{await Tasks.remove(task.id);modal.close();toast('Tarea eliminada de las vistas.','success');await load();}catch(err){const box=$('#delete-task-error',modal.el);box.hidden=false;box.textContent=err.message;}});
}

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
  load(1);
});
$('#task-search').addEventListener('input', debounce((e) => { filters.q = e.target.value.trim(); load(1); }, 350));

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
    onClose: () => {window.removeEventListener('beforeunload',leaveGuard);closed=true;timer?.stop();attachments?.destroy();},
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
    } catch(e) { if(older)toast(e.message,'error');throw e; } finally {painting=false;olderButton.disabled=false;}
  };
  olderButton.onclick=()=>{browsingOlder=true;latestButton.hidden=false;olderButton.disabled=true;paintChat(true).catch(()=>{});};
  latestButton.onclick=()=>{browsingOlder=false;latestButton.hidden=true;chatRows=[];paintChat().catch(()=>{});};
  timer=createPoll(()=>paintChat(),{interval:POLL_COMMENTS_MS,active:()=>!closed&&!browsingOlder});
  await timer.start();
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
  let closed=false, workerSerial=0, projectSerial=0;
  const chosen=new Map(),workers=new Map();
  const modal=openModal({title:'Añadir tarea',wide:true,onClose:()=>{closed=true;},html:`<form id="new-task" class="form-grid">
    <label class="full">Área de trabajo<select class="input plain" id="pick-area"><option value="">Selecciona un área…</option></select></label>
    <label>Buscar trabajador<input type="search" class="input plain" id="pick-worker" placeholder="Nombre o código" disabled></label>
    <label>Trabajador<select class="input plain" id="task-worker" disabled><option value="">Selecciona un área primero…</option></select></label>
    <div class="full"><button type="button" class="btn outline sm" id="add-worker" disabled>+ Añadir trabajador</button><p class="muted" id="worker-hint" role="status">Selecciona un área para ver sus trabajadores.</p><div id="chosen-workers" class="chosen-workers"></div></div>
    <label>Buscar proyecto<input type="search" class="input plain" id="pick-project" placeholder="Nombre, área o descripción"></label>
    <label>Proyecto<select class="input plain" name="proyecto_id" required><option value="">Selecciona un proyecto…</option></select></label>
    <p class="muted full" id="project-hint" role="status"></p>
    <a class="project-form-link full" href="/admin/proyectos/nuevo">+ Crear un proyecto antes de asignar la tarea</a>
    <label class="full">Descripción<textarea class="input plain" name="descripcion" rows="3" maxlength="500" required></textarea></label>
    <label class="full">Prioridad<select class="input plain" name="prioridad" required><option>Alta</option><option selected>Media</option><option>Baja</option></select></label>
    <div id="task-datetime" class="full"></div><p class="form-message is-error full" id="f-error" hidden role="alert"></p>
    <p class="muted full">Se creará una tarea independiente por trabajador, con su propio seguimiento.</p>
    <div class="modal-actions full"><button type="button" class="btn outline" data-close>Cancelar</button><button type="submit" class="btn">Crear tareas</button></div></form>`});
  modal.el.classList.add('task-create-wide');
  const form=$('#new-task',modal.el),picker=initDateTimePicker($('#task-datetime',form),{label:'Fecha y hora de entrega'});
  const area=$('#pick-area',form),worker=$('#task-worker',form),workerSearch=$('#pick-worker',form),projectSearch=$('#pick-project',form),project=form.elements.proyecto_id,add=$('#add-worker',form),hint=$('#worker-hint',form),error=$('#f-error',form);
  const showError=e=>{error.textContent=e.message||e;error.hidden=false;};
  const renderChosen=()=>{const box=$('#chosen-workers',form);box.innerHTML=[...chosen.values()].map(w=>`<span class="chosen-worker">${esc(w.nombre)} · ${esc(w.area)} <button type="button" data-remove-worker="${w.id}" aria-label="Quitar ${esc(w.nombre)}">×</button></span>`).join('');};
  $('#chosen-workers',form).addEventListener('click',e=>{const b=e.target.closest('[data-remove-worker]');if(b){chosen.delete(Number(b.dataset.removeWorker));renderChosen();}});
  async function loadWorkers(){
   const seq=++workerSerial;workers.clear();worker.disabled=true;add.disabled=true;worker.replaceChildren(new Option('Selecciona un trabajador…',''));
   if(!area.value){workerSearch.disabled=true;hint.textContent='Selecciona un área para ver sus trabajadores.';return;}
   workerSearch.disabled=false;hint.textContent='Cargando trabajadores…';
   try{const d=await Catalog.users({area:area.value,q:workerSearch.value.trim(),page:1,limit:100});if(closed||seq!==workerSerial)return;
    for(const w of d.users){workers.set(w.id,w);worker.add(new Option(`${w.nombre} · ${w.codigo}`,String(w.id)));}
    worker.disabled=false;hint.textContent=d.has_more?'Se muestran los primeros 100. Escribe un nombre o código para encontrar otros.':d.users.length?'Selecciona un trabajador y añádelo.':'No hay trabajadores en esta área para la búsqueda indicada.';
   }catch(e){if(!closed&&seq===workerSerial){hint.textContent='No se pudieron cargar los trabajadores.';showError(e);}}
  }
  area.onchange=()=>{workerSearch.value='';loadWorkers();};workerSearch.addEventListener('input',debounce(loadWorkers,300));worker.onchange=()=>{add.disabled=!worker.value;};
  add.onclick=()=>{const w=workers.get(Number(worker.value));if(!w)return;if(chosen.has(w.id))return showError('Ese trabajador ya fue añadido.');if(chosen.size>=50)return showError('Puedes asignar hasta 50 trabajadores por vez.');error.hidden=true;chosen.set(w.id,{...w,area:area.selectedOptions[0].textContent});renderChosen();area.value='';workerSearch.value='';loadWorkers();area.focus();};
  async function loadProjects(){const seq=++projectSerial;try{const d=await Catalog.projects({q:projectSearch.value.trim(),page:1,limit:100});if(closed||seq!==projectSerial)return;const current=project.value,old=project.selectedOptions[0]?.textContent;project.replaceChildren(new Option('Selecciona un proyecto…',''),...d.projects.map(p=>new Option(`${p.nombre} · ${p.area}`,String(p.id))));if(current&&!d.projects.some(p=>String(p.id)===current))project.add(new Option(old,current));project.value=current;$('#project-hint',form).textContent=d.has_more?'Se muestran los primeros 100. Escribe para encontrar otros proyectos.':'';}catch(e){if(!closed&&seq===projectSerial)showError(e);}}
  projectSearch.addEventListener('input',debounce(loadProjects,300));
  try{const d=await WorkAreas.list();if(closed)return;for(const a of d.areas)area.add(new Option(a.nombre,String(a.id)));area.add(new Option('Sin área asignada (usuarios anteriores)','sin-area'));if(d.has_more)showError('Hay demasiadas áreas para mostrarlas. Contacta al soporte.');}catch(e){showError(e);}
  loadProjects();
  form.addEventListener('submit',async e=>{
    e.preventDefault();error.hidden=true;if(!chosen.size)return showError('Añade al menos un trabajador.');
    let entrega;try{entrega=picker.getValue();}catch(err){return showError(err);}
    const body={trabajador_ids:[...chosen.keys()],descripcion:form.elements.descripcion.value,fecha_entrega:entrega,prioridad:form.elements.prioridad.value,proyecto_id:Number(project.value)||null};
    await withBusy($('[type=submit]',form),async()=>{try{const r=await Tasks.create(body);modal.close();toast(r.message,'success');await load();}catch(err){showError(err);}});
  });
}
$('#btn-add')?.addEventListener('click', openCreate);

if(isExpress){await initExpress({role});}else{route.onChange(()=>{restore();load(page);});restore();await load(page);}
// El identificador se conserva internamente para abrir una tarea desde calendario/notificaciones.
const linkedTask = new URLSearchParams(location.search).get('tarea');
if (!isExpress && linkedTask && /^[1-9]\d*$/.test(linkedTask)) await openDetail(Number(linkedTask));
