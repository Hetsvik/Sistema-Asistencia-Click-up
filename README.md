# ERP Intranet · Arquitectura & Servicios Generales

Asistencia, tareas y reportes para el personal. Corre completo en **Cloudflare Workers + D1** (sin servidor propio).

- Entorno conectado: https://sistema-asistencia-click-up.rodrigo-ochoa333.workers.dev)
- Base D1: `bd-empresa2`. Este repositorio no modifica el Worker principal ni su base.
- Diseño base: `design/Interfaces ERP .drawio`

## Estructura

```
├── src/                       Backend (Worker)
│   ├── index.js               Entrada: /api/* → API, el resto → archivos estáticos
│   ├── router.js              Router mínimo (GET/POST/PUT con :params)
│   ├── lib/                   http · sesión firmada · hash de PIN · fechas
│   └── routes/                auth · attendance · tasks · reports · users
├── frontend/                  Sitio estático (se publica tal cual)
│   ├── index.html             Login
│   ├── admin/  usuarios/      inicio · asistencia · tareas · reportes
│   ├── css/styles.css         ÚNICA hoja de estilos del sistema (negro y dorado)
│   └── js/
│       ├── config.js          ← rutas de páginas y endpoints (se editan solo aquí)
│       ├── api.js             cliente fetch (manejo de errores y 401)
│       ├── session.js · layout.js · ui.js · chart.js · waves.js
│       └── pages/             un script por página
├── database/
│   ├── migrations/            0001 esquema (idéntico a tu schema.sql) · 0002 anti fuerza bruta e índices
│   └── private/               datos reales generados (en .gitignore, NO se sube a git)
├── scripts/                   build-import.mjs (genera la importación) · smoke.mjs (prueba un despliegue)
├── tests/                     Pruebas de la API (node:test) con datos ficticios en tests/fixtures/
├── docs/                      DESPLIEGUE.md · EVALUACION.md
└── design/                    Wireframes y CSS antiguos (legacy-css/, no se publican)
```

## Puesta en marcha y despliegue

Pasos completos en **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**. Resumen:

```bash
npm ci
npm test
npm run deploy:check  # validación local; no publica
npm run deploy       # publica únicamente erp-construcciones-sac-test
```

Para activar el despliegue automático, conecta este repositorio desde **Cloudflare → Workers & Pages → erp-construcciones-sac-test → Settings → Builds**. Rama: `main`; comando de compilación: `npm test`; comando de despliegue: `npm run deploy`; directorio raíz: `/`.

La base `bd-empresa2` y el secreto `SESSION_SECRET` ya están configurados en el Worker. No se importan datos ni se ejecutan migraciones automáticamente.

## API (`/api/*`, sesión por cookie HttpOnly)

| Método y ruta | Quién | Descripción |
|---|---|---|
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | todos | Sesión |
| `GET /attendance/today` · `POST /attendance/check-in` · `PUT /attendance/check-out` | trabajador | Marcación |
| `GET /attendance?q=&desde=&hasta=&trabajador=` | todos* | Historial (*trabajador: solo el suyo) |
| `GET /tasks?estado=&q=&trabajador=` · `GET /tasks/:id` | todos* | Tareas |
| `POST /tasks` | admin | Crear tarea (proyecto existente o nuevo) |
| `PUT /tasks/:id/status` | todos* | Aceptar / completar (admin: cualquier estado) |
| `GET/POST /tasks/:id/comments` | todos* | Conversación de la tarea |
| `GET /projects` · `GET /users?q=` | admin | Catálogos |
| `GET /reports/summary?periodo=semana\|mes\|todo&trabajador=` | todos* | Indicadores y datos del gráfico |

## Navegación y rutas en JavaScript

Todas las URLs viven en `frontend/js/config.js` (`ROUTES`, `API`, `NAV`). Cada página interna carga su script
(`/js/pages/<pagina>.js`), que llama a `initPage({ role, page })`: valida la sesión, redirige si el rol no corresponde,
pinta el menú lateral y activa las notificaciones.

## Seguridad en breve

- PIN guardado con PBKDF2-SHA256. Los PIN antiguos en texto plano se convierten solos en el primer login.
- Sesión firmada (HMAC) en cookie `HttpOnly; SameSite=Lax; Secure`, 8 h de duración.
- Bloqueo de 15 min tras 5 intentos fallidos (por código + IP).
- Un trabajador solo accede a sus datos; el autor de los comentarios sale de la sesión, no del cliente.

## Datos privados

No subir `database/private/`, `.dev.vars`, `.env`, tokens ni el `schema.sql` con datos de empleados. Las migraciones incluidas contienen solo la estructura y los roles del sistema; las pruebas usan datos ficticios.
