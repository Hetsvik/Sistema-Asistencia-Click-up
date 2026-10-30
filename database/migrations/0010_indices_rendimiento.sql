-- Solo índices: no modifica usuarios, credenciales, marcas, horarios ni archivos.
CREATE INDEX IF NOT EXISTS IX_Asistencia_Fecha_Trabajador ON Asistencia(Fecha_Calculada DESC,ID_Trabajador,ID_Asistencia);
CREATE INDEX IF NOT EXISTS IX_Tareas_Entrega_Id ON Tareas(Fecha_Entrega,ID_Tarea);
CREATE INDEX IF NOT EXISTS IX_Tareas_Trabajador_Entrega_Id ON Tareas(ID_Trabajador,Fecha_Entrega,ID_Tarea);
CREATE INDEX IF NOT EXISTS IX_Tareas_Fecha_Trabajador ON Tareas(Fecha,ID_Trabajador);
CREATE INDEX IF NOT EXISTS IX_Anuncios_Fecha_Id ON Anuncios(Fecha_Creacion DESC,ID_Anuncio DESC);
CREATE INDEX IF NOT EXISTS IX_Anuncios_Nombre_Id ON Anuncios(Nombre COLLATE NOCASE,ID_Anuncio);
CREATE INDEX IF NOT EXISTS IX_Empleados_Nombre_Id ON Empleados(Nombre_Completo COLLATE NOCASE,ID_Empleado);
CREATE INDEX IF NOT EXISTS IX_Comentarios_Tarea_Id ON Comentarios_Tarea(ID_Tarea,ID_Comentario);
