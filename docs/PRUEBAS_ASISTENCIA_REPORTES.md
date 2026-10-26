# Verificación de esta actualización

## Automatizadas
Ejecutar en la raíz del proyecto con Node >=22.5 (recomendado Node 24):

```powershell
npm test
npx wrangler@latest deploy --dry-run
```

Resultado local: **102 pruebas aprobadas**, sin fallos. Incluye las comprobaciones de versiones anteriores y 14 pruebas nuevas de métricas/asistencia/exportación. El dry-run compiló Worker y assets sin desplegar.

Cobertura nueva: límite inclusivo de tolerancia (+10:00 y +10:01), ausencias sin doble acumulación, tramos futuros, días de descanso, vigencias, conservación del historial anterior, repetición de la migración, acceso admin a listado diario, privacidad de trabajador, dos entradas/salidas por tramo, duplicados y concurrencia de entrada, filtros de prioridad sin alterar asistencia, CSV seguro, XLSX con números y aislamiento de preferencias entre cuentas.

## Navegador local
Worker + D1 locales con datos ficticios; no se accedió a producción. Administrador y trabajador en contextos separados, navegador configurado en una zona distinta a Perú para comprobar independencia del reloj local. Resultado: 22 estados de interfaz revisados y sin errores JavaScript no controlados.

Se verificaron listado diario y su actualización automática al marcar desde otra sesión sin recargar, historial/pestañas/filtros, entrada/salida de segundo tramo, falta sin duplicación, tema y texto globales, sincronización entre pestañas y aislamiento por cuenta, búsqueda por trabajador y prioridad, tres gráficos y descargas reales PNG/XLSX/CSV. El XLSX descargado se abrió con `openpyxl`: tres hojas válidas, cifras numéricas y filtrado correcto. Las capturas fueron renderizadas y revisadas en escritorio y móvil, corrigiendo encabezado largo, colores claros, tablas y redimensionado del gráfico.

No es una prueba de carga masiva ni una garantía sobre credenciales/cuotificación/configuración de tu cuenta Cloudflare. La comprobación final en tu entorno debe realizarse tras aplicar la migración y publicar.

## Lista breve después de instalar
1. Admin → Asistencia: ver personas sin marcar y cambiar a Historial sin salir de la pantalla.
2. Trabajador → Asistencia: solo sus datos, entrada/salida sin recargar. Admin observa el cambio en unos 3 segundos mientras su vista está visible.
3. Configuración → modo claro y tamaño de texto: recorrer Inicio, Tareas, Calendario, Proyectos/Usuarios (admin), Asistencia y Reportes. Abrir otra pestaña de la misma cuenta.
4. Reportes: seleccionar una persona, cambiar prioridad y comprobar que el porcentaje de asistencia no cambia por esa prioridad. Probar los tres gráficos.
5. Descargar PNG, XLSX y un CSV; abrir el XLSX o importarlo en Power BI.
6. Comprobar tolerancia en entorno local/pruebas: horario 08:00, entrada 08:10:00 puntual, 08:10:01 una falta; ausencia tras el límite también una, posterior entrada tardía no suma otra.
7. Revisar la vigencia **desde el día siguiente en Perú**. No esperar faltas retroactivas para registros anteriores a la instalación.
8. Confirmar que el clip sigue avisando “R2 sin conectar”. No activar uploads en esta entrega.
