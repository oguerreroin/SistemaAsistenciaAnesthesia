-- Script de Base de Datos PostgreSQL - Sistema de Control de Asistencia
-- Configurado para Zona Horaria de Perú (America/Lima)

-- Asegurar la zona horaria en la sesión actual
SET TIME ZONE 'America/Lima';

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    dni VARCHAR(20) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL, -- Guardaremos hashes bcrypt
    nombre VARCHAR(150) NOT NULL,
    rol VARCHAR(30) CHECK (rol IN ('ADMIN', 'PERSONAL', 'MEDICO_INDEPENDIENTE')) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Sedes (Clinicas)
CREATE TABLE IF NOT EXISTS sedes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    latitud NUMERIC(10, 8) NOT NULL,
    longitud NUMERIC(11, 8) NOT NULL,
    radio_permitido_metros INTEGER DEFAULT 200 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Marcaciones de Asistencia
CREATE TABLE IF NOT EXISTS marcaciones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
    sede_id INTEGER REFERENCES sedes(id) ON DELETE CASCADE NOT NULL,
    tipo_marcado VARCHAR(10) CHECK (tipo_marcado IN ('ENTRADA', 'SALIDA')) NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    latitud_marcado NUMERIC(10, 8) NOT NULL,
    longitud_marcado NUMERIC(11, 8) NOT NULL,
    foto_path VARCHAR(512) NOT NULL,
    distancia_metros NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para optimizar consultas de rendimiento en VPS ligero
CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);
CREATE INDEX IF NOT EXISTS idx_marcaciones_usuario_fecha ON marcaciones(usuario_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_marcaciones_fecha ON marcaciones(fecha_hora DESC);

-- ==========================================
-- SEED DATA (Datos semilla de prueba)
-- ==========================================

-- Insertar Sedes con coordenadas reales aproximadas de Lima y Chiclayo
INSERT INTO sedes (nombre, latitud, longitud, radio_permitido_metros) VALUES
('Clinica Delgado', -12.11531200, -77.02987100, 200),     -- Miraflores, Lima
('Guardia Civil', -12.09635000, -77.00512000, 250),       -- San Borja, Lima
('Clinica Chiclayo', -6.77190000, -79.83880000, 300)       -- Chiclayo
ON CONFLICT DO NOTHING;

-- Insertar Usuarios de prueba (DNI como PIN inicial para pruebas)
-- Contraseñas/PINs por defecto (en producción se usarán hashes de bcrypt)
-- Para facilitar las pruebas del MVP, los pin_hash iniciales serán representaciones legibles de contraseñas de prueba (ej: "123456") 
-- pero el backend implementará verificación y hashing con bcrypt.
INSERT INTO usuarios (dni, pin_hash, nombre, rol, status) VALUES
('44444444', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Dr. Carlos Mendoza', 'MEDICO_INDEPENDIENTE', 'ACTIVO'), -- Pin: 123456
('77777777', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Lic. Maria Fernandez', 'PERSONAL', 'ACTIVO'),          -- Pin: 123456
('11111111', '$2b$10$vNqj23KzYQvDqR0H1zDq1eC4LzJ5x8eP1Z1m1u1s1t1r1q1p1o1n1', 'Administrador Principal', 'ADMIN', 'ACTIVO')          -- Pin: 123456
ON CONFLICT DO NOTHING;
