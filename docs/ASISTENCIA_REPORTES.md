# Asistencia por tramos, reportes y preferencias globales

## Alcance
Actualización incremental sobre la versión con horarios laborales (migraciones 0001–0006). No cambia la configuración de Cloudflare, no reemplaza datos y no conecta R2. El diseño conserva negro/dorado y añade claro marfil/dorado.

## Asistencia y puntualidad
- Administrador: pestañas **Asistencia de hoy** e **Historial** en la misma pantalla. El listado diario incluye trabajadores activos aunque no hayan marcado, búsqueda y páginas de 50 personas. Se consulta cada 3 segundos mientras la pestaña está visible, sin recargar la página ni superponer consultas. Usa el día de Perú, incluido el cambio de fecha.
- Trabajador: únicamente sus entradas/salidas, tramos e historial. El servidor fuerza su identidad, incluso si se manipulan parámetros de consulta.
- Hora oficial: servidor, `America/Lima` (UTC−5). La hora/zona del dispositivo no decide la puntualidad.
- Por cada tramo, desde su inicio hasta **10 minutos exactos inclusive**, una entrada es puntual. Por ejemplo: 08:00 → 08:10:00 puntual; 08:10:01 genera una falta. No hay redondeo al minuto.
- Después del límite, una entrada ausente también cuenta como una falta. Si después llega tarde, sigue siendo **una sola falta en ese tramo**, no dos. Dos tramos pueden sumar dos faltas en un día. La interfaz distingue fuera de tolerancia y sin entrada.
- Los tramos futuros no cuentan. Descansos y días sin horario vigente no generan faltas. Una semana configurada sin días activos es descanso, no un horario pendiente.
- Porcentaje = entradas puntuales / tramos evaluados × 100, con un decimal. Un tramo se evalúa al marcar o al superar la tolerancia. Si no hay tramos evaluados se muestra “Sin datos”, no 0 %.
- **Vigencia desde mañana en Perú**: la migración registra el horario existente para el día siguiente. Altas, modificaciones, retiradas de horario y cambios de rol/estado se versionan para el día siguiente. El horario vigente del día no cambia por editarlo. La última edición del mismo día sustituye la versión prevista para mañana.
- No se inventan horarios ni faltas anteriores a la primera vigencia registrada. Los registros antiguos de `Asistencia` siguen visibles como históricos; sus estados previos se conservan, pero quedan fuera de la nueva fórmula de puntualidad.
- Las faltas sin marcación se calculan desde las versiones conocidas al consultar fechas pasadas, aunque nadie haya abierto el sitio esos días. No se necesita cron y no se incrementa un contador repetidamente con cada consulta.
- Cada entrada guarda las horas previstas de sus tramos. Las marcaciones no se reescriben al cambiar horarios posteriores.
- No se abre un segundo tramo con otro abierto. El segundo no puede comenzar antes del fin previsto del primero; no se permite una entrada nueva al llegar al fin previsto del propio tramo. Debe marcarse la salida antes de abrir el siguiente. Una entrada temprana del primer tramo se admite el mismo día. No hay turnos que crucen medianoche (la validación del horario de la versión anterior sigue vigente).
- Personas sin horario vigente conservan la marcación diaria anterior sin sanción automática por horario. Puede pasar esto el día de instalación, antes de que entre en vigor su horario.
- Historial inicial: últimos 30 días; filtros Desde/Hasta modificables, con páginas de 50 registros. Las tablas anchas se desplazan horizontalmente dentro de su contenedor en móvil.

## Preferencias en todo el sitio
En Configuración se eligen tema oscuro/claro y tamaño de texto. Se aplican en las páginas del usuario, modales, calendarios, conversación y gráficos; también se sincronizan entre pestañas abiertas de la misma cuenta. El acceso recuerda únicamente la última apariencia de ese navegador, sin información personal.

Son preferencias **por cuenta en ese navegador**, guardadas en `localStorage`. No hay sincronización entre dispositivos ni almacenamiento de preferencias en D1. Los filtros de tipos de notificación se aplican a la campana en todas las páginas sin borrar el historial ni detener el sondeo existente. Los datos personales y el cambio de contraseña siguen usando las rutas de cuenta existentes.

## Reportes
- Admin: buscar por nombre/código y seleccionar trabajador, o ver el equipo. Un trabajador solo recibe sus propios datos.
- Periodo: esta semana, este mes o todo el historial. Las tareas se agrupan por su fecha de asignación; las asistencias por su fecha peruana.
- Filtro de prioridad Alta/Media/Baja: afecta **solo a tareas**, no a puntualidad/faltas. Tareas antiguas sin prioridad explícita aparecen como “Sin prioridad”; no se deduce su prioridad a partir del vencimiento actual.
- Métricas gráficas: tareas por prioridad, tareas por estado y puntualidad por tramo. Tipos: barras verticales, horizontales y dona, con tabla de valores y colores consistentes.
- Indicadores: puntualidad, faltas por tramo, tareas completadas y eficiencia (completadas / asignadas en el periodo y filtros seleccionados).
- Los datos se solicitan al entrar/cambiar filtros; no se recarga toda la página. El sondeo de asistencia es independiente y solo corre en su pantalla activa.

## Descargas
- **PNG**: imagen del gráfico y tema/tipo seleccionados.
- **Excel `.xlsx` real**: libro OOXML con tres hojas `Resumen`, `Tareas`, `Puntualidad`. Contiene filtros, intervalo, zona, tolerancia, cantidades y detalle con identificadores para cruces. Cantidades/indicadores son celdas numéricas, no una página HTML renombrada. Las fechas/horas se exportan como texto local peruano; los valores vacíos quedan sin dato.
- **CSV UTF-8**: elegir resumen, tareas o puntualidad. Se incluyen comillas, escape y BOM; textos que puedan interpretarse como fórmulas se neutralizan. Abrir desde Datos → Desde texto/CSV si Excel no separa columnas automáticamente.
- **Power BI Desktop**: Obtener datos → Libro de Excel, seleccionar las tres hojas; o Texto/CSV con UTF-8 y separador coma. `ID trabajador` permite relaciones entre tablas; las columnas de fecha pueden convertirse con configuración regional adecuada. No se genera `.pbix`, no hay conexión al servicio Power BI ni actualización programada.
- El XLSX contiene **datos**, no un gráfico de Excel incrustado: usa Insertar → Gráfico, o importa los datos en Power BI. El PNG es la descarga visual independiente.
- Exportaciones respetan trabajador, periodo y prioridad. Se limitan a 10 000 tareas y 50 000 tramos; un exceso solicita reducir periodo/persona. Los tramos pendientes pueden aparecer en el detalle con `Evaluado=0`; filtrar `Evaluado=1` para reproducir el porcentaje.

## R2 y seguridad
El clip sigue siendo una selección local de archivos, sin subir/enviar/descargar/leerlos en el sistema. Este paquete no habilita storage, no añade credenciales ni expone un bucket. `docs/R2_PREPARACION.md` de la versión anterior continúa siendo la referencia. Activar R2 por sí solo no completa la integración: el siguiente paso debe conectar el backend autenticado, permisos de conversación y objetos privados.

No incluye contraseñas, secretos, bases reales ni datos de prueba para importar. Solo el servidor decide a qué trabajador pertenecen las marcaciones y reportes. Los cambios de base son aditivos; no se tocan las columnas generadas históricas de `Asistencia`.
