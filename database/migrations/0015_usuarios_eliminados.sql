-- Eliminación lógica: conserva los datos históricos y bloquea la reactivación accidental.
CREATE TABLE IF NOT EXISTS Usuarios_Eliminados (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),
 Eliminado_UTC TEXT NOT NULL,
 Eliminado_Por INTEGER NOT NULL REFERENCES Empleados(ID_Empleado)
);
CREATE TRIGGER IF NOT EXISTS TR_Usuario_Eliminado_No_Reactivar
BEFORE UPDATE OF Estado ON Empleados
WHEN NEW.Estado='Activo' AND EXISTS(SELECT 1 FROM Usuarios_Eliminados X WHERE X.ID_Empleado=NEW.ID_Empleado)
BEGIN SELECT RAISE(ABORT,'USUARIO_ELIMINADO'); END;
