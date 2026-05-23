-- Actualización Segura de Sedes en Producción
-- ----------------------------------------------------
-- Este script elimina las sedes anteriores y registra las 4 sedes oficiales.
-- ADVERTENCIA: Si hay marcaciones asociadas a las sedes anteriores (IDs 1, 2, 3), 
-- la restricción ON DELETE CASCADE de la tabla 'marcaciones' eliminará ese historial.
-- Si prefieres conservar el historial, en lugar de DELETE, cambia a UPDATE o simplemente añade.

BEGIN;

-- 1. Eliminar sedes existentes (opcional, si queremos tener una tabla limpia sin datos de prueba)
-- DELETE FROM sedes;
-- (Nota: Lo he comentado por seguridad. Si no te importa borrar marcaciones de prueba, descomenta la línea anterior).

-- 2. Insertar las sedes reales
INSERT INTO sedes (nombre, latitud, longitud, radio_permitido_metros) VALUES
('Clinica Delgado', -12.12170000, -77.03260000, 200),
('Auna Guardia Civil', -12.10150000, -76.99570000, 200),
('Auna Chiclayo', -6.77140000, -79.84090000, 200),
('Condominio Alto Bellavista', -12.05680000, -77.09540000, 200);

COMMIT;
