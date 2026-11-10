-- Permite guardar tantos tramos de asistencia como tenga el horario del trabajador.
DROP INDEX IF EXISTS IX_Tramos_Fecha;
ALTER TABLE Marcaciones_Tramo RENAME TO Marcaciones_Tramo_Anterior;
CREATE TABLE Marcaciones_Tramo (
 ID_Trabajador INTEGER NOT NULL REFERENCES Trabajadores(ID_Trabajador),
 Fecha TEXT NOT NULL,
 Tramo INTEGER NOT NULL CHECK(Tramo > 0),
 Inicio_Previsto TEXT NOT NULL,
 Fin_Previsto TEXT NOT NULL,
 Entrada TEXT, Salida TEXT,
 PRIMARY KEY(ID_Trabajador,Fecha,Tramo),
 CHECK(Salida IS NULL OR Entrada IS NOT NULL)
);
INSERT INTO Marcaciones_Tramo SELECT ID_Trabajador,Fecha,Tramo,Inicio_Previsto,Fin_Previsto,Entrada,Salida FROM Marcaciones_Tramo_Anterior;
DROP TABLE Marcaciones_Tramo_Anterior;
CREATE INDEX IX_Tramos_Fecha ON Marcaciones_Tramo(Fecha,ID_Trabajador);
