# R2 privado: integración activa de adjuntos

Esta guía sustituye la preparación del clip local de versiones anteriores. El código de esta entrega implementa subida, descarga autenticada y vistas previas limitadas. **No se ha conectado ni probado el bucket de producción desde este entorno.** Se probó con Worker, D1 y R2 locales.

## Configuración de producción
Bucket ya creado: `erp-adjuntos`, en la misma cuenta del Worker. Mantener `r2.dev` y dominios públicos deshabilitados. En el `wrangler.toml` real, sin `--env`, declarar **una sola vez**:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "erp-adjuntos"
```

Para recuperación de subidas interrumpidas, el Worker incorpora `scheduled`. Añadir o fusionar con la configuración de cron existente (no duplicar `[triggers]`):

```toml
[triggers]
crons = ["17 * * * *"]
```

Se ejecuta cada hora en el minuto 17, según UTC. Si tienes otros cron, conservarlos en la misma lista. Este ERP no tenía un manejador `scheduled` previo. Si has añadido uno por tu cuenta, integrar ambas tareas en lugar de sobrescribirlo. El cron procesa como máximo 20 envíos incompletos por ejecución; nunca borra un envío confirmado.

No hacen falta claves S3, token en frontend, CORS, dominios públicos ni URLs firmadas. El navegador usa el mismo origen del ERP y el Worker usa el binding nativo. No usar `remote = true` para las pruebas locales: `wrangler dev` debe trabajar con objetos locales separados.

## Migración
Aplicar `database/migrations/0008_adjuntos_r2.sql` sobre la base que ya tiene 0001–0007. Crea `Envios_R2` (reserva, estado, idempotencia y recuperación) y `Adjuntos_R2` (metadatos del archivo confirmado). No modifica la tabla heredada `Archivos` ni inventa campos GoogleDrive.

Los objetos se guardan en R2 y sus metadatos en D1. Ambas partes son necesarias: **respaldar D1 no respalda los bytes de R2**. No borrar objetos manualmente sin revisar sus metadatos; aparecerían como no disponibles. Esta entrega no incorpora borrado de archivos enviados desde la interfaz. El botón quitar solo retira archivos pendientes de enviar.

## Uso
En una tarea, seleccionar archivos con el clip, añadir opcionalmente un mensaje y pulsar Enviar. Se admite enviar solo archivos. El servidor crea el comentario con sus adjuntos únicamente después de que R2 confirme los objetos y D1 confirme la operación. La lista de conversación se consulta cada 3 segundos mientras está visible, sin peticiones de lectura superpuestas.

Los archivos pendientes no están enviados ni guardados. Si falla el envío, se conservan en memoria para reintentar. Se bloquea cerrar el diálogo con Escape/clic mientras se está enviando. Una navegación, cierre de pestaña o corte de conexión puede interrumpir el proceso: volver a abrir la tarea y comprobar su conversación antes de repetir una selección nueva.

El texto sin archivos conserva la ruta anterior y puede enviarse aunque no exista binding R2. Con archivos y sin binding se devuelve 503, nunca éxito ficticio. Configuración → Mis documentos muestra si el binding está declarado; **eso no comprueba la existencia/permisos del bucket remoto**. El primer envío y descarga tras publicar son la comprobación real.

## Formatos, límites y cuotas
- Por envío: 5 archivos como máximo, 10 MiB por archivo y 25 MiB en total. El tamaño HTTP multipart está acotado a 26 MiB, aun sin Content-Length. Los límites se comprueban también en servidor.
- Cuota acumulada por tarea: 250 MiB o 1 000 archivos. Por autor: 1 GiB o 5 000 archivos. Incluye reservas activas para evitar que envíos paralelos evadan la cuota. Son límites iniciales de la aplicación, no del plan de Cloudflare; se ajustan en `src/lib/attachment-files.js` si cambia la política de la organización.
- Permitidos: PDF, PNG/JPG/WebP, TXT/CSV UTF-8, DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP. Se rechazan vacíos, tipos activos como HTML/SVG/ejecutables y nombres con rutas/caracteres de control.
- El MIME declarado por el navegador no se considera prueba. Se inspeccionan firmas/contendedores, texto UTF-8 y el directorio de ZIP/Office. No se extrae el ZIP. Se rechazan ZIP cifrados/multipartidos, rutas inseguras y documentos OOXML con `vbaProject.bin`.
- **No es un antivirus ni una validación completa de cada formato.** Los contenedores Office antiguos pueden incluir macros y un ZIP puede contener contenido no confiable. Descargar y abrir solo archivos de confianza, con las protecciones del equipo activas. No se analiza malware en un servicio externo ni se ejecutan documentos en el ERP.

## Vistas previas y descarga
- PNG/JPG/WebP: imagen en un diálogo.
- TXT/CSV UTF-8: texto mediante `textContent`, sin interpretar HTML ni scripts. Vista previa de texto hasta 1 MiB; por encima se ofrece descargar.
- PDF, Office y ZIP: **descarga**, no visor interno ni conversión. Abrir con una aplicación adecuada del equipo. No hay edición colaborativa, extracción de ZIP ni ejecución de macros.
- Todas las lecturas y descargas vuelven a comprobar sesión y acceso a la tarea. No se exponen claves internas R2 ni rutas públicas. Se fuerzan nombres seguros, `nosniff`, CSP restrictiva y `Cache-Control: private, no-store`.

## Permisos
Un trabajador solo puede subir/ver/descargar en sus propias tareas. Un administrador puede hacerlo en las tareas del ERP de esta base (modelo de organización única existente). El servidor resuelve identidad, tarea y clave de objeto; no confía en IDs de empleado/rol suministrados por el navegador. Un archivo de otra tarea no puede descargarse cambiando la URL. Desactivar una cuenta o cambiar la contraseña invalida el acceso mediante la validación de sesión existente.

Rutas:
- `GET /api/storage/status`: sesión obligatoria; informa binding y límites, no lista objetos.
- `POST /api/tasks/:id/attachments`: multipart con `client_id`, `mensaje` opcional y 1–5 partes `files`. Publica un comentario con los archivos de ese envío.
- `GET /api/tasks/:id/comments`: comentarios con metadatos autorizados de los adjuntos.
- `GET /api/tasks/:id/attachments/:attachment/download`: descarga autenticada; `?preview=1` solo para imagen/texto admitido.

## Consistencia y fallos
Cada selección enviada usa un `client_id`. Reintentar el mismo contenido mantiene esa clave: si ya fue confirmado, se devuelve el resultado existente sin duplicar comentario, objetos o cuota. Cambiar contenido con la misma clave devuelve 409. Cambiar selección/texto en la interfaz crea un envío nuevo: no hay deduplicación global por hash.

Se reserva cuota en D1 antes de subir; se guardan claves aleatorias y huellas de contenido. La confirmación de comentario/metadatos usa un batch transaccional D1. Si R2 o D1 falla, se intenta borrar los objetos del plan y liberar la reserva. Si D1 respondió de forma incierta, se comprueba antes de borrar: un envío listo nunca se limpia.

El cron recupera envíos pendientes con más de una hora y limpiezas fallidas, con un token de intento para no afectar reintentos activos. Si R2 no está disponible, conserva la reserva y reintenta en un ciclo posterior. Un envío en recuperación devuelve 409 y requiere esperar. La limpieza es eventual, no una transacción distribuida entre D1 y R2. Vigilar errores del Worker, cuotas R2 y estado de envíos al operar en producción.

## Costes y operación
R2/D1/Workers tienen sus propios límites y costes. Las cuotas de esta aplicación no garantizan coste cero. El sondeo de conversación consulta metadatos en D1; los bytes de R2 se leen al abrir/descargar. Conservar los logs y configurar alertas de uso desde Cloudflare según tu plan.
