# Pruebas de adjuntos R2

## Automatizadas
Desde la raíz: `npm test` (Node >=22.5, recomendado Node 24). La nueva suite `tests/r2.test.mjs` usa D1 SQLite aislado y un doble de R2; no usa claves ni servicios remotos.

**Resultado final: 124 pruebas aprobadas (102 anteriores + 22 nuevas).**

22 pruebas nuevas: subida/metadatos/descarga, permisos de tarea y sesión, protección de origen, ausencia de binding, idempotencia/reintentos concurrentes, fallo de put, fallo de D1, confirmación incierta, cuota de bytes y cantidad, nombres/rutas, MIME falso, ZIP/Office/UTF-8, límite individual/total, campos duplicados, previews seguros, objeto ausente, limpieza de abandonados, fallo de limpieza, protección de intento nuevo y migración repetible sin tocar GoogleDrive. Se conservan las 102 comprobaciones anteriores.

## Flujo local con Wrangler + R2
Prueba de integración con el binding R2 **local real de Wrangler**, no con el bucket remoto:
- Administrador envía PDF, texto e imagen; trabajador los recibe por sondeo sin recargar.
- Trabajador envía solo un archivo sin texto; administrador lo recibe.
- Reintento HTTP del mismo multipart no duplica comentarios.
- Descarga de PDF comparada por SHA-256 con el original.
- Vista previa de TXT muestra `<script>` literalmente, sin ejecutarlo; vista previa PNG decodificada correctamente.
- Otro trabajador no puede subir ni descargar en una tarea ajena.
- Fallo temporal preserva selección y permite reintentar.
- Los adjuntos confirmados siguen visibles después de recargar.
- Cierre por Escape bloqueado durante envío; estado de binding visible en Configuración.
- Tema claro/oscuro conservado; consola sin errores JavaScript no controlados.
- Cron local ejecutado con `wrangler dev --test-scheduled`: elimina un envío incompleto simulado y libera su reserva; conserva los listos.

Los documentos usados fueron ficticios y no se incluyen para importar. La revisión visual se hizo en escritorio (1440 px) y móvil (390 px), renderizando las vistas y comprobando cada captura.

## Verificación en producción a cargo del propietario
Después de aplicar la migración, configurar el binding/cron y publicar, enviar un TXT pequeño de prueba desde una tarea propia. Confirmar que el otro rol lo recibe, abrir la vista previa y descargarlo. Verificar que el bucket sigue privado y que un trabajador ajeno no tiene acceso. Revisar los logs del Worker si falla. El dry-run solo compila/reconoce bindings: no acredita que el bucket remoto exista o tenga permisos.
