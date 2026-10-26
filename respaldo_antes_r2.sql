PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE Roles_Sistema (
  ID_Rol INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Rol TEXT NOT NULL,
  Descripcion TEXT
);
INSERT INTO "Roles_Sistema" ("ID_Rol","Nombre_Rol","Descripcion") VALUES(1,'Trabajador','Acceso para marcar asistencia y gestionar sus tareas.');
INSERT INTO "Roles_Sistema" ("ID_Rol","Nombre_Rol","Descripcion") VALUES(2,'Administrador','Acceso al panel, reportes y gestión de personal.');
CREATE TABLE Empleados (
  ID_Empleado INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Completo TEXT NOT NULL,
  Correo TEXT,
  Telefono TEXT,
  Estado TEXT NOT NULL DEFAULT 'Activo' CHECK (Estado IN ('Activo', 'Inactivo'))
);
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(1,'Administrador General',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(2,'Adonis Vasquez',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(3,'Benjamin Alfonso','calebalfonso83@gmail.com','930254064','Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(4,'Celeste Lechuga',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(6,'Marco Coila',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(7,'Kevin Vega',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(8,'Fiorella Alarcon',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(9,'Alejandro Guzman',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(10,'Israel Rodrigo Ochoa Mejia','rodrigo.ochoa333@gmail.com','933718894','Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(11,'Edu Cruz',NULL,NULL,'Activo');
INSERT INTO "Empleados" ("ID_Empleado","Nombre_Completo","Correo","Telefono","Estado") VALUES(12,'Matias Sebastian Moreno Rodriguez','matix3346@gmail.com','923001763','Activo');
CREATE TABLE Administrador (
  ID_Administrador INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Empleado INTEGER NOT NULL,
  Codigo_Administrador TEXT NOT NULL,
  PIN_Acceso TEXT NOT NULL, -- hash 'pbkdf2$...' (los PIN en texto plano se migran solos al iniciar sesión)
  ID_Rol INTEGER NOT NULL DEFAULT 2,
  FOREIGN KEY (ID_Empleado) REFERENCES Empleados(ID_Empleado),
  FOREIGN KEY (ID_Rol) REFERENCES Roles_Sistema(ID_Rol)
);
INSERT INTO "Administrador" ("ID_Administrador","ID_Empleado","Codigo_Administrador","PIN_Acceso","ID_Rol") VALUES(1,1,'AD001','pbkdf2$100000$lLxkjoLWhTZR/8/Ja2s42g==$n1OZJkN3Ip6t7Tu87+iSMYdiy4o3ElqxSjPxE2cYZxQ=',2);
CREATE TABLE Trabajadores (
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
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(1,2,'Arquitecto',NULL,'EM0038','pbkdf2$100000$MYumAxQtCH+5WAVvrLTHUw==$UhaSubAQLNmxo2fpSa+EpKgVNSlkekFwtCbSDD1l1D8=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(2,3,'Ingeniero de Sistemas',NULL,'EM0014','pbkdf2$100000$2cb8no+m65+Dxmye3swqiQ==$nzGq2sFtsGvf9YD55o/qZVlthSTKEPC1HUKHRdz9bus=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(3,4,'Arquitecta',NULL,'EM0030','pbkdf2$100000$Kyu3htTZ1eaTvp2yojOlYw==$aFaPTwnXQ68huupUhrgZgm+z7dVFInZ9rdNMZH1fero=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(5,6,'Arquitecto',NULL,'EM0009','pbkdf2$100000$4ulV0c7JF10V1yHOFXvcXw==$/vuqNtHH9uoVrQlK2Wl/iyjDWcYMZd3PngVGII5/3gw=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(6,7,'Abogado',NULL,'EM0003','pbkdf2$100000$AevNnaILyympE5UZtZAsJw==$hIIREhJ5iEIQlWHd7b00ztsCcUWVicR1hA2C+zvUFO8=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(7,8,'Abogada',NULL,'EM0011','pbkdf2$100000$gN0IJT3p4WVW+UB9TkxQiQ==$nOnX+D62t7lUnF1g4uJbFFrYB5sw89hOrNlgZzD+yRk=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(8,9,'Arquitecto',NULL,'EM0029','pbkdf2$100000$z8ekWjEMOxA3nmNtsTIXcw==$5rutxoyj2nmQOHM0uKHAtWKlryq9lDn97SDIGRZMsG8=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(9,10,'Ingeniero',NULL,'EM0099','pbkdf2$100000$Wgd+/txJk226vcy5HrlRRQ==$RnPdqak4oX0qwYLi/Dtu6u1tbEk5sTRSFDYP8SGYM2I=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(10,11,'Ingeniero Clivil',NULL,'EM0005','pbkdf2$100000$+ECr8keA8rd1A2hzAqRGgg==$Az+YJmpdMZt5tc/giXT1UDt6FLCIs1uPFIQMSSqwY4o=',1);
INSERT INTO "Trabajadores" ("ID_Trabajador","ID_Empleado","Rol_Cargo","HoraIngreso","Codigo_Trabajador","PIN_Acceso","ID_Rol") VALUES(11,12,'Sistemas',NULL,'EM0015','pbkdf2$100000$oi/+vfKZme3ZAPwOt3Pdsw==$zZ2SYhGozxkwqg4/oUsJ/z6uwUsT/aNbY8u6GPSygnQ=',1);
CREATE TABLE Proyectos (
  ID_Proyecto INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre_Proyecto TEXT NOT NULL,
  Area_Departamento TEXT NOT NULL
);
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(11,'Creacion de planos','Arquitectura');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(12,'Creacion del apartado reporte analitico','Sistemas');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(13,'Alarma emergente','Sistemas');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(14,'ALARMA EMERGENTE DE PLAZO DE PROYECTOS','Sistemas');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(15,'sistema','sistemas');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(16,'Creacion de Interfaces','Sistema');
INSERT INTO "Proyectos" ("ID_Proyecto","Nombre_Proyecto","Area_Departamento") VALUES(17,'Prueba de Icono de Notificacion','Sistemas');
CREATE TABLE Tareas (
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
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(22,2,1,11,'2026-09-14','2026-09-14 13:00:00','2026-09-14 21:50:00','prueba descrei´pcion','Completada','[ENTREGADO FUERA DE PLAZO]');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(23,2,1,11,'2026-09-15','2026-09-15 10:52:00','2026-09-15 14:00:00','prueba123','Completada','');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(24,2,1,12,'2026-09-15','2026-09-15 10:52:00','2026-09-15 14:00:00','prueba123','Completada','');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(25,9,1,13,'2026-09-15','2026-09-15 12:00:00','2026-09-15 12:05:00','Probando la alarma emergente','Completada','[ENTREGADO FUERA DE PLAZO]');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(26,9,1,14,'2026-09-15','2026-09-15 12:16:00','2026-09-15 12:27:00','probando alarma','Completada','');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(27,1,1,14,'2026-09-15','2026-09-15 12:33:00','2026-09-15 12:39:00','prUEBA NUMERO 3 DE LA ALARMA','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(28,9,1,14,'2026-09-15','2026-09-15 12:33:00','2026-09-15 12:39:00','prUEBA NUMERO 3 DE LA ALARMA','Completada','[ENTREGADO FUERA DE PLAZO]');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(29,9,1,14,'2026-09-15','2026-09-15 12:47:00','2026-09-15 12:54:00','prueba numero 4','Completada','[ENTREGADO FUERA DE PLAZO]');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(30,9,1,14,'2026-09-15','2026-09-15 13:00:00','2026-09-15 13:03:00','Prueba numero 4','En Progreso','hazlo de nuevo');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(31,9,1,14,'2026-09-15','2026-09-15 13:06:00','2026-09-15 13:08:00','Prueba numero 6','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(37,2,1,13,'2026-09-18','2026-09-18 14:11:00','2026-09-18 14:20:00','prueba de alarma definitiva','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(38,9,1,15,'2026-10-12','2026-10-12 12:49:10','2026-10-12 12:55:00','tarea','Completada','[ENTREGADO FUERA DE PLAZO]');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(39,9,1,15,'2026-10-13','2026-10-13 18:11:43','2026-10-15 18:11:00','Aaas','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(40,9,1,15,'2026-10-19','2026-10-19 12:15:23','2026-10-22 12:15:00','aaaaa','Completada','');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(41,9,1,16,'2026-10-19','2026-10-19 13:07:26','2026-10-20 20:10:00','se crearon hoy varias interfaces generales de la pagina ERP','Completada','');
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(42,9,1,17,'2026-10-20','2026-10-20 11:52:19','2026-10-21 17:00:00','prueba de notificacion','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(43,9,1,16,'2026-10-20','2026-10-20 11:52:59','2026-10-21 17:00:00','prueba2','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(44,9,1,13,'2026-10-20','2026-10-20 11:55:47','2026-10-23 17:00:00','prueba3','Asignada',NULL);
INSERT INTO "Tareas" ("ID_Tarea","ID_Trabajador","ID_Administrador_Asignador","ID_Proyecto","Fecha","Fecha_Inicio","Fecha_Entrega","Descripcion_Tarea","Estado_Tarea","Observaciones") VALUES(45,9,1,12,'2026-10-20','2026-10-20 11:56:25','2026-10-20 17:00:00','prueba4','Asignada',NULL);
CREATE TABLE Actividades (
  ID_Actividad INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Tarea INTEGER NOT NULL,
  Fecha_Actividad TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Descripcion_Actividad TEXT NOT NULL,
  Estado_Actividad TEXT NOT NULL DEFAULT 'Pendiente' CHECK (Estado_Actividad IN ('Pendiente', 'En Progreso', 'Completada')),
  Observaciones TEXT,
  FOREIGN KEY (ID_Tarea) REFERENCES Tareas(ID_Tarea)
);
CREATE TABLE Archivos (
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
CREATE TABLE Asistencia (
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
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(1,1,'2026-08-17 09:00:00',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(2,2,'2026-08-17 09:30:00',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(3,1,'2026-08-24 14:23:35',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(4,2,'2026-08-24 14:43:16',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(5,2,'2026-08-25 10:45:09',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(6,9,'2026-08-25 14:44:53','2026-08-25 14:45:01');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(7,2,'2026-08-31 09:39:14','2026-08-31 14:40:32');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(8,9,'2026-08-31 09:39:55','2026-08-31 14:40:00');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(9,10,'2026-08-31 12:07:24',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(10,2,'2026-09-01 09:33:34','2026-09-01 13:39:43');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(11,9,'2026-09-01 09:57:29','2026-09-01 13:31:42');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(12,5,'2026-09-01 13:51:09','2026-09-01 13:51:24');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(13,10,'2026-09-01 13:52:32','2026-09-01 18:06:57');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(14,5,'2026-09-02 09:26:57','2026-09-02 17:40:09');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(15,5,'2026-09-03 09:18:07',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(16,2,'2026-09-07 09:28:08','2026-09-07 13:56:20');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(17,3,'2026-09-07 09:29:00','2026-09-07 17:03:47');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(18,1,'2026-09-07 09:30:34','2026-09-07 17:02:09');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(19,11,'2026-09-07 09:30:35','2026-09-07 13:57:27');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(20,5,'2026-09-07 09:31:55',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(21,7,'2026-09-07 09:34:25',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(22,9,'2026-09-07 09:41:52','2026-09-07 13:56:43');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(23,6,'2026-09-07 09:50:07',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(24,7,'2026-09-08 09:23:54',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(25,9,'2026-09-08 09:24:19','2026-09-08 13:15:32');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(26,2,'2026-09-08 09:28:11','2026-09-08 13:15:16');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(27,6,'2026-09-08 09:33:56',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(28,5,'2026-09-08 11:34:55','2026-09-08 17:15:26');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(29,7,'2026-09-09 09:26:45',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(30,5,'2026-09-09 09:54:42',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(31,6,'2026-09-09 10:19:41',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(32,10,'2026-09-09 11:18:41',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(33,7,'2026-09-10 09:26:03',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(34,6,'2026-09-10 09:38:26',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(35,3,'2026-09-10 09:42:34','2026-09-10 17:34:26');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(36,1,'2026-09-10 09:43:13',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(37,5,'2026-09-11 10:39:59',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(38,11,'2026-09-11 11:15:20','2026-09-11 14:52:55');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(39,10,'2026-09-11 13:38:05',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(40,9,'2026-09-14 09:09:35','2026-09-14 14:00:07');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(41,7,'2026-09-14 09:20:16',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(42,2,'2026-09-14 09:25:02','2026-09-14 13:59:58');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(43,1,'2026-09-14 09:36:15','2026-09-14 17:08:02');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(44,5,'2026-09-14 09:50:46',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(45,11,'2026-09-14 09:57:19','2026-09-14 14:01:09');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(46,6,'2026-09-14 09:59:11',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(47,10,'2026-09-14 12:15:05',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(48,9,'2026-09-15 09:12:00','2026-09-15 13:32:25');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(49,7,'2026-09-15 09:28:53',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(50,5,'2026-09-15 09:37:31',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(51,6,'2026-09-15 09:38:15',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(52,2,'2026-09-15 09:55:50','2026-09-15 13:34:59');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(53,10,'2026-09-15 10:32:36',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(54,7,'2026-09-16 09:27:44',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(55,5,'2026-09-16 09:33:45','2026-09-16 17:22:50');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(56,6,'2026-09-16 09:42:44',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(57,2,'2026-09-16 16:01:13',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(58,9,'2026-09-16 20:16:58',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(59,7,'2026-09-17 09:29:56',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(60,6,'2026-09-17 09:32:31',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(61,5,'2026-09-17 09:38:03',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(62,3,'2026-09-17 09:46:28','2026-09-17 17:10:32');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(63,1,'2026-09-17 09:47:45','2026-09-17 17:11:06');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(64,9,'2026-09-17 16:00:15','2026-09-17 21:23:22');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(65,11,'2026-09-17 16:49:51','2026-09-17 21:54:33');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(66,2,'2026-09-17 16:58:35','2026-09-17 21:04:40');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(67,2,'2026-09-18 09:23:31','2026-09-18 14:27:26');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(68,7,'2026-09-18 09:30:32',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(69,11,'2026-09-18 09:37:32','2026-09-18 14:01:52');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(70,6,'2026-09-18 09:40:59',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(71,5,'2026-09-18 09:52:31',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(72,9,'2026-09-18 16:21:13',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(73,9,'2026-09-21 09:15:57',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(74,7,'2026-09-21 09:21:27',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(75,11,'2026-09-21 09:31:13',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(76,2,'2026-09-21 09:35:35',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(77,6,'2026-09-21 09:41:41',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(78,3,'2026-09-21 09:57:02',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(79,1,'2026-09-21 09:58:53',NULL);
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(80,9,'2026-10-12 12:36:45','2026-10-12 12:38:14');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(81,9,'2026-10-19 10:48:09','2026-10-19 13:49:31');
INSERT INTO "Asistencia" ("ID_Asistencia","ID_Trabajador","Fecha_Entrada","Fecha_Salida") VALUES(82,9,'2026-10-20 11:48:54',NULL);
CREATE TABLE Comentarios_Tarea (
  ID_Comentario INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Tarea INTEGER NOT NULL,
  Autor TEXT NOT NULL,
  Rol TEXT NOT NULL CHECK (Rol IN ('Administrador', 'Empleado')),
  Mensaje TEXT NOT NULL,
  Fecha TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ID_Tarea) REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE
);
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(34,22,'Benjamin Alfonso','Empleado','confirmada la tarea','2026-09-14 12:55:19');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(35,22,'Administrador General','Administrador','bien','2026-09-14 12:56:04');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(36,23,'Benjamin Alfonso','Empleado','OK LO TENDRA AHORA MISMO','2026-09-15 10:53:26');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(37,23,'Administrador General','Administrador','ya XD','2026-09-15 10:53:53');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(38,24,'Benjamin Alfonso','Empleado','Hola arquitecto ahora mismo le envio el reporte de los empleados del mes','2026-09-15 11:37:49');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(39,24,'Administrador General','Administrador','ALTOQUE','2026-09-15 11:38:07');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(40,26,'Israel Rodrigo Ochoa Mejia','Empleado','hola','2026-09-15 12:24:59');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(41,26,'Administrador General','Administrador','vuelve a hacerlo bien','2026-09-15 12:25:43');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(42,24,'Administrador General','Administrador','listo cholo','2026-09-15 12:41:21');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(43,29,'Israel Rodrigo Ochoa Mejia','Empleado','yaaa','2026-09-15 12:49:16');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(44,29,'Israel Rodrigo Ochoa Mejia','Empleado','XD','2026-09-15 12:50:23');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(45,38,'Administrador General','Administrador','XD','2026-10-12 17:50:03');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(46,38,'Israel Rodrigo Ochoa Mejia','Empleado','ola','2026-10-12 17:50:13');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(47,38,'Administrador General','Administrador','hola','2026-10-12 17:50:17');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(48,38,'Israel Rodrigo Ochoa Mejia','Empleado','xd','2026-10-12 17:50:30');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(49,41,'Israel Rodrigo Ochoa Mejia','Empleado','hola, ya lo termine','2026-10-19 18:08:39');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(50,41,'Administrador General','Administrador','ok','2026-10-19 18:08:53');
INSERT INTO "Comentarios_Tarea" ("ID_Comentario","ID_Tarea","Autor","Rol","Mensaje","Fecha") VALUES(51,38,'Administrador General','Administrador','aaaa','2026-10-20 18:19:14');
CREATE TABLE Evaluaciones_Rendimiento (
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
INSERT INTO "Evaluaciones_Rendimiento" ("ID_Evaluacion","ID_Trabajador","ID_Administrador","Periodo_Texto","Fecha_Inicio","Fecha_Fin","Total_Asistencias","Llegadas_Tiempo","Tardanzas","Total_Tareas","Tareas_Completadas","Eficiencia_Porcentaje","Fecha_Generacion") VALUES(1,9,1,'Esta Semana','2026-09-14','2026-09-20',2,2,0,6,2,33.3,'2026-09-15 18:12:19');
CREATE TABLE Intentos_Login (
  Clave TEXT PRIMARY KEY,                 -- rol:codigo|ip
  Intentos INTEGER NOT NULL DEFAULT 0,
  Bloqueado_Hasta INTEGER NOT NULL DEFAULT 0, -- epoch en milisegundos
  Actualizado INTEGER NOT NULL
);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:ad001|2001:1388:b6f:1e12:693d:5e0a:18ac:da9d',1,0,1791826084963);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:noexiste|3.95.157.224',2,0,1791826494636);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('admin:em0099|2001:1388:b6f:1e12:693d:5e0a:18ac:da9d',1,0,1791826853330);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:ad001|2001:1388:b6f:1e12:91dc:669:fc5b:8114',1,0,1791827025519);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:em0014|2001:1388:b6f:1e12:91dc:669:fc5b:8114',1,0,1791827057629);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:em1111|38.253.148.176',5,1791843674105,1791842774105);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:em0014|38.253.148.176',1,0,1791903242176);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:em0014|2001:1388:b6f:1e12:f908:f282:112e:1865',2,0,1792435335622);
INSERT INTO "Intentos_Login" ("Clave","Intentos","Bloqueado_Hasta","Actualizado") VALUES('trabajador:ad001|38.25.15.40',1,0,1792976968725);
CREATE TABLE Anuncios (
  ID_Anuncio INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre TEXT NOT NULL CHECK(length(trim(Nombre)) BETWEEN 1 AND 160),
  Motivo TEXT NOT NULL CHECK(length(trim(Motivo)) BETWEEN 1 AND 5000),
  Fecha_Creacion TEXT NOT NULL,
  ID_Administrador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador)
);
INSERT INTO "Anuncios" ("ID_Anuncio","Nombre","Motivo","Fecha_Creacion","ID_Administrador") VALUES(1,'Se crearon las nuevas interfaces!!','v.v','2026-10-19 12:09:30',1);
INSERT INTO "Anuncios" ("ID_Anuncio","Nombre","Motivo","Fecha_Creacion","ID_Administrador") VALUES(2,'Prueba del segundo anuncio','xdd','2026-10-19 12:10:06',1);
CREATE TABLE Cuentas_Usuario (
  ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),
  Rol TEXT NOT NULL CHECK(Rol IN ('admin','trabajador')),
  Version_Sesion INTEGER NOT NULL DEFAULT 0 CHECK(Version_Sesion >= 0)
);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(1,'admin',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(2,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(3,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(4,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(6,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(7,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(8,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(9,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(10,'trabajador',2);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(11,'trabajador',0);
INSERT INTO "Cuentas_Usuario" ("ID_Empleado","Rol","Version_Sesion") VALUES(12,'trabajador',0);
CREATE TABLE Proyectos_Detalle (
 ID_Proyecto INTEGER PRIMARY KEY REFERENCES Proyectos(ID_Proyecto) ON DELETE CASCADE,
 Descripcion TEXT NOT NULL DEFAULT '', Fecha_Programada TEXT,
 Fecha_Creacion TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO "Proyectos_Detalle" ("ID_Proyecto","Descripcion","Fecha_Programada","Fecha_Creacion") VALUES(17,'aaaaa','2026-10-21 09:00:00','2026-10-20T16:50:34.738Z');
CREATE TABLE Tareas_Detalle (
 ID_Tarea INTEGER PRIMARY KEY REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Prioridad TEXT CHECK(Prioridad IS NULL OR Prioridad IN ('Alta','Media','Baja'))
);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(22,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(23,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(24,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(25,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(26,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(27,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(28,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(29,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(30,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(31,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(37,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(38,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(39,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(40,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(41,NULL);
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(42,'Alta');
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(43,'Media');
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(44,'Baja');
INSERT INTO "Tareas_Detalle" ("ID_Tarea","Prioridad") VALUES(45,'Media');
CREATE TABLE Notificaciones_Tarea (
 ID_Notificacion INTEGER PRIMARY KEY AUTOINCREMENT,
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 ID_Tarea INTEGER NOT NULL REFERENCES Tareas(ID_Tarea) ON DELETE CASCADE,
 Tipo TEXT NOT NULL, Nombre_Tarea TEXT NOT NULL, Descripcion TEXT NOT NULL,
 Fecha_Entrega TEXT, Estado TEXT NOT NULL, Observaciones TEXT,
 Fecha_Evento TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(1,10,42,'Asignada','Prueba de Icono de Notificacion','prueba de notificacion','2026-10-21 17:00:00','Asignada',NULL,'2026-10-20T16:52:19.690Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(2,10,43,'Asignada','Creacion de Interfaces','prueba2','2026-10-21 17:00:00','Asignada',NULL,'2026-10-20T16:53:00.045Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(3,1,29,'En revisión','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','prueba numero 4','2026-09-15 12:54:00','En revisión','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:53:21.920Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(4,1,29,'Completada','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','prueba numero 4','2026-09-15 12:54:00','Completada','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:53:40.998Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(5,10,29,'Completada','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','prueba numero 4','2026-09-15 12:54:00','Completada','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:53:40.998Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(6,1,38,'En revisión','sistema','tarea','2026-10-12 12:55:00','En revisión','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:54:05.052Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(7,1,38,'Completada','sistema','tarea','2026-10-12 12:55:00','Completada','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:54:20.650Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(8,10,38,'Completada','sistema','tarea','2026-10-12 12:55:00','Completada','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:54:20.650Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(9,1,30,'En revisión','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','Prueba numero 4','2026-09-15 13:03:00','En revisión','[ENTREGADO FUERA DE PLAZO]','2026-10-20T16:54:27.067Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(10,1,30,'Devuelta','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','Prueba numero 4','2026-09-15 13:03:00','En Progreso','hazlo de nuevo','2026-10-20T16:55:00.827Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(11,10,30,'Devuelta','ALARMA EMERGENTE DE PLAZO DE PROYECTOS','Prueba numero 4','2026-09-15 13:03:00','En Progreso','hazlo de nuevo','2026-10-20T16:55:00.827Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(12,10,44,'Asignada','Alarma emergente','prueba3','2026-10-23 17:00:00','Asignada',NULL,'2026-10-20T16:55:47.630Z');
INSERT INTO "Notificaciones_Tarea" ("ID_Notificacion","ID_Empleado","ID_Tarea","Tipo","Nombre_Tarea","Descripcion","Fecha_Entrega","Estado","Observaciones","Fecha_Evento") VALUES(13,10,45,'Asignada','Creacion del apartado reporte analitico','prueba4','2026-10-20 17:00:00','Asignada',NULL,'2026-10-20T16:56:25.897Z');
CREATE TABLE Notificaciones_Lectura (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado), Ocultas_Hasta INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "Notificaciones_Lectura" ("ID_Empleado","Ocultas_Hasta") VALUES(1,10);
INSERT INTO "Notificaciones_Lectura" ("ID_Empleado","Ocultas_Hasta") VALUES(10,13);
CREATE TABLE Proyectos_Control (
 ID_Proyecto INTEGER PRIMARY KEY REFERENCES Proyectos(ID_Proyecto) ON DELETE CASCADE,
 Eliminado_En TEXT
);
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(11,'2026-10-20 13:17:46');
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(12,'2026-10-20 13:17:55');
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(13,'2026-10-20 13:18:03');
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(14,'2026-10-20 13:18:12');
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(15,'2026-10-20 13:18:21');
INSERT INTO "Proyectos_Control" ("ID_Proyecto","Eliminado_En") VALUES(16,'2026-10-20 13:18:29');
CREATE TABLE Horarios_Laborales (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado) ON DELETE CASCADE,
 Horario_JSON TEXT NOT NULL CHECK(json_valid(Horario_JSON)),
 Actualizado_En TEXT NOT NULL
);
CREATE TABLE Horarios_Vigencia (
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 Desde TEXT NOT NULL,
 Horario_JSON TEXT NOT NULL CHECK(json_valid(Horario_JSON)),
 PRIMARY KEY(ID_Empleado,Desde)
);
CREATE TABLE Marcaciones_Tramo (
 ID_Trabajador INTEGER NOT NULL REFERENCES Trabajadores(ID_Trabajador),
 Fecha TEXT NOT NULL,
 Tramo INTEGER NOT NULL CHECK(Tramo IN (1,2)),
 Inicio_Previsto TEXT NOT NULL,
 Fin_Previsto TEXT NOT NULL,
 Entrada TEXT, Salida TEXT,
 PRIMARY KEY(ID_Trabajador,Fecha,Tramo),
 CHECK(Salida IS NULL OR Entrada IS NOT NULL)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Roles_Sistema',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Empleados',12);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Administrador',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Trabajadores',11);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Proyectos',17);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Tareas',45);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Asistencia',82);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Comentarios_Tarea',51);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Evaluaciones_Rendimiento',1);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Anuncios',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('Notificaciones_Tarea',13);
CREATE UNIQUE INDEX UQ_Roles_Sistema_Nombre ON Roles_Sistema(Nombre_Rol);
CREATE UNIQUE INDEX UQ_Administrador_Empleado ON Administrador(ID_Empleado);
CREATE UNIQUE INDEX UQ_Administrador_Codigo ON Administrador(Codigo_Administrador);
CREATE INDEX FK_Administrador_Roles ON Administrador(ID_Rol);
CREATE UNIQUE INDEX UQ_Trabajadores_Empleado ON Trabajadores(ID_Empleado);
CREATE UNIQUE INDEX UQ_Trabajadores_Codigo ON Trabajadores(Codigo_Trabajador);
CREATE INDEX FK_Trabajadores_Roles ON Trabajadores(ID_Rol);
CREATE INDEX FK_Tareas_Administrador ON Tareas(ID_Administrador_Asignador);
CREATE INDEX FK_Tareas_Proyectos ON Tareas(ID_Proyecto);
CREATE INDEX IX_Tareas_Busqueda ON Tareas(ID_Trabajador, Fecha);
CREATE INDEX FK_Actividades_Tareas ON Actividades(ID_Tarea);
CREATE UNIQUE INDEX UQ_Archivos_GoogleDrive ON Archivos(GoogleDrive_File_ID);
CREATE INDEX FK_Archivos_Trabajadores ON Archivos(ID_Trabajador);
CREATE INDEX FK_Archivos_Tareas ON Archivos(ID_Tarea);
CREATE INDEX FK_Archivos_Actividades ON Archivos(ID_Actividad);
CREATE UNIQUE INDEX UQ_Trabajador_Fecha ON Asistencia(ID_Trabajador, Fecha_Calculada);
CREATE INDEX IX_Comentarios_Tarea_Busqueda ON Comentarios_Tarea(ID_Tarea, Fecha);
CREATE INDEX IX_Evaluaciones_Trabajador ON Evaluaciones_Rendimiento(ID_Trabajador);
CREATE INDEX IX_Evaluaciones_Administrador ON Evaluaciones_Rendimiento(ID_Administrador);
CREATE INDEX IX_Asistencia_Fecha ON Asistencia(Fecha_Calculada);
CREATE INDEX IX_Tareas_Estado_Entrega ON Tareas(Estado_Tarea, Fecha_Entrega);
CREATE INDEX IX_Anuncios_Fecha ON Anuncios(Fecha_Creacion DESC, ID_Anuncio DESC);
CREATE INDEX IX_Notificaciones_Destino ON Notificaciones_Tarea(ID_Empleado,ID_Notificacion DESC);
CREATE INDEX IX_Proyectos_Control_Eliminados ON Proyectos_Control(Eliminado_En);
CREATE INDEX IX_Tramos_Fecha ON Marcaciones_Tramo(Fecha,ID_Trabajador);
CREATE TRIGGER TR_Empleados_UltimoAdmin
BEFORE UPDATE OF Estado ON Empleados
WHEN OLD.Estado='Activo' AND NEW.Estado='Inactivo'
 AND EXISTS (SELECT 1 FROM Administrador A LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=A.ID_Empleado
             WHERE A.ID_Empleado=OLD.ID_Empleado AND COALESCE(C.Rol,'admin')='admin')
 AND (SELECT COUNT(*) FROM Empleados E JOIN Administrador A ON A.ID_Empleado=E.ID_Empleado
      LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
      WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin') <= 1
BEGIN SELECT RAISE(ABORT,'ULTIMO_ADMIN'); END;
CREATE TRIGGER TR_Cuentas_UltimoAdmin
BEFORE UPDATE OF Rol ON Cuentas_Usuario
WHEN OLD.Rol='admin' AND NEW.Rol<>'admin'
 AND EXISTS (SELECT 1 FROM Empleados E WHERE E.ID_Empleado=OLD.ID_Empleado AND E.Estado='Activo')
 AND (SELECT COUNT(*) FROM Empleados E JOIN Administrador A ON A.ID_Empleado=E.ID_Empleado
      LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
      WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin') <= 1
BEGIN SELECT RAISE(ABORT,'ULTIMO_ADMIN'); END;
CREATE TRIGGER TR_Tarea_Asignada_Aviso AFTER INSERT ON Tareas BEGIN
 INSERT OR IGNORE INTO Tareas_Detalle(ID_Tarea) VALUES(NEW.ID_Tarea);
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado)
 SELECT W.ID_Empleado,NEW.ID_Tarea,'Asignada',P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea
 FROM Trabajadores W JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto WHERE W.ID_Trabajador=NEW.ID_Trabajador;
END;
CREATE TRIGGER TR_Tarea_Estado_Aviso AFTER UPDATE OF Estado_Tarea ON Tareas
WHEN OLD.Estado_Tarea<>NEW.Estado_Tarea BEGIN
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT A.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Administrador A JOIN Empleados E ON E.ID_Empleado=A.ID_Empleado
 LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
 JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto
 WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin';
 INSERT INTO Notificaciones_Tarea(ID_Empleado,ID_Tarea,Tipo,Nombre_Tarea,Descripcion,Fecha_Entrega,Estado,Observaciones)
 SELECT W.ID_Empleado,NEW.ID_Tarea,CASE WHEN OLD.Estado_Tarea='En revisión' AND NEW.Estado_Tarea='En Progreso' THEN 'Devuelta' ELSE NEW.Estado_Tarea END,
 P.Nombre_Proyecto,NEW.Descripcion_Tarea,NEW.Fecha_Entrega,NEW.Estado_Tarea,NEW.Observaciones
 FROM Trabajadores W JOIN Proyectos P ON P.ID_Proyecto=NEW.ID_Proyecto
 WHERE W.ID_Trabajador=NEW.ID_Trabajador AND (NEW.Estado_Tarea='Completada' OR (OLD.Estado_Tarea IN ('En revisión','Completada') AND NEW.Estado_Tarea='En Progreso'));
END;
CREATE TRIGGER TR_Tarea_Proyecto_Eliminado BEFORE INSERT ON Tareas
WHEN EXISTS(SELECT 1 FROM Proyectos_Control C WHERE C.ID_Proyecto=NEW.ID_Proyecto AND C.Eliminado_En IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'PROYECTO_ELIMINADO'); END;
CREATE TRIGGER TR_Horario_Vigencia_Insert AFTER INSERT ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN EXISTS(SELECT 1 FROM Empleados E JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND C.Rol='trabajador') THEN NEW.Horario_JSON ELSE 'null' END) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER TR_Horario_Vigencia_Update AFTER UPDATE OF Horario_JSON ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN EXISTS(SELECT 1 FROM Empleados E JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND C.Rol='trabajador') THEN NEW.Horario_JSON ELSE 'null' END) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER TR_Horario_Vigencia_Delete AFTER DELETE ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(OLD.ID_Empleado,date('now','-5 hours','+1 day'),'null') ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER TR_Estado_Vigencia AFTER UPDATE OF Estado ON Empleados WHEN OLD.Estado<>NEW.Estado BEGIN
 INSERT INTO Horarios_Vigencia SELECT NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN NEW.Estado='Activo' AND COALESCE((SELECT Rol FROM Cuentas_Usuario WHERE ID_Empleado=NEW.ID_Empleado),'trabajador')='trabajador' THEN COALESCE((SELECT Horario_JSON FROM Horarios_Laborales WHERE ID_Empleado=NEW.ID_Empleado),'null') ELSE 'null' END
 WHERE EXISTS(SELECT 1 FROM Horarios_Vigencia WHERE ID_Empleado=NEW.ID_Empleado) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER TR_Rol_Vigencia AFTER UPDATE OF Rol ON Cuentas_Usuario WHEN OLD.Rol<>NEW.Rol BEGIN
 INSERT INTO Horarios_Vigencia SELECT NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN NEW.Rol='trabajador' AND (SELECT Estado FROM Empleados WHERE ID_Empleado=NEW.ID_Empleado)='Activo' THEN COALESCE((SELECT Horario_JSON FROM Horarios_Laborales WHERE ID_Empleado=NEW.ID_Empleado),'null') ELSE 'null' END WHERE 1 ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
