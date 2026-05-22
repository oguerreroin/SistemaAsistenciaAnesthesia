const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./db');
const routes = require('./routes');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARES
// ==========================================

// Configuración de CORS de alto rendimiento
app.use(cors({
  origin: '*', // En producción se puede restringir al dominio específico del VPS
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Habilitar análisis de cuerpos JSON y URL-encoded (máximo 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Servir la carpeta de almacenamiento de fotos de forma estática
// Esto permite acceder a las fotos directamente: http://vps-ip:5000/storage/fotos/...
const storagePath = path.join(__dirname, '../storage');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}
app.use('/storage', express.static(storagePath));

// Registrar todas las rutas bajo /api
app.use('/api', routes);

// Ruta de estado del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado en el servidor:', err);
  res.status(500).json({
    error: 'Ocurrió un error inesperado en el servidor.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA DE LA BASE DE DATOS
// ==========================================
async function inicializarBaseDatos() {
  console.log('Verificando e inicializando base de datos...');
  const client = await db.pool.connect();
  try {
    // 1. Crear tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        dni VARCHAR(20) UNIQUE NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        rol VARCHAR(30) CHECK (rol IN ('ADMIN', 'PERSONAL', 'MEDICO_INDEPENDIENTE')) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO')) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Crear tabla de sedes
    await client.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        latitud NUMERIC(10, 8) NOT NULL,
        longitud NUMERIC(11, 8) NOT NULL,
        radio_permitido_metros INTEGER DEFAULT 200 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Crear tabla de marcaciones
    await client.query(`
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
    `);

    // 4. Crear Índices de rendimiento
    await client.query(`CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON usuarios(dni);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marcaciones_usuario_fecha ON marcaciones(usuario_id, fecha_hora DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_marcaciones_fecha ON marcaciones(fecha_hora DESC);`);

    // 5. Sembrar sedes de prueba si la tabla de sedes está vacía
    const sedesCount = await client.query('SELECT COUNT(*) FROM sedes');
    if (parseInt(sedesCount.rows[0].count, 10) === 0) {
      console.log('Sembrando datos iniciales de sedes clínicas...');
      await client.query(`
        INSERT INTO sedes (nombre, latitud, longitud, radio_permitido_metros) VALUES
        ('Clinica Delgado', -12.11531200, -77.02987100, 200),
        ('Guardia Civil', -12.09635000, -77.00512000, 250),
        ('Clinica Chiclayo', -6.77190000, -79.83880000, 300);
      `);
    }

    // 6. Sembrar usuarios de prueba con hashes reales de bcrypt
    const usuariosCount = await client.query('SELECT COUNT(*) FROM usuarios');
    if (parseInt(usuariosCount.rows[0].count, 10) === 0) {
      console.log('Generando y sembrando usuarios de prueba con hashes bcrypt...');
      
      const pinComun = '123456';
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pinComun, salt);

      await client.query(`
        INSERT INTO usuarios (dni, pin_hash, nombre, rol, status) VALUES
        ('44444444', $1, 'Dr. Carlos Mendoza', 'MEDICO_INDEPENDIENTE', 'ACTIVO'),
        ('77777777', $1, 'Lic. Maria Fernandez', 'PERSONAL', 'ACTIVO'),
        ('11111111', $1, 'Administrador Principal', 'ADMIN', 'ACTIVO');
      `, [hashedPin]);
      
      console.log('¡Usuarios sembrados con PIN por defecto "123456"!');
    }

    console.log('Base de datos inicializada y lista.');
  } catch (err) {
    console.error('Error crítico al inicializar la base de datos:', err);
  } finally {
    client.release();
  }
}

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
app.listen(PORT, async () => {
  console.log(`Servidor Express corriendo en el puerto ${PORT} en modo ${process.env.NODE_ENV || 'development'}`);
  await inicializarBaseDatos();
});
