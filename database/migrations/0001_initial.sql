-- Migración 0001 · esquema base (idempotente: puede ejecutarse sobre una BD existente).
-- Los datos de ejemplo NO van aquí: ver database/seeds/dev_data.sql

CREATE TABLE IF NOT EXISTS Roles_Sistema (
  ID_Rol INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Rol TEXT NOT NULL,
  Descripcion TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Roles_Sistema_Nombre ON Roles_Sistema(Nombre_Rol);
INSERT OR IGNORE INTO Roles_Sistema (ID_Rol, Nombre_Rol, Descripcion) VALUES
  (1, 'Trabajador', 'Acceso para marcar asistencia y gestionar sus tareas.'),
  (2, 'Administrador', 'Acceso al panel, reportes y gestión de personal.');

CREATE TABLE IF NOT EXISTS Empleados (
  ID_Empleado INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Completo TEXT NOT NULL,
  Correo TEXT,
  Telefono TEXT,
  Estado TEXT NOT NULL DEFAULT 'Activo' CHECK (Estado IN ('Activo', 'Inactivo'))
);

CREATE TABLE IF NOT EXISTS Administrador (
  ID_Administrador INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Empleado INTEGER NOT NULL,
  Codigo_Administrador TEXT NOT NULL,
  PIN_Acceso TEXT NOT NULL, -- hash 'pbkdf2$...' (los PIN en texto plano se migran solos al iniciar sesión)
  ID_Rol INTEGER NOT NULL DEFAULT 2,
  FOREIGN KEY (ID_Empleado) REFERENCES Empleados(ID_Empleado),
  FOREIGN KEY (ID_Rol) REFERENCES Roles_Sistema(ID_Rol)
);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Administrador_Empleado ON Administrador(ID_Empleado);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Administrador_Codigo ON Administrador(Codigo_Administrador);
CREATE INDEX IF NOT EXISTS FK_Administrador_Roles ON Administrador(ID_Rol);

CREATE TABLE IF NOT EXISTS Trabajadores (
  ID_Trabajador INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Empleado INTEGER NOT NULL,
  Rol_Cargo TEXT NOT NULL,
  HoraIngreso TEXT,
  Codigo_Trabajador TEXT NOT NULL,
  PIN_Acceso TEXT NOT NULL,
  ID_Rol INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (ID_Empleado) REFERENCES Empleados(ID_Empleado),
  FOREIGN KEY (ID_Rol) REFERENCES Roles_Sistema(ID_Rol)
);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Trabajadores_Empleado ON Trabajadores(ID_Empleado);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Trabajadores_Codigo ON Trabajadores(Codigo_Trabajador);
CREATE INDEX IF NOT EXISTS FK_Trabajadores_Roles ON Trabajadores(ID_Rol);

CREATE TABLE IF NOT EXISTS Proyectos (
  ID_Proyecto INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Proyecto TEXT NOT NULL,
  Area_Departamento TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Tareas (
  ID_Tarea INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Trabajador INTEGER NOT NULL,
  ID_Administrador_Asignador INTEGER NOT NULL,
  ID_Proyecto INTEGER NOT NULL,
  Fecha TEXT NOT NULL DEFAULT (DATE('now')),
  Fecha_Inicio TEXT,
  Fecha_Entrega TEXT,
  Descripcion_Tarea TEXT NOT NULL,
  Estado_Tarea TEXT NOT NULL DEFAULT 'Asignada',
  Observaciones TEXT,
  FOREIGN KEY (ID_Trabajador) REFERENCES Trabajadores(ID_Trabajador),
  FOREIGN KEY (ID_Administrador_Asignador) REFERENCES Administrador(ID_Administrador),
  FOREIGN KEY (ID_Proyecto) REFERENCES Proyectos(ID_Proyecto) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS FK_Tareas_Administrador ON Tareas(ID_Administrador_Asignador);
CREATE INDEX IF NOT EXISTS FK_Tareas_Proyectos ON Tareas(ID_Proyecto);
CREATE INDEX IF NOT EXISTS IX_Tareas_Busqueda ON Tareas(ID_Trabajador, Fecha);

CREATE TABLE IF NOT EXISTS Actividades (
  ID_Actividad INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Tarea INTEGER NOT NULL,
  Fecha_Actividad TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Descripcion_Actividad TEXT NOT NULL,
  Estado_Actividad TEXT NOT NULL DEFAULT 'Pendiente' CHECK (Estado_Actividad IN ('Pendiente', 'En Progreso', 'Completada')),
  Observaciones TEXT,
  FOREIGN KEY (ID_Tarea) REFERENCES Tareas(ID_Tarea)
);
CREATE INDEX IF NOT EXISTS FK_Actividades_Tareas ON Actividades(ID_Tarea);

CREATE TABLE IF NOT EXISTS Archivos (
  ID_Archivo INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Trabajador INTEGER NOT NULL,
  ID_Tarea INTEGER DEFAULT NULL,
  ID_Actividad INTEGER DEFAULT NULL,
  Nombre_Original TEXT NOT NULL,
  Nombre_Almacenado TEXT NOT NULL,
  Tipo_Archivo TEXT NOT NULL,
  Tamano_Archivo INTEGER NOT NULL,
  GoogleDrive_File_ID TEXT NOT NULL,
  Ruta_GoogleDrive TEXT DEFAULT NULL,
  Fecha_Subida TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Estado TEXT NOT NULL DEFAULT 'Activo' CHECK (Estado IN ('Activo', 'Eliminado')),
  FOREIGN KEY (ID_Trabajador) REFERENCES Trabajadores(ID_Trabajador) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ID_Tarea) REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (ID_Actividad) REFERENCES Actividades(ID_Actividad) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Archivos_GoogleDrive ON Archivos(GoogleDrive_File_ID);
CREATE INDEX IF NOT EXISTS FK_Archivos_Trabajadores ON Archivos(ID_Trabajador);
CREATE INDEX IF NOT EXISTS FK_Archivos_Tareas ON Archivos(ID_Tarea);
CREATE INDEX IF NOT EXISTS FK_Archivos_Actividades ON Archivos(ID_Actividad);

CREATE TABLE IF NOT EXISTS Asistencia (
  ID_Asistencia INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Trabajador INTEGER NOT NULL,
  Fecha_Entrada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Fecha_Salida TEXT DEFAULT NULL,
  Fecha_Calculada TEXT GENERATED ALWAYS AS (DATE(Fecha_Entrada)) STORED,
  Estado_Asistencia TEXT GENERATED ALWAYS AS (
    CASE WHEN TIME(Fecha_Entrada) <= '09:40:00' THEN 'A tiempo' ELSE 'Tardanza' END
  ) STORED,
  FOREIGN KEY (ID_Trabajador) REFERENCES Trabajadores(ID_Trabajador)
);
CREATE UNIQUE INDEX IF NOT EXISTS UQ_Trabajador_Fecha ON Asistencia(ID_Trabajador, Fecha_Calculada);

CREATE TABLE IF NOT EXISTS Comentarios_Tarea (
  ID_Comentario INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Tarea INTEGER NOT NULL,
  Autor TEXT NOT NULL,
  Rol TEXT NOT NULL CHECK (Rol IN ('Administrador', 'Empleado')),
  Mensaje TEXT NOT NULL,
  Fecha TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ID_Tarea) REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS IX_Comentarios_Tarea_Busqueda ON Comentarios_Tarea(ID_Tarea, Fecha);

CREATE TABLE IF NOT EXISTS Evaluaciones_Rendimiento (
  ID_Evaluacion INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Trabajador INTEGER NOT NULL,
  ID_Administrador INTEGER NOT NULL,
  Periodo_Texto TEXT DEFAULT NULL,
  Fecha_Inicio TEXT DEFAULT NULL,
  Fecha_Fin TEXT DEFAULT NULL,
  Total_Asistencias INTEGER DEFAULT NULL,
  Llegadas_Tiempo INTEGER DEFAULT NULL,
  Tardanzas INTEGER DEFAULT NULL,
  Total_Tareas INTEGER DEFAULT NULL,
  Tareas_Completadas INTEGER DEFAULT NULL,
  Eficiencia_Porcentaje REAL DEFAULT NULL,
  Fecha_Generacion TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ID_Trabajador) REFERENCES Trabajadores(ID_Trabajador) ON DELETE CASCADE,
  FOREIGN KEY (ID_Administrador) REFERENCES Administrador(ID_Administrador)
);
CREATE INDEX IF NOT EXISTS IX_Evaluaciones_Trabajador ON Evaluaciones_Rendimiento(ID_Trabajador);
CREATE INDEX IF NOT EXISTS IX_Evaluaciones_Administrador ON Evaluaciones_Rendimiento(ID_Administrador);
