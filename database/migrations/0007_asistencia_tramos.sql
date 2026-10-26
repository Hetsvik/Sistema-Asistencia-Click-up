-- No se alteran las columnas generadas ni los registros de Asistencia.
CREATE TABLE IF NOT EXISTS Horarios_Vigencia (
 ID_Empleado INTEGER NOT NULL REFERENCES Empleados(ID_Empleado),
 Desde TEXT NOT NULL,
 Horario_JSON TEXT NOT NULL CHECK(json_valid(Horario_JSON)),
 PRIMARY KEY(ID_Empleado,Desde)
);
CREATE TABLE IF NOT EXISTS Marcaciones_Tramo (
 ID_Trabajador INTEGER NOT NULL REFERENCES Trabajadores(ID_Trabajador),
 Fecha TEXT NOT NULL,
 Tramo INTEGER NOT NULL CHECK(Tramo IN (1,2)),
 Inicio_Previsto TEXT NOT NULL,
 Fin_Previsto TEXT NOT NULL,
 Entrada TEXT, Salida TEXT,
 PRIMARY KEY(ID_Trabajador,Fecha,Tramo),
 CHECK(Salida IS NULL OR Entrada IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS IX_Tramos_Fecha ON Marcaciones_Tramo(Fecha,ID_Trabajador);
-- No hay evaluación retrospectiva: el primer horario rige a partir de mañana en Perú.
INSERT OR IGNORE INTO Horarios_Vigencia(ID_Empleado,Desde,Horario_JSON)
SELECT H.ID_Empleado,date('now','-5 hours','+1 day'),H.Horario_JSON
FROM Horarios_Laborales H JOIN Empleados E ON E.ID_Empleado=H.ID_Empleado
JOIN Trabajadores T ON T.ID_Empleado=H.ID_Empleado
LEFT JOIN Cuentas_Usuario C ON C.ID_Empleado=H.ID_Empleado
WHERE E.Estado='Activo' AND COALESCE(C.Rol,'trabajador')='trabajador'
AND NOT EXISTS(SELECT 1 FROM Horarios_Vigencia V WHERE V.ID_Empleado=H.ID_Empleado);
CREATE TRIGGER IF NOT EXISTS TR_Horario_Vigencia_Insert AFTER INSERT ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN EXISTS(SELECT 1 FROM Empleados E JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND C.Rol='trabajador') THEN NEW.Horario_JSON ELSE 'null' END) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER IF NOT EXISTS TR_Horario_Vigencia_Update AFTER UPDATE OF Horario_JSON ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN EXISTS(SELECT 1 FROM Empleados E JOIN Cuentas_Usuario C ON C.ID_Empleado=E.ID_Empleado WHERE E.ID_Empleado=NEW.ID_Empleado AND E.Estado='Activo' AND C.Rol='trabajador') THEN NEW.Horario_JSON ELSE 'null' END) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER IF NOT EXISTS TR_Horario_Vigencia_Delete AFTER DELETE ON Horarios_Laborales BEGIN
 INSERT INTO Horarios_Vigencia VALUES(OLD.ID_Empleado,date('now','-5 hours','+1 day'),'null') ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER IF NOT EXISTS TR_Estado_Vigencia AFTER UPDATE OF Estado ON Empleados WHEN OLD.Estado<>NEW.Estado BEGIN
 INSERT INTO Horarios_Vigencia SELECT NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN NEW.Estado='Activo' AND COALESCE((SELECT Rol FROM Cuentas_Usuario WHERE ID_Empleado=NEW.ID_Empleado),'trabajador')='trabajador' THEN COALESCE((SELECT Horario_JSON FROM Horarios_Laborales WHERE ID_Empleado=NEW.ID_Empleado),'null') ELSE 'null' END
 WHERE EXISTS(SELECT 1 FROM Horarios_Vigencia WHERE ID_Empleado=NEW.ID_Empleado) ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
CREATE TRIGGER IF NOT EXISTS TR_Rol_Vigencia AFTER UPDATE OF Rol ON Cuentas_Usuario WHEN OLD.Rol<>NEW.Rol BEGIN
 INSERT INTO Horarios_Vigencia SELECT NEW.ID_Empleado,date('now','-5 hours','+1 day'),
 CASE WHEN NEW.Rol='trabajador' AND (SELECT Estado FROM Empleados WHERE ID_Empleado=NEW.ID_Empleado)='Activo' THEN COALESCE((SELECT Horario_JSON FROM Horarios_Laborales WHERE ID_Empleado=NEW.ID_Empleado),'null') ELSE 'null' END WHERE 1 ON CONFLICT(ID_Empleado,Desde) DO UPDATE SET Horario_JSON=excluded.Horario_JSON;
END;
