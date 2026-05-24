-- Script SQL de inicialización de datos de prueba (Mock Data) para PostgreSQL
-- Diseñado para inyectar 35 colaboradores adicionales y ~1500 marcaciones pareadas para Enero 2026.
-- Ejecutar en el servidor VPS usando: psql -U postgres -d asistencia_db -f seed_mock_data.sql

BEGIN;

-- 1. Inserción de 35 Colaboradores ficticios con nombres peruanos realistas
-- Pin hash por defecto: 123456 ($2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1)
INSERT INTO usuarios (id, dni, pin_hash, nombre, rol, status) VALUES
(4, '20304050', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Rosa Huaman Quispe', 'PERSONAL', 'ACTIVO'),
(5, '20304051', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Jorge Castillo Rojas', 'PERSONAL', 'ACTIVO'),
(6, '20304052', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Patricia Flores Gutierrez', 'PERSONAL', 'ACTIVO'),
(7, '20304053', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Luis Paredes Chavez', 'PERSONAL', 'ACTIVO'),
(8, '20304054', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Carmen Torres Valverde', 'PERSONAL', 'ACTIVO'),
(9, '20304055', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Miguel Rios Salazar', 'PERSONAL', 'ACTIVO'),
(10, '20304056', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Ana Vargas Espinoza', 'PERSONAL', 'ACTIVO'),
(11, '20304057', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Roberto Diaz Palacios', 'PERSONAL', 'ACTIVO'),
(12, '20304058', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Gabriela Soto Medina', 'PERSONAL', 'ACTIVO'),
(13, '20304059', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Fernando Ramos Cordova', 'PERSONAL', 'ACTIVO'),
(14, '20304060', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Silvia Coaguila', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(15, '20304061', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Alejandro Ruiz Aguilar', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(16, '20304062', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dra. Elena Medina Ortiz', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(17, '20304063', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Francisco Salazar Delgado', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(18, '20304064', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dra. Maria Gamero Villanueva', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(19, '20304065', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Javier Benitez Flores', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(20, '20304066', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dra. Silvia Coaguila Valdivia', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(21, '20304067', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Elizabeth Enriquez Ponce', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
(22, '20304068', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Hector Lopez', 'PERSONAL', 'ACTIVO'),
(23, '20304069', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Sonia Alvarez Chavez', 'PERSONAL', 'ACTIVO'),
(24, '20304070', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Martin Villanueva Rivera', 'PERSONAL', 'ACTIVO'),
(25, '20304071', '$2b$10$vNq$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Beatriz Ortiz Roman', 'PERSONAL', 'ACTIVO'),
(26, '20304072', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Ricardo Mendoza Alvarez', 'PERSONAL', 'ACTIVO'),
(27, '20304073', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Juana Medina Torres', 'PERSONAL', 'ACTIVO'),
(28, '20304074', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Flor Montenegro Rojas', 'PERSONAL', 'ACTIVO'),
(29, '20304075', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Pedro Gomez Flores', 'PERSONAL', 'ACTIVO'),
(30, '20304076', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Sofia Gutierrez Rivas', 'PERSONAL', 'ACTIVO'),
(31, '20304077', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. David Paredes Ruiz', 'PERSONAL', 'ACTIVO'),
(32, '20304078', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Victoria Rojas Medina', 'PERSONAL', 'ACTIVO'),
(33, '20304079', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Oscar Guerrero Huaman', 'PERSONAL', 'ACTIVO'),
(34, '20304080', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Isabel Salazar Soto', 'PERSONAL', 'ACTIVO'),
(35, '20304081', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Cesar Diaz Espinoza', 'PERSONAL', 'ACTIVO'),
(36, '20304082', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Laura Ramos Cordero', 'PERSONAL', 'ACTIVO'),
(37, '20304083', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Tec. Manuel Soto Palacios', 'PERSONAL', 'ACTIVO'),
(38, '20304084', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Oscar Castillo Silva', 'ADMIN', 'ACTIVO')
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  rol = EXCLUDED.rol,
  status = EXCLUDED.status;

-- Ajustar la secuencia de IDs de usuarios
SELECT setval('usuarios_id_seq', COALESCE((SELECT MAX(id)+1 FROM usuarios), 1), false);

-- 2. Procedimiento Almacenado PL/pgSQL para generar marcaciones realistas
CREATE OR REPLACE FUNCTION generar_marcaciones_semilla()
RETURNS VOID AS $$
DECLARE
    user_rec RECORD;
    day_val INT;
    entry_time TIMESTAMP WITH TIME ZONE;
    exit_time TIMESTAMP WITH TIME ZONE;
    shift_hours NUMERIC;
    sede_id_val INT;
    lat_val NUMERIC;
    lon_val NUMERIC;
    dist_val NUMERIC;
    lat_center NUMERIC;
    lon_center NUMERIC;
    perfect_user INT;
    random_factor NUMERIC;
BEGIN
    -- Borrar marcaciones de enero de 2026 de los usuarios inyectados para evitar duplicados
    DELETE FROM marcaciones WHERE fecha_hora >= '2026-01-01 00:00:00' AND fecha_hora <= '2026-01-31 23:59:59';

    -- Loop de usuarios
    FOR user_rec IN SELECT id, rol FROM usuarios LOOP
        -- Omitir el administrador central (id = 3) que no suele marcar asistencia
        IF user_rec.id = 3 THEN
            CONTINUE;
        END IF;

        -- Sede asignada (rotación 1-4)
        sede_id_val := ((user_rec.id - 1) % 4) + 1;
        
        -- Obtener coordenadas centrales de la sede
        SELECT latitud, longitud INTO lat_center, lon_center FROM sedes WHERE id = sede_id_val;

        -- Loop de los 31 días de Enero 2026
        FOR day_val IN 1..31 LOOP
            -- Generar semilla semi-aleatoria basada en el ID del usuario y el día
            random_factor := ((user_rec.id * 17 + day_val * 31) % 100) / 100.0;

            -- Comportamientos de asistencia realistas:
            -- 1. Usuarios con asistencia perfecta (ID 1, 4, 8, 12, 16)
            -- 2. Usuarios con inasistencias parciales (resto de usuarios, faltan entre 5-15 días)
            -- 3. Usuarios de vacaciones (ID 5, 15, 25 tienen muy pocos días)
            IF user_rec.id IN (1, 4, 8, 12, 16) THEN
                -- Asistencia Perfecta: Marca todos los días
            ELSIF user_rec.id IN (5, 15, 25) THEN
                -- Vacaciones: Solo marca los días 1, 2, 3, 4, 5
                IF day_val > 5 THEN
                    CONTINUE;
                END IF;
            ELSE
                -- Asistencia parcial: Falta en algunos días aleatorios (domingos o días específicos)
                IF (day_val % 7 = 0) OR (random_factor < 0.2) THEN
                    CONTINUE;
                END IF;
            END IF;

            -- Hora de entrada aleatoria entre 6:00 AM y 10:00 AM
            entry_time := make_timestamptz(2026, 1, day_val, 6 + floor(random_factor * 4)::int, floor(random_factor * 60)::int, 0, 'America/Lima');
            
            -- Duración de jornada médica/personal: de 1.5 a 4.2 horas
            shift_hours := 1.5 + (random_factor * 2.7);
            exit_time := entry_time + (shift_hours || ' hours')::interval;

            -- Distancias e inexactitudes de GPS
            dist_val := 10 + (random_factor * 790); -- entre 10 y 800 metros (rango legal de 1km)
            lat_val := lat_center + (random_factor - 0.5) * 0.003;
            lon_val := lon_center + (random_factor - 0.5) * 0.003;

            -- Entrada
            INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros, created_at)
            VALUES (
                user_rec.id, 
                sede_id_val, 
                'ENTRADA', 
                entry_time, 
                lat_val, 
                lon_val, 
                '/storage/fotos/2026/01/mock_foto.jpg', 
                dist_val, 
                entry_time
            );

            -- Salida
            INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros, created_at)
            VALUES (
                user_rec.id, 
                sede_id_val, 
                'SALIDA', 
                exit_time, 
                lat_val + 0.0001, 
                lon_val - 0.0001, 
                '/storage/fotos/2026/01/mock_foto.jpg', 
                dist_val + 5, 
                exit_time
            );

        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar generador
SELECT generar_marcaciones_semilla();

-- Limpiar función auxiliar
DROP FUNCTION generar_marcaciones_semilla();

COMMIT;
