// Funciones puras: las fechas de D1 son horas locales de la empresa, sin conversión del navegador.
export const notificationKey = t => JSON.stringify([t.id, t.fecha_entrega]);
export const visibleNotifications = (tasks, dismissed) => {
  const hidden = new Set(dismissed);
  return tasks.filter(t => t.estado !== 'Completada' && t.prioridad === 'Alta' && !hidden.has(notificationKey(t)));
};
export function groupTaskEvents(tasks) {
  const days = new Map();
  for (const task of tasks) {
    const date = String(task.fecha_entrega ?? '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (!date) continue;
    const event = { ...task, day: date[1], time: date[2], name: task.proyecto || 'Tarea' };
    if (!days.has(event.day)) days.set(event.day, []);
    days.get(event.day).push(event);
  }
  for (const events of days.values()) events.sort((a,b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'es') || a.id-b.id);
  return days;
}
