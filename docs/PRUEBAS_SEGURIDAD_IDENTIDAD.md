# Verificación local de seguridad e identidad

## Resultado

- `npm test`: **150 pruebas, 150 aprobadas, 0 fallos**.
- 124 escenarios de regresión previos adaptados al contrato nuevo, más 26 pruebas directas del backend de seguridad/identidad.
- Los escenarios antiguos usan `tests/legacy-test-adapter.mjs` únicamente para traducir sus datos de prueba al nuevo contrato. Ese adaptador NO se importa desde producción y NO habilita login por código. `tests/security-identity.test.mjs` llama directamente al backend real, sin adaptador, e incluye rechazo del código anterior.
- `node --check`: sintaxis de módulos backend/frontend y herramientas comprobada.
- `wrangler deploy --dry-run`: compilación correcta, con DB, ATTACHMENTS y ASSETS. No se desplegó a producción.
- Migraciones ejecutadas en D1 local de Wrangler. Prueba adicional con BD SQLite poblada hasta 0008 confirma preservación de historia, identificadores y deshabilitación de claves en texto plano al aplicar 0009.
- Smoke HTTP local: páginas/recursos, 401 sin sesión, 404 y login inválido correctos.
- Recuperación en terminal local: entrada sin eco, hash válido, identidad y flag de acceso restablecidos con datos ficticios.

## Seguridad probada directamente

- Reutilizar cookie tras logout: 401. Otra sesión individual sigue válida.
- Firma alterada, sesión borrada o caducada: sin acceso.
- Cambio de contraseña/estado/rol: invalida sesiones anteriores.
- Cinco fallos por cuenta siguen limitados al cambiar de IP.
- Doce solicitudes fallidas concurrentes: cinco verificaciones admitidas y siete rechazadas con 429.
- Límite por IP para identidades distintas; expiración de ventanas.
- Login no acepta códigos ni correo personal; el rol declarado por el cliente no eleva privilegios.
- No se acepta texto plano ni hashes malformados.
- Restablecimiento de cuenta bloqueada por administrador.
- Identidad corporativa normalizada, homónimos, datos separados y unicidad concurrente sin filas huérfanas.
- Edición propia no cambia nombre/rol/correo corporativo ni otro empleado.
- JSON >32 KiB: 413, por Content-Length o por bytes reales. JSON inválido y URI mal codificada: 400.
- Origen externo en mutaciones: 403.
- Cabeceras CSP/nosniff/no-framing en respuestas del Worker.
- Historia de 121 mensajes recuperada por páginas sin pérdidas; incremental de más de 50 mensajes; aislamiento entre trabajadores y límite de 20 envíos/minuto.
- Limpieza de sesiones y contadores caducados sin borrar vigentes.
- La regresión mantiene pruebas de autorización, validación, cuotas, reintentos, compensaciones y descarga R2, además de asistencia, horarios, proyectos, reportes y notificaciones.

## Navegador local con Worker + D1 + R2

Chromium, escritorio 1440 px y móvil 390 px, datos ficticios:
1. Ingreso por correo, sin selector de perfil/código.
2. Crear persona con nombres y dos apellidos; correo de solo lectura calculado automáticamente.
3. Editar rol recalcula correo, conserva los campos y guarda correctamente.
4. La cuenta nueva puede iniciar sesión con su correo generado.
5. Subir TXT mediante clip y recibirlo en conversación R2 local.
6. Texto con etiqueta `<script>` se muestra literalmente, sin ejecución.
7. Descarga autorizada del adjunto.
8. Mi cuenta permite correo personal, sin edición del identificador de acceso.
9. Homónimo `user.ana2` en móvil, sin desbordamiento horizontal; reproducción real de cookie cerrada rechazada.

Prueba adicional de logout con fallo de red simulado: muestra advertencia, no da una falsa confirmación; al reintentar sin el fallo, cierra la sesión y `/api/auth/me` devuelve 401.

Sin errores de JavaScript ni infracciones CSP de la aplicación en esta ejecución. La automatización mantuvo CSP activa; no se debilitó para pasar las pruebas.

## No probado ni activado

No se accedió a la cuenta Cloudflare real, no se cambiaron políticas del bucket, no se inspeccionaron DNS/HTTPS/WAF/tokens del usuario y no se realizaron ataques contra producción. No hay antivirus, MFA ni escaneo externo de dependencias activados por esta entrega. El resultado no certifica ausencia de vulnerabilidades: ver alcance y pendientes en `SEGURIDAD_IDENTIDAD.md`.
