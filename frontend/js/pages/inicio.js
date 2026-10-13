import { Attendance, Tasks } from '../api.js';
import { initPage } from '../layout.js';
import { $, fmtTime } from '../ui.js';

const role = document.body.dataset.role;
const user = await initPage({ role, page: 'inicio' });
$('#welcome').textContent = `Hola, ${user.nombre.split(' ')[0]}`;

// Resumen rápido en las tarjetas (si algo falla, se deja el texto por defecto).
try {
  const { tasks } = await Tasks.list();
  const pendientes = tasks.filter((t) => t.estado !== 'Completada').length;
  $('[data-stat="tareas"]').textContent = pendientes
    ? `${pendientes} tarea${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'}`
    : 'Sin tareas pendientes';

  if (role === 'trabajador') {
    const { registro } = await Attendance.today();
    $('[data-stat="asistencia"]').textContent = !registro ? 'Aún no marcas tu entrada'
      : registro.salida ? `Jornada cerrada · salida ${fmtTime(registro.salida)}`
      : `Entrada registrada a las ${fmtTime(registro.entrada)}`;
  }
} catch { /* sin resumen */ }
