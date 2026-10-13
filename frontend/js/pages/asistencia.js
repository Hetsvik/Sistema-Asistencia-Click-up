import { Attendance } from '../api.js';
import { initPage } from '../layout.js';
import { $, debounce, esc, fmtDate, fmtTime, toast, withBusy } from '../ui.js';

const role = document.body.dataset.role;
await initPage({ role, page: 'inicio' });

// ---- Reloj (zona horaria de la empresa; la entrega el servidor en /attendance/today) ----
let companyTz; // undefined = zona del navegador
const tick = () => {
  const now = new Date();
  $('#clock-time').textContent = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: companyTz });
  $('#clock-date').textContent = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: companyTz });
};
tick();
setInterval(tick, 1000);

// ---- Historial ----
const body = $('#att-body');
const rowHtml = (r) => `<tr>
  ${role === 'admin' ? `<td>${esc(r.nombre)}</td>` : ''}
  <td>${fmtDate(r.fecha)}</td><td>${fmtTime(r.entrada)}</td>
  <td>${r.salida ? fmtTime(r.salida) : '<span class="muted">—</span>'}</td>
  <td><span class="badge ${r.estado === 'A tiempo' ? 'baja' : 'media'}">${esc(r.estado)}</span></td></tr>`;

async function loadHistory() {
  const q = $('#att-search')?.value.trim();
  try {
    const { records } = await Attendance.list({ q, limit: 100 });
    const cols = role === 'admin' ? 5 : 4;
    body.innerHTML = records.length ? records.map(rowHtml).join('')
      : `<tr><td colspan="${cols}" class="empty">Sin registros de asistencia.</td></tr>`;
  } catch (err) { toast(err.message, 'error'); }
}
$('#att-search')?.addEventListener('input', debounce(loadHistory, 350));

// ---- Marcación (solo trabajadores) ----
if (role === 'trabajador') {
  const btnIn = $('#btn-in');
  const btnOut = $('#btn-out');
  const status = $('#att-status');

  const paint = (registro) => {
    btnIn.disabled = !!registro;
    btnOut.disabled = !registro || !!registro.salida;
    status.textContent = !registro ? 'Aún no has marcado tu entrada hoy.'
      : registro.salida ? `Jornada completada: ${fmtTime(registro.entrada)} – ${fmtTime(registro.salida)}.`
      : `Entrada registrada a las ${fmtTime(registro.entrada)} (${registro.estado}).`;
  };

  const act = (btn, call, ok) => btn.addEventListener('click', async () => {
    let registro;
    await withBusy(btn, async () => {
      try { ({ registro } = await call()); toast(ok, 'success'); } catch (err) { toast(err.message, 'error'); }
    });
    if (registro) { paint(registro); loadHistory(); } // se pinta después: withBusy restaura el botón al terminar
  });
  act(btnIn, Attendance.checkIn, 'Entrada registrada.');
  act(btnOut, Attendance.checkOut, 'Salida registrada.');

  try { const t = await Attendance.today(); companyTz = t.tz; tick(); paint(t.registro); } catch (err) { toast(err.message, 'error'); }
}

loadHistory();
