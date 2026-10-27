-- Datos FICTICIOS usados solo por las pruebas automáticas (tests/). No se importan a ninguna BD real.
--   Administrador: TESTADM / admin1234  ·  Trabajadores: TEST001, TEST002, TEST003 / 1234
-- Credenciales ficticias con hash. Identidad corporativa explícita para pruebas.

INSERT OR IGNORE INTO Empleados (ID_Empleado, Nombre_Completo, Correo, Estado) VALUES
  (1, 'Administrador General', NULL, 'Activo'),
  (2, 'Ana Torres',   'ana@example.com',   'Activo'),
  (3, 'Luis Ramos',   'luis@example.com',  'Activo'),
  (4, 'Carla Mendoza','carla@example.com', 'Activo');

INSERT OR IGNORE INTO Administrador (ID_Administrador, ID_Empleado, Codigo_Administrador, PIN_Acceso, ID_Rol) VALUES
  (1, 1, 'TESTADM', 'pbkdf2$100000$AwMDAwMDAwMDAwMDAwMDAw==$nrfrT5dMT4QI20+v4xSwmUvUmPG/qutxE8VnTPHXoBs=', 2);

INSERT OR IGNORE INTO Trabajadores (ID_Trabajador, ID_Empleado, Rol_Cargo, Codigo_Trabajador, PIN_Acceso, ID_Rol) VALUES
  (1, 2, 'Arquitecta',  'TEST001', 'pbkdf2$100000$AwMDAwMDAwMDAwMDAwMDAw==$GkTu6FLrsRtwi7gqku5OJqEuTQUU2vNDIAHeQrWbDao=', 1),
  (2, 3, 'Ingeniero',   'TEST002', 'pbkdf2$100000$AwMDAwMDAwMDAwMDAwMDAw==$GkTu6FLrsRtwi7gqku5OJqEuTQUU2vNDIAHeQrWbDao=', 1),
  (3, 4, 'Abogada',     'TEST003', 'pbkdf2$100000$AwMDAwMDAwMDAwMDAwMDAw==$GkTu6FLrsRtwi7gqku5OJqEuTQUU2vNDIAHeQrWbDao=', 1);

INSERT OR IGNORE INTO Proyectos (ID_Proyecto, Nombre_Proyecto, Area_Departamento) VALUES
  (1, 'Proyecto Casuarina', 'Arquitectura'),
  (2, 'Proyecto Cisneros',  'Ingeniería'),
  (3, 'Contratos 2026',     'Legal');

INSERT OR IGNORE INTO Tareas (ID_Tarea, ID_Trabajador, ID_Administrador_Asignador, ID_Proyecto, Fecha, Fecha_Inicio, Fecha_Entrega, Descripcion_Tarea, Estado_Tarea) VALUES
  (1, 1, 1, 1, date('now'),        datetime('now','-1 day'),  datetime('now','+5 hours'), 'Planos de planta baja', 'Asignada'),
  (2, 1, 1, 2, date('now'),        datetime('now','-2 day'),  datetime('now','+2 days'),  'Memoria descriptiva',   'En Progreso'),
  (3, 2, 1, 2, date('now'),        datetime('now','-3 day'),  datetime('now','+9 days'),  'Cálculo estructural',   'Asignada'),
  (4, 3, 1, 3, date('now','-3 day'), datetime('now','-3 day'), datetime('now','-1 day'),  'Revisión de contratos', 'Completada');

INSERT OR IGNORE INTO Asistencia (ID_Trabajador, Fecha_Entrada, Fecha_Salida) VALUES
  (1, date('now','-1 day') || ' 09:05:00', date('now','-1 day') || ' 17:30:00'),
  (2, date('now','-1 day') || ' 09:52:00', date('now','-1 day') || ' 17:45:00'),
  (3, date('now','-1 day') || ' 09:30:00', date('now','-1 day') || ' 17:10:00'),
  (1, date('now','-2 day') || ' 09:20:00', date('now','-2 day') || ' 17:25:00');

INSERT OR IGNORE INTO Comentarios_Tarea (ID_Tarea, Autor, Rol, Mensaje) VALUES
  (2, 'Ana Torres', 'Empleado', 'Aceptada, la entrego en dos días.'),
  (2, 'Administrador General', 'Administrador', 'Perfecto, avísame cualquier bloqueo.');

INSERT OR IGNORE INTO Identidad_Usuario(ID_Empleado,Nombres,Apellido_Paterno,Correo_Personal,Correo_Corporativo) VALUES (1,'Administrador','General',NULL,'admin.administrador@arqyservgen.com'),(2,'Ana','Torres','ana@example.com','user.ana@arqyservgen.com'),(3,'Luis','Ramos','luis@example.com','user.luis@arqyservgen.com'),(4,'Carla','Mendoza','carla@example.com','user.carla@arqyservgen.com');
