-- Mantiene la lectura separada de la eliminación del historial de avisos.
ALTER TABLE Notificaciones_Lectura ADD COLUMN Leidas_Hasta INTEGER NOT NULL DEFAULT 0;
