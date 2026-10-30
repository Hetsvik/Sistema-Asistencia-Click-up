# Validación de la entrega

## Comprobaciones realizadas

- 185 pruebas automatizadas locales: 185 aprobadas, 0 fallos.
- Incluyen 18 casos nuevos de paginación/rendimiento más las regresiones previas; tres expectativas anteriores se adaptaron al nuevo contrato de paginación (no se permite ya descargar todas las tareas del calendario en una respuesta).
- Verificación local de las migraciones 0001–0010 con Wrangler/D1; 0010 aplicada y repetible sin alterar filas históricas.
- `wrangler deploy --dry-run` correcto. No se realizó ningún despliegue ni cambio remoto.
- Diez comprobaciones de navegador con cuentas y datos ficticios: enlace a página, siguiente, Atrás, recarga, filtros/tamaño, formularios con opciones limitadas, diaria/historial, calendario/agenda, proyectos/anuncios, reportes/gráfico, caché/Server-Timing/no-store, vista móvil y ausencia de sondeo cada tres segundos.
- No se debilitó CSP para las pruebas: el controlador de pruebas se adaptó para no depender de eval. Fuentes externas se sustituyeron por CSS vacío en el navegador de QA para no depender de red; esto no es una medición del rendimiento real de Google Fonts.

## Evidencia de reducción de datos

Comparación con las mismas 605 tareas ficticias del mismo día, JSON sin compresión y sin cabeceras:

| Solicitud | Antes | Ahora |
|---|---:|---:|
| Calendario completo | 605 tareas, 206.106 bytes | Resumen del día: 45 bytes |
| Primera página de la agenda | Incluida en la descarga masiva | 20 tareas, 6.846 bytes |

Resumen + primera página: 6.891 bytes frente a 206.106 (aproximadamente 96,7 % menos JSON en ese escenario). Las demás tareas siguen accesibles por páginas. No es una medición de transferencia comprimida, de p95 ni de velocidad de producción.

## Casos cubiertos

- Más de 500 tareas accesibles sin duplicados entre páginas en un conjunto sin cambios concurrentes.
- Resumen de pendientes correcto más allá de la primera página.
- Trabajador no puede consultar datos de otro mediante `trabajador`, calendario, día o página.
- Rechazo de límites excesivos, tamaños cero/negativos y combinación page+offset.
- Catálogos y anuncios con página final acotada, totales y búsqueda.
- Asistencia diaria limitada a trabajadores de la página.
- Historial mezclado de registros antiguos y tramos evaluados antes de paginar.
- Comparación del nuevo cálculo SQL con las reglas JS de vigencia, descanso, horarios congelados y tolerancia.
- Resúmenes sin detalle y exportación explícita.
- Guardia de expansión masiva de horarios.
- Índices utilizados en un plan de consulta local y migración repetible.
- Rutas con parámetros y sondeo sin solicitudes solapadas/ocultas.
- Caché immutable confinada a los recursos versionados.

## Límites de esta validación

No es un pentest, una certificación OWASP, una prueba de concurrencia de producción ni una garantía de Core Web Vitals para usuarios reales. WebPageTest debe repetirse después de desplegar: móvil/desktop, 3–5 ejecuciones, primera visita y visita repetida. La capacidad de D1 y los límites/costos del plan deben medirse con la configuración real en un entorno autorizado.
