# Rendimiento y paginación del ERP

Actualización incremental sobre la versión con seguridad/correo corporativo y corrección de fecha de asistencia de Perú. No sustituye el backend ni cambia de plataforma. No fue desplegada en la cuenta real.

## Cambios efectivos

- Tareas: paginación SQL con total, tamaño y página; desaparece el límite silencioso de las primeras 200 tareas. Las páginas posteriores permiten consultar el resto.
- Usuarios administrados, proyectos y anuncios: paginación existente ampliada con tamaño, salto a página y rutas enlazables.
- Asistencia diaria: consulta solamente los trabajadores de la página (20 por defecto; máximo 50). Obtiene únicamente la vigencia de horario aplicable hoy, no todas las versiones históricas por trabajador.
- Historial: combina registros antiguos y tramos programados/marcados en SQL, cuenta y aplica LIMIT/OFFSET antes de devolver filas a JavaScript. No obtiene todo el historial para recortarlo en memoria.
- Cálculo de tramos: mantiene horario por vigencia, plan congelado al marcar, descanso, dos tramos y tolerancia inclusiva de diez minutos. No mueve fechas ni actualiza asistencias anteriores.
- Reportes: puntualidad agregada en D1; el resumen no devuelve detalles. Detalles solo al exportar, con los límites existentes de 10.000 tareas y 50.000 tramos. Se elimina una consulta de tareas duplicada. Los porcentajes/gráficos corresponden al conjunto filtrado, no a una página.
- Calendario: conteos agrupados por día para las 42 celdas y agenda del día paginada. Ya no descarga todos los detalles del mes. Se conservan conteos y enlaces a las tareas; las miniaturas de títulos dentro de cada celda se sustituyen por el conteo para evitar otra descarga masiva.
- Inicio: obtiene COUNT/SUM de pendientes; no descarga tareas para contarlas.
- Formularios de tareas y selector de trabajador de reportes: búsqueda y navegación de catálogos en bloques de 20 opciones. No se recorren automáticamente todas las páginas del catálogo de proyectos.
- Paginadores: Anterior/Siguiente, ir a página y 10/20/50/100 filas (asistencia diaria: 10/20/50). La API impone límites incluso si se omite la interfaz.
- Historial de asistencia móvil: filas como tarjetas con todas las columnas visibles, sin tener que desplazar lateralmente para ver salida/estado.

## Rutas de interfaz (no son páginas HTML nuevas)

Se reutilizan las interfaces existentes mediante query strings. Recargar y Atrás/Adelante recuperan la página/filtros; nunca se guarda una contraseña o token en estos enlaces.

```text
/admin/usuarios?page=2&limit=20&q=Ana&rol=trabajador&estado=Activo
/admin/asistencia?vista=hoy&page=2&limit=20
/admin/asistencia?vista=historial&page=2&desde=2026-10-01&hasta=2026-10-31
/usuarios/asistencia?page=2&desde=2026-10-01&hasta=2026-10-31
/admin/tareas?page=2&estado=Asignada&q=planos
/usuarios/tareas?page=2&limit=20
/admin/anuncios?page=2&sort=fecha&order=desc
/usuarios/anuncios?page=2
/admin/proyectos?page=2&order=desc
/admin/calendario?mes=2026-10&dia=2026-10-27&page=2
/usuarios/calendario?mes=2026-10&dia=2026-10-27&page=2
/admin/reportes?periodo=mes&trabajador=1&prioridad=Alta&metrica=prioridad&grafico=dona
```

Las fechas anteriores son ejemplos, no fechas fijadas en el código. Los valores por defecto pueden omitirse del enlace. Los nombres/búsquedas de estos enlaces aparecen en el historial del navegador: no compartir enlaces que contengan datos personales fuera de la organización.

## API

Se mantienen las rutas; las nuevas respuestas de listados añaden `total`, `page`, `pages`, `limit` y `has_more`.

```text
GET /api/tasks?page=2&limit=20
GET /api/tasks?resumen=1
GET /api/tasks?calendar=2026-10&vista=resumen
GET /api/tasks?dia=2026-10-27&page=2&limit=20
GET /api/admin/users?page=2&limit=20
GET /api/users?q=Ana&page=1&limit=20
GET /api/projects?page=2&limit=20
GET /api/announcements?page=2&limit=20
GET /api/attendance/daily?page=2&limit=20
GET /api/attendance?desde=2026-10-01&hasta=2026-10-31&page=2&limit=20
```

- Máximo general: 100 resultados; diaria: 50. Tamaño predeterminado de la interfaz: 20.
- API de historial sin tamaño: 50 por compatibilidad; `offset` sigue admitido, pero no puede mezclarse con `page`. La interfaz usa `page`.
- Historial sin fechas: últimos 30 días del servidor, hora Perú. Intervalo máximo de consulta: 366 días; se puede consultar otro año/intervalo con los filtros. Más amplitud devuelve 400, no un resultado incompleto.
- La expansión prevista de horarios se limita a 200.000 tramos potenciales por consulta; si excede ese presupuesto se devuelve 413 y se solicita filtrar trabajador/periodo. No se muestra un porcentaje parcial.
- Los listados se ordenan de forma determinista con identificadores como desempate. La paginación numérica usa OFFSET: no representa una fotografía inmutable mientras otros usuarios insertan/eliminan filas. Para historiales extremadamente profundos convendrá evaluar cursores y agregados persistentes.
- `calendar=...` y el filtro antiguo `notifications=1` ya no son excepciones sin límite: devuelven páginas. La bandeja vigente de notificaciones usa su endpoint propio por cursor, conservado.
- El catálogo de proyectos por cursor `before` se conserva; no mezclar `before` y `page`.
- La API vuelve a comprobar sesión y permisos en cada petición. Un trabajador no accede a datos ajenos cambiando filtros, páginas o identificadores.

## Frecuencia y recursos

| Operación | Antes | Ahora |
|---|---:|---:|
| Diaria del administrador | 3 s | 30 s |
| Estado de asistencia propio | 3 s | 15 s |
| Notificaciones | 3 s | 15 s |
| Conversación abierta | 3 s | 10 s |

Solo con la pestaña visible; los nuevos sondeos de asistencia/chat no se solapan, pausan offline y aplican espera progresiva ante errores. Las marcaciones y envíos se consultan inmediatamente después de la acción. El reloj visible sigue avanzando cada segundo desde su referencia de servidor, sin pedir la hora cada segundo. Los historiales se consultan al entrar/paginar/filtrar, no en bucle.

Notificaciones y mensajes conservan sus cursores; como máximo 200 filas de cada lista en DOM. Al navegar por notificaciones antiguas se pausa la incorporación de novedades hasta cerrar/reabrir la bandeja.

## Archivos estáticos y fuentes

`node scripts/build-assets.mjs` genera `/static/<version>/js/...` y `/static/<version>/css/...` con un hash de contenido de la versión y actualiza las referencias HTML. Las importaciones relativas siguen funcionando. No requiere paquetes nuevos.

- `/static/*`: `public, max-age=31536000, immutable`.
- HTML: no se convierte en contenido immutable; conserva revalidación.
- API y adjuntos privados: mantienen `no-store`. No aplicar una regla «Cache Everything» a `/api/*` ni publicar R2.
- Se conservan hasta tres versiones locales de activos para facilitar pestañas abiertas entre despliegues. No reemplaza una estrategia de compatibilidad API/frontend ni garantiza conservar pestañas muy antiguas durante despliegues repetidos.
- Las fuentes se descubren mediante `<link>` en el HTML y `preconnect`; se elimina el `@import` encadenado. Se mantiene `display=swap` y CSP. Las fuentes siguen alojadas en Google: no se afirma que se hayan autoalojado ni reducido sus bytes.
- Fondo de ondas: máximo aproximado de 30 FPS, velocidad compensada y respeto de reducción de movimiento/pausa en segundo plano.
- `theme-init.js` sigue ejecutándose antes de pintar para evitar el destello de tema; ahora usa ruta versionada. No se habilita `unsafe-eval` ni scripts inline para mejorar métricas.

## Instalación y uso de Wrangler

1. Respaldar proyecto y D1; comprobar recuperación en un entorno de prueba.
2. Copiar el CONTENIDO de `archivos/` a la raíz del proyecto, combinando carpetas y reemplazando los archivos indicados. No copiar `archivos` como una subcarpeta.
3. No reemplazar `wrangler.toml`, SESSION_SECRET ni bindings. No importar fixtures. Esta actualización añade solamente la migración de índices 0010.
4. Ejecutar desde la raíz:

```powershell
npm test
npx wrangler d1 migrations apply bd-empresa2 --remote
node scripts/build-assets.mjs
npx wrangler deploy --dry-run
npx wrangler deploy
```

Se sigue desplegando SIN `--env`. `npm test` requiere la versión de Node compatible ya indicada por el proyecto (22.5 o superior; validación realizada con Node 24).

El ZIP contiene los activos ya generados, pero se recomienda regenerarlos tras combinar archivos, sobre todo si tienes personalizaciones. No editar manualmente los archivos dentro de `frontend/static/`: editar sus fuentes en `frontend/js/` o `frontend/css/` y volver a generar.

`npm run deploy` y `npm run deploy:check` ejecutan automáticamente su paso previo de generación. Si prefieres que un `wrangler deploy` directo también los regenere siempre, puedes integrar en TU `wrangler.toml`:

```toml
[build]
command = "node scripts/build-assets.mjs"
```

Si ya existe `[build]`, integrar el comando con la compilación existente; no duplicar la sección. Esta entrega no modifica tu configuración automáticamente.

No cambiar bucket, dominio, secretos, permisos ni correos. No ejecutar otra vez migraciones anteriores manualmente. R2 continúa privado y con las mismas cuotas.

## Observabilidad y continuidad

Se añade `Server-Timing: app;dur=...` a las respuestas API del Worker para inspección en DevTools. Es duración de la petición, no un análisis de cada consulta ni una garantía de latencia. No incluye cuerpos, SQL, credenciales ni datos personales. Se conserva la configuración existente de seguridad y observabilidad.

En Cloudflare se deben revisar uso de CPU, errores, latencias, filas leídas/escritas D1, operaciones R2 y costos. Los presupuestos/alertas y respaldos reales dependen de tu cuenta y no han sido configurados por este ZIP. No se ha añadido Redis, Queues, WebSockets/Durable Objects, MFA, antivirus, exportación asíncrona ni una base de datos externa: no se necesitan introducir sin una medición que lo justifique.

Antes de aumentar considerablemente usuarios: ejecutar en STAGING una carga gradual con sesiones válidas, inicios de jornada, reportes y adjuntos; medir p95/p99, errores, CPU y costos. No usar la base ni el bucket de producción para generar carga ficticia. La paginación reduce el trabajo, pero no certifica un número de usuarios simultáneos ni elimina los límites de D1/Workers.
