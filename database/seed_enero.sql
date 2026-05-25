-- Script Seed de Datos de Prueba para Enero 2026
-- Configurado para Zona Horaria de Perú (America/Lima)

-- Asegurar la zona horaria en la sesión actual
SET TIME ZONE 'America/Lima';

-- 1. Insertar médicos anestesiólogos de prueba si no existen (DNI como identificador, PIN default encriptado con hash de '123456')
INSERT INTO usuarios (dni, pin_hash, nombre, rol, status)
VALUES 
('10000001', '$2a$10$9jZ6R0lh3Ojo4kBEGeCv7eE3ewK1pQOoNRSLpwb7AaMxQ7YB5hMZS', 'DANIEL REBAZA', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
('10000002', '$2a$10$9jZ6R0lh3Ojo4kBEGeCv7eE3ewK1pQOoNRSLpwb7AaMxQ7YB5hMZS', 'NADIA CASTILLO', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
('10000003', '$2a$10$9jZ6R0lh3Ojo4kBEGeCv7eE3ewK1pQOoNRSLpwb7AaMxQ7YB5hMZS', 'JOSE NOVOA', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
('10000004', '$2a$10$9jZ6R0lh3Ojo4kBEGeCv7eE3ewK1pQOoNRSLpwb7AaMxQ7YB5hMZS', 'JONATHAN PEREZ', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
('10000005', '$2a$10$9jZ6R0lh3Ojo4kBEGeCv7eE3ewK1pQOoNRSLpwb7AaMxQ7YB5hMZS', 'JOEL ZAMORA', 'MEDICO_INDEPENDIENTE', 'ACTIVO')
ON CONFLICT (dni) DO NOTHING;

-- 2. Inyectar marcaciones exactas para probar algoritmos de cálculo y cruce de medianoche en Clinica Delgado (ID 1)
-- Las coordenadas de Clinica Delgado son lat: -12.12170000, lon: -77.03260000. Colocamos el marcado a 50 metros.

-- DANIEL REBAZA (Turno Diurno)
INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
VALUES 
((SELECT id FROM usuarios WHERE DNI = '10000001'), 1, 'ENTRADA', '2026-01-01 07:12:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/rebaza_in.jpg', 50.00),
((SELECT id FROM usuarios WHERE DNI = '10000001'), 1, 'SALIDA', '2026-01-01 19:00:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/rebaza_out.jpg', 50.00);

-- NADIA CASTILLO (Turno Diurno)
INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
VALUES 
((SELECT id FROM usuarios WHERE DNI = '10000002'), 1, 'ENTRADA', '2026-01-01 07:35:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/castillo_in.jpg', 50.00),
((SELECT id FROM usuarios WHERE DNI = '10000002'), 1, 'SALIDA', '2026-01-01 19:00:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/castillo_out.jpg', 50.00);

-- JOSE NOVOA (Turno Diurno Corto)
INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
VALUES 
((SELECT id FROM usuarios WHERE DNI = '10000003'), 1, 'ENTRADA', '2026-01-01 11:05:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/novoa_in.jpg', 50.00),
((SELECT id FROM usuarios WHERE DNI = '10000003'), 1, 'SALIDA', '2026-01-01 12:32:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/novoa_out.jpg', 50.00);

-- JONATHAN PEREZ (Turno Nocturno con Cruce de Medianoche)
INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
VALUES 
((SELECT id FROM usuarios WHERE DNI = '10000004'), 1, 'ENTRADA', '2026-01-01 18:50:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/perez_in.jpg', 50.00),
((SELECT id FROM usuarios WHERE DNI = '10000004'), 1, 'SALIDA', '2026-01-02 07:08:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/perez_out.jpg', 50.00);

-- JOEL ZAMORA (Turno Nocturno con Cruce de Medianoche)
INSERT INTO marcaciones (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
VALUES 
((SELECT id FROM usuarios WHERE DNI = '10000005'), 1, 'ENTRADA', '2026-01-01 18:57:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/zamora_in.jpg', 50.00),
((SELECT id FROM usuarios WHERE DNI = '10000005'), 1, 'SALIDA', '2026-01-02 07:46:00-05', -12.122000, -77.032500, '/storage/fotos/2026/01/zamora_out.jpg', 50.00);
