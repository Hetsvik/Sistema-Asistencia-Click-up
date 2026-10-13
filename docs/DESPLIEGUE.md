# Despliegue desde GitHub en Cloudflare Workers

## Entorno de este repositorio

- Worker: `erp-construcciones-sac-test`.
- URL: https://erp-construcciones-sac-test.rodrigo-ochoa333.workers.dev
- Base D1: `bd-empresa2`.
- Rama para despliegues: `main`.
- El Worker principal `erp-construcciones-sac` y la base `bd-empresa` no son destinos de este repositorio.

## Conectar el repositorio al Worker existente

1. Cloudflare → Workers & Pages → `erp-construcciones-sac-test`.
2. Settings → Builds → Connect.
3. Autorizar la integración de GitHub únicamente para `Hetsvik/Sistema-Asistencia-Click-up`.
4. Seleccionar ese repositorio y la rama `main`.
5. Directorio raíz: `/`.
6. Build command: `npm test` (Cloudflare instala las dependencias a partir del lockfile).
7. Deploy command: `npm run deploy`.
8. Guardar y comprobar el primer build. Si no se inicia automáticamente, usar la acción de build del panel o hacer un nuevo commit en `main`.

Cloudflare debe tener Node 22.5 o superior para ejecutar las pruebas; se recomienda Node 24 mediante la variable de build `NODE_VERSION=24`.

## Recursos existentes

La base ya tiene la estructura y los datos. El Worker ya dispone de `SESSION_SECRET`. No generar otro secreto ni ejecutar importaciones para conectar GitHub. No incluir secretos en el repositorio ni en registros de compilación.

Los despliegues actualizan el código y los archivos estáticos; no incluyen comandos de migración ni importación de D1. Esos cambios se administran por separado, con respaldo previo.

## Validación manual

```bash
npm ci
npm test
npm run deploy:check
```

`npm run deploy:check` no publica. `npm run deploy` sí publica en el Worker de prueba configurado en `wrangler.toml`.

## Datos privados y desarrollo local

Las migraciones en `database/migrations/` solo contienen estructura y roles. Los archivos con datos reales permanecen fuera del repositorio. Para desarrollo local, crear `.dev.vars` a partir de `.dev.vars.example`, generar un secreto propio y utilizar exclusivamente datos de prueba.

## Cambiar al Worker principal

No cambiar `name`, `database_name` ni `database_id` para producción sin confirmar el destino y revisar su base. La base original puede requerir actualizaciones de estructura y PIN antes de aceptar este backend.
