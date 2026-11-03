# Corrección de inicio de sesión

## Qué se corrigió

El HTML cargaba una versión de los recursos donde faltaba `js/api.js`. El navegador no podía resolver el módulo del formulario, por lo que el acceso no se inicializaba. También faltaban `js/notifications.js`, `js/preferences.js` y `js/server-clock.js` en su ubicación esperada. Se restauraron a partir de los archivos del propio proyecto y se regeneraron los recursos versionados y sus referencias HTML.

El botón permanece deshabilitado y aparece un aviso si el código del formulario no carga. El formulario tiene método POST como protección adicional para evitar que la contraseña termine en la URL si no se ejecuta JavaScript.

## Publicación

1. Conserva tu respaldo y revisa `wrangler.toml`: `npm run deploy` publica en el Worker, la cuenta y los recursos configurados allí. Confirma que son los correctos antes de publicar. No incluyas secretos ni respaldos en un repositorio público.
2. Instala las dependencias con `npm ci`, si fuera necesario.
3. Ejecuta `npm run deploy:check` para validar sin publicar. Después, cuando corresponda, ejecuta `npm run deploy`; este comando regenera los recursos mediante `predeploy` y publica el proyecto.
4. Recarga la página publicada e intenta ingresar como administrador y como trabajador. Si continúa el problema, revisa en el navegador que `/static/.../js/api.js` y `/api/auth/login` no devuelvan errores y comunica el código de estado, sin compartir contraseñas ni cookies.

No es necesario ejecutar migraciones ni importar respaldos para esta corrección. No se modificaron credenciales ni datos de la base de datos.

## Validación local

Se verificaron en un entorno de prueba aislado el acceso de ambos roles, contraseña incorrecta, conservación de sesión, recarga, navegación y cierre de sesión. Se añadieron pruebas para comprobar las dependencias de los módulos fuente y los recursos versionados. `TZ=America/Lima npm test` completó 181 pruebas; una prueba anterior de hora del chat depende de la zona horaria local y falla si se ejecuta en UTC.

Las pruebas locales no garantizan el estado del despliegue, las credenciales o los servicios en producción.
