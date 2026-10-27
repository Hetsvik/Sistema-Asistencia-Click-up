# Actualización: seguridad e identidad corporativa

Base: última entrega de adjuntos R2, con migraciones 0001–0008 ya instaladas. Despliegue con `wrangler deploy`, sin `--env`. Se conserva Workers + frontend estático + D1 + R2. No se introduce Java, un proveedor de correo ni un servicio externo.

## Qué cambia

- Acceso exclusivamente por correo corporativo y contraseña. El servidor determina el rol: no se selecciona un perfil al ingresar. Los códigos internos siguen existiendo para preservar relaciones históricas; ya no autentican.
- Crear/editar usuario: **Nombres**, **Apellido paterno**, **Apellido materno**, **Correo personal** opcional, correo corporativo automático y de solo lectura, contraseña, rol, teléfono y horario existente.
- `admin.primerNombre@arqyservgen.com` y `user.primerNombre@arqyservgen.com`, en minúsculas y sin tildes. Ejemplo: José Martín → `user.jose@arqyservgen.com`. Duplicados: `user.jose2@arqyservgen.com`, `user.jose3@arqyservgen.com`.
- Solo el primer nombre alimenta el identificador. Se admiten nombres y apellidos con letras, espacios, apóstrofos o guiones; la generación de nuevos identificadores requiere un primer nombre transliterable a letras latinas. El servidor impone longitud, formato y unicidad. La vista previa es orientativa: ante dos altas simultáneas una puede recibir 409 y debe reintentarse.
- Cambiar el primer nombre o el rol puede cambiar el correo corporativo e invalida las sesiones anteriores. Cambiar únicamente apellidos o correo personal no cambia el identificador. El administrador no puede cambiar su propio rol ni desactivarse.
- Mi cuenta: muestra ambas direcciones. Cada persona puede modificar su correo personal y teléfono. Los nombres, apellidos, rol y correo corporativo los administra la organización.
- Estos correos corporativos son **identificadores exclusivos del ERP**, NO buzones: no crean cuentas de correo, no envían mensajes, no verifican dominio ni habilitan recuperación por email. El correo personal tampoco se considera verificado ni se utiliza para recuperar claves automáticamente.

## Correcciones del backend

| Hallazgo | Tratamiento en esta entrega |
|---|---|
| Reutilización de cookie tras cerrar sesión | Sesión aleatoria individual registrada en D1; logout borra esa sesión. Otra sesión del mismo usuario no se cierra. Cookies antiguas sin registro dejan de funcionar. La interfaz avisa si la red no permite confirmar el cierre. |
| Intentos por IP evadibles y carreras simultáneas | Reserva atómica antes de verificar contraseña, por cuenta y también por IP. La cuenta sigue limitada al cambiar IP. Claves de contadores con SHA-256. |
| Aceptación de contraseña en texto plano | Eliminada. Migración sustituye credenciales sin hash por valores aleatorios deshabilitados y señala cuentas que requieren restablecimiento. No intenta recuperar ni reutilizar esas claves. |
| Secreto de sesión demasiado corto | Mínimo 32 caracteres en backend; se recomienda secreto aleatorio de 32 bytes o más. Rotarlo durante esta instalación. |
| JSON sin límite previo al parseo | Máximo 32 KiB comprobado en bytes reales leídos, además de Content-Length. Multipart mantiene sus límites específicos de R2. |
| Conversaciones sin paginación/límite de envío | 50 mensajes por consulta, cursores `before`/`after`, Ver mensajes anteriores y Volver a mensajes recientes. Máximo 200 mensajes en DOM. Exploración antigua pausa el refresco de esa vista; volver a recientes lo reactiva. |
| Rutas con escapes inválidos | Error HTTP 400 controlado, no URIError sin capturar. |
| Cabeceras generales no incluidas | CSP, nosniff, prohibición de enmarcado, Referrer-Policy y Permissions-Policy, tanto en Worker como en `_headers` para estáticos. Scripts sin `unsafe-inline` ni `unsafe-eval`; estilos inline siguen permitidos por componentes actuales. |
| Crecimiento de sesiones/contadores | Limpieza en el cron existente junto a limpieza de envíos R2; no borra sesiones vigentes ni adjuntos confirmados. |
| Exposición accidental de detalles de errores | Respuestas internas genéricas; log de error no imprime objeto SQL completo ni cuerpo recibido. |

Se mantienen: cookies HttpOnly, Secure bajo HTTPS, SameSite=Lax, firma HMAC, revalidación de estado/rol/versión, contraseñas PBKDF2-SHA256, parámetros SQL enlazados, permisos por tarea, verificación de origen en mutaciones y descargas R2 autorizadas.

### Límites de aplicación

- Login: 5 intentos fallidos/en curso por cuenta en ventana fija de 15 minutos. El intento válido libera su reserva de cuenta; no reinicia fallos previos. Un ataque puede provocar bloqueo temporal de una cuenta conocida: no equivale a romper la contraseña.
- Login: máximo 30 solicitudes por IP por ventana fija de 15 minutos, incluidos accesos válidos. En una oficina con IP compartida conviene dimensionarlo antes de publicar, manteniendo el límite por cuenta.
- Cambio de contraseña: 5 intentos por usuario/15 minutos.
- API autenticada: 600 solicitudes por usuario/minuto; operaciones de escritura: 60/minuto.
- Chat: 20 mensajes de texto por usuario/minuto; cargas: 10 por usuario/minuto. Todos los límites se validan en servidor.
- Los límites en D1 complementan, pero **no sustituyen**, protección de red/WAF/DDoS ni cuotas/alertas de Cloudflare. Están en `src/lib/rate-limit.js`, `src/routes/auth.js`, `account.js`, `tasks.js`, `attachments.js` e `index.js`.

## Instalar sin perder el acceso

**No copies y despliegues sin leer esta sección.** La migración es aditiva respecto a historiales, pero cambia el acceso y elimina credenciales en texto plano. Todas las cookies antiguas dejan de servir. Trabaja en una ventana de mantenimiento, sin cambios concurrentes. No vuelvas al backend anterior después de migrar sin restaurar también el respaldo y evaluar cambios posteriores.

### 1. Respaldo y revisión

Desde la raíz del proyecto real, guarda copia del código y de D1. El respaldo contiene información privada. Nunca lo publiques ni lo adjuntes a un chat.

```powershell
New-Item -ItemType Directory -Force database/private
npx wrangler d1 export bd-empresa2 --remote --output=database/private/respaldo_antes_seguridad.sql
```

Añade a TU `.gitignore` (sin borrar sus reglas actuales):

```gitignore
.dev.vars
.dev.vars.*
database/private/
.wrangler/
*.log
```

Si algún secreto ya estaba versionado, `.gitignore` no lo elimina del historial: retíralo del repositorio y rótalo.

No ejecutes los archivos de `tests/fixtures` en producción. No se incluyen secretos, respaldos reales, `.dev.vars`, estado de D1/R2 ni `wrangler.toml` real en el ZIP.

### 2. Copiar archivos y aplicar migraciones

Copia el **contenido de `archivos/`** del ZIP sobre la raíz del proyecto, conservando rutas. No copies `archivos` como una carpeta adicional. Conserva tu `wrangler.toml`, identificadores D1, binding `ATTACHMENTS`, bucket `erp-adjuntos` y cron existentes. No hace falta crear otro bucket ni cambiar a Pages.

```powershell
npm test
npx wrangler d1 migrations apply bd-empresa2 --remote
```

Wrangler aplica solamente migraciones pendientes. `0009_seguridad_identidad.sql` no se ejecuta manualmente una segunda vez: usa el registro de migraciones de Wrangler. Deben existir previamente las tablas de 0001–0008.

La migración:
- conserva empleados, tareas, proyectos, horarios, marcaciones, comentarios y referencias R2;
- copia el antiguo correo a Correo personal;
- genera identificadores corporativos únicos y conserva el nombre completo antiguo en Nombres;
- marca los nombres antiguos para revisión, sin adivinar apellidos compuestos;
- deshabilita contraseñas sin hash, pero mantiene los hashes existentes;
- no puede determinar si un hash corresponde a una contraseña antigua débil. Se recomienda restablecer también esas contraseñas conocidas como débiles.

### 3. Consultar identificadores y asegurar el administrador

Consulta SOLO datos no secretos; no consultes ni imprimas PIN_Acceso:

```powershell
npx wrangler d1 execute bd-empresa2 --remote --command "SELECT I.ID_Empleado,E.Nombre_Completo,C.Rol,I.Correo_Corporativo,I.Requiere_Clave FROM Identidad_Usuario I JOIN Empleados E USING(ID_Empleado) JOIN Cuentas_Usuario C USING(ID_Empleado) ORDER BY I.ID_Empleado;"
```

**Antes del despliegue**, asegura una contraseña nueva del administrador. Usa el ID_Empleado REAL de la consulta anterior, no el ID_Administrador y no un ID supuesto. Este ejemplo utiliza ID 1 solo como ejemplo; sustitúyelo junto con los nombres:

```powershell
node scripts/recuperar-acceso.mjs --id 1 --nombres "Rodrigo" --paterno "Ochoa" --materno "" --rol admin
```

La herramienta pregunta dos veces la contraseña, sin mostrarla ni recibirla por argumentos. Requiere terminal interactiva y Node moderno. Genera únicamente `database/private/recuperar_acceso.sql`, con hash y datos seleccionados. No consulta Cloudflare ni crea un administrador nuevo. `--rol` debe coincidir con el rol existente. Permite omitir `--materno` o `--paterno`; si hay homónimo, permite `--sufijo 2` para generar, por ejemplo, `admin.rodrigo2@arqyservgen.com`.

```powershell
npx wrangler d1 execute bd-empresa2 --remote --file=database/private/recuperar_acceso.sql
Remove-Item database/private/recuperar_acceso.sql
```

Verifica que la consulta final muestre la cuenta esperada, el correo correcto y `Requiere_Clave=0`. Si hay conflicto de correo, no continúes: regenera con un sufijo disponible y vuelve a ejecutar. Si el ID o rol no coincide, las guardias impiden actualizar otra cuenta; corrige los parámetros. Conserva privada la contraseña. Para otras cuentas bloqueadas, el administrador podrá fijar una nueva contraseña desde Editar usuario.

### 4. Secreto y despliegue

Configura un secreto aleatorio nuevo de al menos 32 caracteres, idealmente 32 bytes generados criptográficamente. No lo pegues en JS, HTML, Git ni en `wrangler.toml`.

```powershell
npm run secret:generate
npx wrangler secret put SESSION_SECRET
npx wrangler deploy --dry-run
npx wrangler deploy
```

La primera orden muestra el secreto únicamente en tu terminal; introdúcelo en el prompt de Wrangler y no lo compartas. La rotación y el nuevo registro de sesiones requieren que todos vuelvan a ingresar. En desarrollo, `.dev.vars` debe tener un secreto ficticio de longitud suficiente.

### 5. Comprobar en producción

1. Entra con el correo corporativo mostrado y contraseña nueva. El código anterior debe rechazarse.
2. Revisa Usuarios: corrige los campos Nombres/Apellidos de registros migrados y restablece claves débiles o bloqueadas.
3. Crea un usuario de prueba, verifica homónimos, edita nombre/rol y comprueba el correo resultante antes de comunicarlo.
4. Prueba dos sesiones; cierra una y confirma que la otra sigue activa. Una cookie cerrada no debe volver a autenticar.
5. Verifica asistencia/reportes y permisos entre dos trabajadores distintos.
6. Prueba carga, vista previa de texto e imagen, descarga y rechazo de otra cuenta sin acceso a la tarea.
7. Comprueba cabeceras reales en tu dominio, HTTPS y alertas de uso. Limpia datos ficticios de forma controlada, sin borrar historiales reales.

Prueba rápida sin credenciales:

```powershell
node scripts/smoke.mjs https://TU-DOMINIO
```

No vuelvas a importar `datos_iniciales.sql`, `actualizar_pins.sql` ni a ejecutar herramientas antiguas de inicialización sobre la BD actualizada. Las nuevas altas deben pasar por la gestión de usuarios. Los documentos históricos que mencionan login por código quedan sustituidos por esta guía.

## Alcance y controles que NO quedan activados

Esta actualización corrige los defectos de código reproducidos localmente; **no es una certificación de invulnerabilidad ni una auditoría de producción**.

- **Privacidad real del bucket:** no se han cambiado r2.dev, dominios públicos, políticas, tokens ni panel de Cloudflare. El backend usa descargas privadas, pero una URL pública configurada en el bucket podría eludirlo. Se revisará y cerrará en el siguiente paso solicitado; no se da por resuelto.
- **Antivirus:** los límites, extensiones y firmas de archivo NO son un antivirus. No se ha añadido un servicio de análisis ni una cuarentena. PDF, ZIP y Office pueden contener contenido peligroso aunque no se ejecuten en el ERP; deben analizarse antes de abrirlos. No se habilita lectura activa de estos documentos dentro de la página.
- **MFA:** no se ha implementado doble factor del ERP ni activado Cloudflare Access. Requiere una decisión de identidad, recuperación y configuración real; no se simula una protección inexistente. Activa MFA del panel de Cloudflare y evalúa un control adicional para administradores.
- **Infraestructura:** permisos/tokens Cloudflare, WAF, políticas HTTPS/HSTS, DNS, backups, retención y alertas deben verificarse en tu cuenta. No se han modificado desde aquí.
- No se ha hecho pentest externo, escaneo de dependencias contra un feed actualizado, prueba de carga de producción ni análisis completo de todos los formatos de archivo.
- La protección seguirá necesitando actualizaciones, monitorización y revisión independiente. Ningún lenguaje o framework elimina esa necesidad.
