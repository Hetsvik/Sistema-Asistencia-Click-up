-- Las notificaciones de cambios de estado se gestionan desde la API.
-- Así un problema de avisos no puede impedir actualizar una tarea.
DROP TRIGGER IF EXISTS TR_Tarea_Estado_Aviso;
