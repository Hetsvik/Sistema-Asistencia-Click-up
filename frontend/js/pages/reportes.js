import { Catalog, Reports } from '../api.js';
import { drawBarChart } from '../chart.js';
import { initPage } from '../layout.js';
import { $, debounce, esc, toast } from '../ui.js';

const role = document.body.dataset.role;
const isAdmin = role === 'admin';
await initPage({ role, page: 'inicio' });

const state = { trabajador: '', periodo: 'mes', data: null };

function paint() {
  const d = state.data;
  if (!d) return;
  const a = d.asistencia;
  $('#stat-asist').textContent = a.esperadas === null ? String(a.total) : `${a.total}/${a.esperadas}`;
  $('#stat-asist-sub').textContent = `${a.a_tiempo} a tiempo · ${a.tardanzas} tardanza${a.tardanzas === 1 ? '' : 's'}`;
  $('#stat-tareas').textContent = String(d.tareas.completadas);
  $('#stat-tareas-sub').textContent = `de ${d.tareas.total} · ${d.tareas.fuera_de_plazo} fuera de plazo`;
  $('#stat-efic').textContent = `${d.eficiencia}%`;
  $('#report-scope').textContent = d.trabajador ? d.trabajador.nombre : isAdmin ? 'Toda la empresa' : 'Mi desempeño';

  const hasData = a.total + d.tareas.total > 0;
  $('#chart-empty').hidden = hasData;
  $('#chart').hidden = !hasData;
  if (hasData) {
    drawBarChart($('#chart'), [
      { label: 'A tiempo', value: a.a_tiempo, tone: 'ok' },
      { label: 'Tardanzas', value: a.tardanzas, tone: 'warn' },
      { label: 'Asignadas', value: d.tareas.asignadas, tone: 'gold' },
      { label: 'En progreso', value: d.tareas.en_progreso, tone: 'gold' },
      { label: 'Completadas', value: d.tareas.completadas, tone: 'ok' },
    ]);
  }
}

async function load() {
  try { state.data = await Reports.summary({ periodo: state.periodo, trabajador: state.trabajador }); paint(); }
  catch (err) { toast(err.message, 'error'); }
}

$('#periodo').addEventListener('change', (e) => { state.periodo = e.target.value; load(); });
window.addEventListener('resize', debounce(paint, 150));

if (isAdmin) {
  let users = [];
  try {
    users = (await Catalog.users()).users;
    $('#users-list').innerHTML = users.map((u) => `<option value="${esc(u.nombre)}"></option>`).join('');
  } catch (err) { toast(err.message, 'error'); }

  $('#user-search').addEventListener('input', (e) => {
    const value = e.target.value.trim().toLowerCase();
    const match = users.find((u) => u.nombre.toLowerCase() === value);
    const next = match ? String(match.id) : '';
    if (!value || match) { if (next !== state.trabajador) { state.trabajador = next; load(); } }
  });
}

load();
