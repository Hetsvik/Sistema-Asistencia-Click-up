-- Actualización aditiva: anuncios y control de acceso. No borra empleados, PIN ni historial.
-- Ejecutar antes de publicar el nuevo backend. Puede ejecutarse más de una vez.
CREATE TABLE IF NOT EXISTS Anuncios (
  ID_Anuncio INTEGER PRIMARY KEY AUTOINCREMENT,
  Nombre TEXT NOT NULL CHECK(length(trim(Nombre)) BETWEEN 1 AND 160),
  Motivo TEXT NOT NULL CHECK(length(trim(Motivo)) BETWEEN 1 AND 5000),
  Fecha_Creacion TEXT NOT NULL,
  ID_Administrador INTEGER NOT NULL REFERENCES Administrador(ID_Administrador)
);
CREATE INDEX IF NOT EXISTS IX_Anuncios_Fecha ON Anuncios(Fecha_Creacion DESC, ID_Anuncio DESC);

-- Un único rol de acceso por empleado. Las filas antiguas de Administrador/Trabajadores
-- se conservan al cambiar de rol para no romper tareas, asistencia ni otras relaciones.
CREATE TABLE IF NOT EXISTS Cuentas_Usuario (
  ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),
  Rol TEXT NOT NULL CHECK(Rol IN ('admin','trabajador')),
  Version_Sesion INTEGER NOT NULL DEFAULT 0 CHECK(Version_Sesion >= 0)
);
INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado, Rol)
  SELECT ID_Empleado, 'admin' FROM Administrador;
INSERT OR IGNORE INTO Cuentas_Usuario(ID_Empleado, Rol)
  SELECT ID_Empleado, 'trabajador' FROM Trabajadores;

-- También protege frente a dos cambios simultáneos que dejarían el sistema sin administrador.
CREATE TRIGGER IF NOT EXISTS TR_Empleados_UltimoAdmin
BEFORE UPDATE OF Estado ON Empleados
WHEN OLD.Estado='Activo' AND NEW.Estado='Inactivo'
 AND EXISTS (SELECT 1 FROM Administrador A LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=A.ID_Empleado
             WHERE A.ID_Empleado=OLD.ID_Empleado AND COALESCE(C.Rol,'admin')='admin')
 AND (SELECT COUNT(*) FROM Empleados E JOIN Administrador A ON A.ID_Empleado=E.ID_Empleado
      LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
      WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin') <= 1
BEGIN SELECT RAISE(ABORT,'ULTIMO_ADMIN'); END;
CREATE TRIGGER IF NOT EXISTS TR_Cuentas_UltimoAdmin
BEFORE UPDATE OF Rol ON Cuentas_Usuario
WHEN OLD.Rol='admin' AND NEW.Rol<>'admin'
 AND EXISTS (SELECT 1 FROM Empleados E WHERE E.ID_Empleado=OLD.ID_Empleado AND E.Estado='Activo')
 AND (SELECT COUNT(*) FROM Empleados E JOIN Administrador A ON A.ID_Empleado=E.ID_Empleado
      LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado
      WHERE E.Estado='Activo' AND COALESCE(C.Rol,'admin')='admin') <= 1
BEGIN SELECT RAISE(ABORT,'ULTIMO_ADMIN'); END;
