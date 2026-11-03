-- Áreas organizativas de empleados. No infiere ni modifica áreas de empleados existentes.
CREATE TABLE IF NOT EXISTS Areas_Trabajo (
 ID_Area INTEGER PRIMARY KEY AUTOINCREMENT,
 Nombre TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(Nombre)) BETWEEN 1 AND 80)
);
CREATE TABLE IF NOT EXISTS Empleados_Area (
 ID_Empleado INTEGER PRIMARY KEY REFERENCES Empleados(ID_Empleado),
 ID_Area INTEGER NOT NULL REFERENCES Areas_Trabajo(ID_Area)
);
CREATE INDEX IF NOT EXISTS IX_Empleados_Area ON Empleados_Area(ID_Area,ID_Empleado);