# Adjuntos: modo local y futura conexión R2

## Lo que está disponible ahora
`frontend/js/attachments.js` agrega el clip en la conversación de ambos roles. Permite seleccionar, validar nombres/extensiones/tamaños, deduplicar y quitar archivos. La lista solo vive en memoria hasta cerrar el diálogo o cambiar de página. No lee ni ejecuta el contenido, no hace fetch ni sube bytes a D1/R2; tampoco incluye los archivos en `POST /api/tasks/:id/comments`. El botón Enviar sigue enviando únicamente el texto. Se informa de todo ello en pantalla.

Límites locales iniciales: 5 archivos, 10 MiB por archivo y 25 MiB en total. Se admiten PDF, PNG/JPG/WebP, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX y ZIP. Se rechazan archivos vacíos, HTML, SVG, ejecutables y nombres >200 caracteres. Estas validaciones de cliente son comodidad de interfaz, NO una barrera de seguridad ni análisis antivirus.

`selectFiles()` es una función pura comprobada con tests. `initAttachments(root)` incorpora el control y devuelve `destroy()` para liberar la selección al cerrar. Este es el punto de extensión para conectar un adaptador real más adelante. No hay endpoint de subida activo, binding R2 habilitado, bucket público, credenciales ni costes de almacenamiento en esta actualización.

## Trabajo necesario cuando tengas R2
No basta con añadir un binding: todavía faltan subida, descarga, lectura y metadatos de adjuntos. No marques los archivos como enviados hasta recibir confirmación del servidor.

1. Crear un bucket **privado** R2 y añadir manualmente un binding de Worker, por ejemplo `ATTACHMENTS`. No expongas claves de R2 en frontend, HTML, GitHub ni en URLs públicas. No se ha modificado tu wrangler.toml.

```toml
# EJEMPLO PARA EL FUTURO. NO es necesario ni se debe activar ahora.
# [[r2_buckets]]
# binding = "ATTACHMENTS"
# bucket_name = "<tu-bucket-privado>"
```

2. Implementar rutas autenticadas y con comprobación de acceso **a la tarea**:
   - `POST /api/tasks/:id/attachments`: multipart/form-data; stream al bucket, validación de límites y archivo real en servidor, metadatos después de subir con éxito.
   - `GET /api/tasks/:id/attachments`: listado de metadatos autorizado.
   - `GET /api/tasks/:id/attachments/:attachmentId/download`: autorizar y entregar objeto con Content-Disposition attachment, nombre seguro y X-Content-Type-Options nosniff.
   - `DELETE /api/tasks/:id/attachments/:attachmentId`: según permisos explícitos; borrado lógico/control de objeto.
   Estas son rutas propuestas, **no implementadas**. Si no existe binding, devolver un error claro de servicio no disponible, no una confirmación ficticia.
3. Un trabajador solo puede acceder a sus tareas; un administrador a las tareas de su organización. Nunca confiar en un empleado_id, bucket-key, nombre o rol enviado por el cliente. Resolver la clave a partir de metadatos autorizados y generar nombres de objeto aleatorios.
4. Crear una migración separada para metadatos R2: ID, tarea, empleado autor (sirve para ambos roles), bucket-key, nombre original seguro, MIME verificado, tamaño, estado, fecha UTC y relación opcional con comentario. La tabla heredada `Archivos` tiene campos GoogleDrive obligatorios: **no rellenarlos con IDs falsos de R2 ni alterar esa tabla a ciegas**.
5. Limitar tamaño también en servidor, por usuario y tarea; rechazar contenido activo, validar MIME real, controlar cuotas, considerar análisis antimalware y evitar previsualización de documentos arbitrarios. R2 y D1 no comparten una transacción: diseñar limpieza compensatoria de objetos huérfanos, reintentos idempotentes y estados pendiente/listo/error.
6. Si habrá vista previa/lectura, implementar una ruta distinta con tipos seguros o conversión aislada. No insertar HTML/SVG/TXT sin escapar ni ejecutar documentos o macros. Las descargas/lecturas deben volver a validar permisos, aunque se conozca el attachmentId.
7. Probar con binding local de Wrangler primero: acceso cruzado denegado, exceso de tamaño, fallo de R2/D1, reintentos, borrado, navegación con selección pendiente y sesión expirada. Luego habilitar producción de forma explícita.

Esta actualización prueba la interfaz local sin necesitar cuenta R2. No se ha creado ni consultado ningún bucket.
