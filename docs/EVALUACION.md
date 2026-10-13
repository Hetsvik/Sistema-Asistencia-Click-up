# Evaluación del proyecto y recomendaciones

## Estado encontrado (antes de esta actualización)

| Área | Estado | Detalle |
|---|---|---|
| Backend | 🔴 Casi inexistente | Solo `POST /api/auth/login` funcionaba (en `src/index.js`). Las rutas de asistencia, tareas, comentarios y reportes estaban escritas en Python/FastAPI dentro de `functions/`, que **no se ejecuta** con un Worker (`main = src/index.js`). |
| Sesión y permisos | 🔴 Sin sesión | El login devolvía datos y se guardaban en `localStorage`; las rutas recibían `id_trabajador` por URL, así que cualquiera podía consultar o modificar datos de otro. |
| Contraseñas | 🔴 Texto plano | PIN sin cifrar en la BD. |
| Datos en el repositorio | 🔴 Sensible | `database/schema.sql` incluía nombres, correos, teléfonos y PIN reales; `.wrangler/` (BD local) estaba versionado; no había `.gitignore`. |
| Navegación | 🟠 Rota | El login redirigía a `html/dashboard-empleado.html` (no existe); `html/inicio.html` apuntaba a un CSS con ruta inválida; el menú usaba `preventDefault` + `alert`. Las 8 páginas nuevas enlazaban a `inicio.html` inexistente. |
| CSS | 🟠 Duplicado | 5 hojas (`main`, `inicio`, `dashboard`, `styles`, `chat`) con paletas distintas; solo 2 en uso. |
| Hora de asistencia | 🟠 Incorrecta | `datetime('now','localtime')` en D1 devuelve UTC; con la regla "A tiempo ≤ 09:40" las tardanzas salían mal. |
| JS | 🟡 Vacíos | `attendance.js`, `tasks.js`, `reports.js`, `chat.js` y `google_drive/upload.py` eran solo un comentario. |
| Calidad | 🟡 | Sin pruebas ni CI; terminaciones de línea mezcladas (diffs de miles de líneas). |

## Qué se resolvió

- API completa en JavaScript dentro del Worker (ver README) con sesión firmada, roles y validaciones.
- PIN con hash (migración automática) y bloqueo por intentos.
- Hora local de la empresa (`TIMEZONE` en `wrangler.toml`).
- Frontend modular: `config.js` (rutas), `api.js`, `layout.js`, un script por página; un solo `styles.css`.
- Esquema como migraciones de D1 (sin datos reales) + datos ficticios para desarrollo.
- 10 pruebas automáticas de la API; recorrido completo probado en navegador (login, marcación, tareas, chat, reportes, móvil).

## Verificación posterior

El backend fue desplegado en `erp-construcciones-sac-test`, conectado a `bd-empresa2`, y se verificaron los accesos de administrador y trabajador. Este repositorio conserva ese destino. Las pruebas de la API también usan SQLite local como sustituto de D1.

## Acciones urgentes (hoy)

1. **Cambiar los PIN reales** y tratarlos como filtrados: estuvieron en `schema.sql` dentro del historial de git. Si el repo es público,
   limpia el historial (`git filter-repo`) además de rotar los PIN.
2. Definir `SESSION_SECRET` (`wrangler secret put`).
3. Quitar `.wrangler/` del control de versiones (comando en el README).
4. Activar *Rate limiting rules* y WAF de Cloudflare sobre `/api/auth/login`.

## Qué añadir (por prioridad)

**Imprescindible**
- **Módulo Usuarios (admin):** alta/baja de empleados, cambio y reseteo de PIN, y que el propio usuario cambie su PIN desde *Cuenta*. Hoy los PIN solo se cambian por SQL.
- **Asistencia del administrador:** la tabla `Asistencia` solo referencia `Trabajadores`; por eso los administradores no ven los botones de marcación. Decide si deben marcar y generaliza la tabla.
- **Horario por trabajador:** la columna `HoraIngreso` existe pero no se usa; la tardanza está fija en 09:40 en el esquema.
- **Justificaciones, permisos, vacaciones y feriados:** hoy una falta y un permiso se ven igual, y los "días hábiles" del reporte ignoran feriados.

**Alto valor**
- **Alertas de plazo:** Cron Trigger de Workers + correo (Email Workers / Resend). La campana actual solo avisa dentro de la app.
- **Adjuntos en tareas:** tabla `Archivos` ya existe. Recomiendo **R2** (nativo de Cloudflare) en lugar de Google Drive: sin OAuth ni cuotas externas.
- **Prioridad real en tareas:** hoy se deduce del plazo; una columna `Prioridad` elegible al crear la tarea es más fiel al diseño.
- **Editar, reasignar y eliminar tareas**; actividades/subtareas (tabla `Actividades` sin uso).
- **Reportes:** exportar a CSV/PDF, comparativas entre trabajadores y evaluaciones mensuales automáticas (tabla `Evaluaciones_Rendimiento` sin uso).
- **Anuncios, Calendario, Configuración** (ya están en el menú, aún sin pantalla).

**Calidad y operación**
- Cloudflare Builds: `npm test` antes de `npm run deploy` en `main`.
- Pruebas con D1 real (`@cloudflare/vitest-pool-workers`).
- Registro de auditoría (quién cambió qué) y revocación de sesiones: hoy un empleado marcado *Inactivo* sigue activo hasta que expire su sesión (máx. 8 h).
- Paginación en tareas y asistencia (la API ya acepta `limit` y `offset` en asistencia).
- Accesibilidad: foco en modales, contraste de textos tenues y navegación por teclado en el menú de filtros.
- PWA instalable para marcar asistencia desde el celular.
