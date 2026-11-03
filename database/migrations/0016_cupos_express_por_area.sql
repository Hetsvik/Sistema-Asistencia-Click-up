-- Las ofertas anteriores conservan el cupo global: no es posible conocer el área histórica de cada aceptación.
CREATE TABLE IF NOT EXISTS Express_Cupos_Area (
 ID_Express INTEGER NOT NULL,
 ID_Area INTEGER NOT NULL,
 Cupos INTEGER NOT NULL CHECK(Cupos BETWEEN 1 AND 50),
 PRIMARY KEY(ID_Express,ID_Area),
 FOREIGN KEY(ID_Express,ID_Area) REFERENCES Tareas_Express_Areas(ID_Express,ID_Area)
);
CREATE TABLE IF NOT EXISTS Express_Aceptacion_Area (
 ID_Express INTEGER NOT NULL,
 ID_Empleado INTEGER NOT NULL,
 ID_Area INTEGER NOT NULL,
 PRIMARY KEY(ID_Express,ID_Empleado),
 FOREIGN KEY(ID_Express,ID_Empleado) REFERENCES Tareas_Express_Aceptaciones(ID_Express,ID_Empleado),
 FOREIGN KEY(ID_Express,ID_Area) REFERENCES Express_Cupos_Area(ID_Express,ID_Area)
);
CREATE INDEX IF NOT EXISTS IX_Express_Aceptacion_Area ON Express_Aceptacion_Area(ID_Express,ID_Area);
CREATE TRIGGER IF NOT EXISTS TR_Express_Cupo_Area BEFORE INSERT ON Tareas_Express_Aceptaciones
WHEN EXISTS (SELECT 1 FROM Express_Cupos_Area Q WHERE Q.ID_Express=NEW.ID_Express)
BEGIN
 SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM Empleados_Area EA JOIN Express_Cupos_Area Q ON Q.ID_Express=NEW.ID_Express AND Q.ID_Area=EA.ID_Area
  WHERE EA.ID_Empleado=NEW.ID_Empleado
  AND (SELECT COUNT(*) FROM Express_Aceptacion_Area AA WHERE AA.ID_Express=Q.ID_Express AND AA.ID_Area=Q.ID_Area)<Q.Cupos
 ) THEN RAISE(ABORT,'EXPRESS_AREA_LLENA') END;
END;
CREATE TRIGGER IF NOT EXISTS TR_Express_Registrar_Area AFTER INSERT ON Tareas_Express_Aceptaciones
WHEN EXISTS (SELECT 1 FROM Express_Cupos_Area Q WHERE Q.ID_Express=NEW.ID_Express)
BEGIN
 INSERT INTO Express_Aceptacion_Area(ID_Express,ID_Empleado,ID_Area)
 SELECT NEW.ID_Express,NEW.ID_Empleado,EA.ID_Area FROM Empleados_Area EA
 JOIN Express_Cupos_Area Q ON Q.ID_Express=NEW.ID_Express AND Q.ID_Area=EA.ID_Area WHERE EA.ID_Empleado=NEW.ID_Empleado;
END;
