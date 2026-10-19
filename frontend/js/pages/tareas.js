import { Catalog, Tasks } from '../api.js';
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
  if (isAdmin || t.estado === 'Completada') return { label: 'Ver', next: null, cls: 'outline' };
  return t.estado === 'Asignada' ? { label: 'Aceptar', next: 'En Progreso' } : { label: 'Completar', next: 'Completada' };
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
      try { await Tasks.setStatus(task.id, a.next); toast(a.next === 'En Progreso' ? 'Tarea aceptada.' : 'Tarea completada.', 'success'); await load(); }
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

// ---------- Detalle + chat ----------
async function openDetail(id) {
  let task;
  try { task = (await Tasks.get(id)).task; } catch (err) { return toast(err.message, 'error'); }

  const modal = openModal({
    title: `Tarea · ${task.proyecto}`,
    wide: true,
    onClose: () => clearInterval(timer),
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
        <select id="d-set" class="input plain">${ESTADOS.map((s) => `<option ${s === task.estado ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <button type="button" class="btn sm" id="d-save">Guardar</button></div>` : ''}
      <h3 class="sub">Conversación</h3>
      <div class="chat" id="chat" aria-live="polite"></div>
      <form class="chat-form" id="chat-form">
        <input class="input plain" id="chat-input" maxlength="1000" placeholder="Escribe un mensaje…" autocomplete="off" required>
        <button class="btn sm" type="submit" aria-label="Enviar">${icon('send')}</button>
      </form>`,
  });

  const chat = $('#chat', modal.el);
  const paintChat = async () => {
    try {
      const { comments } = await Tasks.comments(id);
      const stick = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
      chat.innerHTML = comments.length ? comments.map((c) => `
        <div class="msg ${c.autor === user.nombre ? 'mine' : ''}">
          <b>${esc(c.autor)} <i>${esc(c.rol)}</i></b><p>${esc(c.mensaje)}</p><time>${fmtDateTime(c.fecha)}</time>
        </div>`).join('') : '<p class="muted center">Aún no hay mensajes.</p>';
      if (stick) chat.scrollTop = chat.scrollHeight;
    } catch { /* se reintenta en el siguiente ciclo */ }
  };
  const timer = setInterval(paintChat, POLL_COMMENTS_MS);
  await paintChat();
  chat.scrollTop = chat.scrollHeight;

  $('#chat-form', modal.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#chat-input', modal.el);
    const text = input.value.trim();
    if (!text) return;
    try { await Tasks.addComment(id, text); input.value = ''; await paintChat(); chat.scrollTop = chat.scrollHeight; }
    catch (err) { toast(err.message, 'error'); }
  });

  $('#d-save', modal.el)?.addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    try {
      const res = await Tasks.setStatus(id, $('#d-set', modal.el).value);
      $('#d-estado', modal.el).innerHTML = `${badgeEstado(res.task.estado)} ${badgePrioridad(res.task.prioridad)}`;
      toast('Estado actualizado.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }));
}

// ---------- Crear tarea (admin) ----------
async function openCreate() {
  let users, projects;
  try { [{ users }, { projects }] = await Promise.all([Catalog.users(), Catalog.projects()]); }
  catch (err) { return toast(err.message, 'error'); }

  const modal = openModal({
    title: 'Añadir tarea',
    html: `<form id="new-task" class="form-grid" novalidate>
      <label class="full">Trabajador
        <select class="input plain" name="trabajador_id" required><option value="">Selecciona…</option>
          ${users.map((u) => `<option value="${u.id}">${esc(u.nombre)} · ${esc(u.cargo)}</option>`).join('')}</select></label>
      <label class="full">Proyecto
        <select class="input plain" name="proyecto_id" id="f-proj" required><option value="">Selecciona…</option>
          ${projects.map((p) => `<option value="${p.id}">${esc(p.nombre)} (${esc(p.area)})</option>`).join('')}
          <option value="__new">+ Nuevo proyecto…</option></select></label>
      <label id="f-new-name" hidden>Nombre del proyecto<input class="input plain" name="np_nombre" maxlength="120"></label>
      <label id="f-new-area" hidden>Área / departamento<input class="input plain" name="np_area" maxlength="80"></label>
      <label class="full">Descripción
        <textarea class="input plain" name="descripcion" rows="3" maxlength="500" required></textarea></label>
      <label class="full">Fecha y hora de entrega
        <input class="input plain" type="datetime-local" name="fecha_entrega" required></label>
      <p class="form-message is-error full" id="f-error" hidden></p>
      <div class="modal-actions full"><button type="button" class="btn outline" data-close>Cancelar</button>
        <button type="submit" class="btn">Crear tarea</button></div>
    </form>`,
  });

  const form = $('#new-task', modal.el);
  $('#f-proj', modal.el).addEventListener('change', (e) => {
    const isNew = e.target.value === '__new';
    $('#f-new-name', modal.el).hidden = !isNew;
    $('#f-new-area', modal.el).hidden = !isNew;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const err = $('#f-error', modal.el);
    err.hidden = true;
    const body = {
      trabajador_id: Number(f.trabajador_id) || null,
      descripcion: f.descripcion,
      fecha_entrega: f.fecha_entrega,
    };
    if (f.proyecto_id === '__new') body.proyecto_nuevo = { nombre: f.np_nombre, area: f.np_area };
    else body.proyecto_id = Number(f.proyecto_id) || null;

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