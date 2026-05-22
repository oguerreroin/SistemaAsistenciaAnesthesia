const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const realPool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_DATABASE || 'asistencia_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Configuraciones óptimas para VPS con recursos limitados
  max: 10, // Máximo número de clientes en el pool (ahorra RAM en VPS de 2GB)
  idleTimeoutMillis: 30000, // Cerrar conexiones inactivas tras 30s
  connectionTimeoutMillis: 2000, // Timeout de conexión rápido
});

// Registrar log de conexión exitosa
realPool.on('connect', () => {
  console.log('Conexión establecida con la base de datos PostgreSQL.');
});

realPool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// ==========================================
// MOCK DATABASE EN MEMORIA (FALLBACK)
// ==========================================
let useMock = false;

const salt = bcrypt.genSaltSync(10);
const hashedPin = bcrypt.hashSync('123456', salt);

const mockDb = {
  usuarios: [
    {
      id: 1,
      dni: '44444444',
      pin_hash: hashedPin,
      nombre: 'Dr. Carlos Mendoza',
      rol: 'MEDICO_INDEPENDIENTE',
      status: 'ACTIVO',
      created_at: new Date()
    },
    {
      id: 2,
      dni: '77777777',
      pin_hash: hashedPin,
      nombre: 'Lic. Maria Fernandez',
      rol: 'PERSONAL',
      status: 'ACTIVO',
      created_at: new Date()
    },
    {
      id: 3,
      dni: '11111111',
      pin_hash: hashedPin,
      nombre: 'Administrador Principal',
      rol: 'ADMIN',
      status: 'ACTIVO',
      created_at: new Date()
    }
  ],
  sedes: [
    { id: 1, nombre: 'Clinica Delgado', latitud: -12.11531200, longitud: -77.02987100, radio_permitido_metros: 200 },
    { id: 2, nombre: 'Guardia Civil', latitud: -12.09635000, longitud: -77.00512000, radio_permitido_metros: 250 },
    { id: 3, nombre: 'Clinica Chiclayo', latitud: -6.77190000, longitud: -79.83880000, radio_permitido_metros: 300 }
  ],
  marcaciones: []
};

function runMockQuery(text, params = []) {
  const queryStr = text.trim().replace(/\s+/g, ' ');
  
  // 1. CREATE TABLE / CREATE INDEX / SET TIME ZONE / BEGIN / COMMIT / ROLLBACK (no-ops)
  if (
    queryStr.startsWith('CREATE TABLE') || 
    queryStr.startsWith('CREATE INDEX') || 
    queryStr.startsWith('SET TIME ZONE') ||
    queryStr === 'BEGIN' || 
    queryStr === 'COMMIT' || 
    queryStr === 'ROLLBACK'
  ) {
    return { rows: [], rowCount: 0 };
  }

  // 2. INSERT INTO marcaciones
  if (queryStr.startsWith('INSERT INTO marcaciones')) {
    const [uId, sId, tipo, lat, lon, foto, dist] = params;
    const now = new Date();
    const newMarcacion = {
      id: mockDb.marcaciones.length + 1,
      usuario_id: parseInt(uId, 10),
      sede_id: parseInt(sId, 10),
      tipo_marcado: tipo,
      fecha_hora: now,
      latitud_marcado: parseFloat(lat),
      longitud_marcado: parseFloat(lon),
      foto_path: foto,
      distancia_metros: parseFloat(dist),
      created_at: now
    };
    mockDb.marcaciones.push(newMarcacion);
    return {
      rows: [{ id: newMarcacion.id, fecha_hora: newMarcacion.fecha_hora }],
      rowCount: 1
    };
  }

  // 3. INSERT INTO usuarios
  if (queryStr.startsWith('INSERT INTO usuarios')) {
    const [dni, pin_hash, nombre, rol] = params;
    const now = new Date();
    const newUsuario = {
      id: mockDb.usuarios.length + 1,
      dni,
      pin_hash,
      nombre,
      rol,
      status: 'ACTIVO',
      created_at: now
    };
    mockDb.usuarios.push(newUsuario);
    return {
      rows: [newUsuario],
      rowCount: 1
    };
  }

  // 4. SELECT COUNT(*) FROM sedes
  if (queryStr.includes('SELECT COUNT(*) FROM sedes')) {
    return {
      rows: [{ count: mockDb.sedes.length.toString() }],
      rowCount: 1
    };
  }

  // 5. SELECT COUNT(*) FROM usuarios
  if (queryStr.includes('SELECT COUNT(*) FROM usuarios')) {
    return {
      rows: [{ count: mockDb.usuarios.length.toString() }],
      rowCount: 1
    };
  }

  // 6. INSERT INTO sedes
  if (queryStr.startsWith('INSERT INTO sedes')) {
    return { rows: [], rowCount: 0 };
  }

  // 7. SELECT id, dni, pin_hash, nombre, rol, status FROM usuarios WHERE dni = $1
  // y también: SELECT id FROM usuarios WHERE dni = $1
  if (queryStr.includes('FROM usuarios') && queryStr.includes('dni =')) {
    const dniVal = params[0];
    const user = mockDb.usuarios.find(u => u.dni === dniVal);
    return {
      rows: user ? [user] : [],
      rowCount: user ? 1 : 0
    };
  }

  // 8. SELECT id, dni, nombre, rol, status FROM usuarios WHERE id = $1
  if (queryStr.includes('FROM usuarios') && queryStr.includes('id =')) {
    const idVal = parseInt(params[0], 10);
    const user = mockDb.usuarios.find(u => u.id === idVal);
    return {
      rows: user ? [user] : [],
      rowCount: user ? 1 : 0
    };
  }

  // 9. SELECT id, dni, nombre, rol, status, created_at FROM usuarios ORDER BY nombre ASC
  if (queryStr.includes('FROM usuarios') && queryStr.includes('ORDER BY nombre')) {
    const sorted = [...mockDb.usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return {
      rows: sorted,
      rowCount: sorted.length
    };
  }

  // 10. SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes WHERE id = $1
  if (queryStr.includes('FROM sedes') && queryStr.includes('id =')) {
    const idVal = parseInt(params[0], 10);
    const sede = mockDb.sedes.find(s => s.id === idVal);
    return {
      rows: sede ? [sede] : [],
      rowCount: sede ? 1 : 0
    };
  }

  // 11. SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC
  if (queryStr.includes('FROM sedes') && queryStr.includes('ORDER BY nombre')) {
    const sorted = [...mockDb.sedes].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return {
      rows: sorted,
      rowCount: sorted.length
    };
  }

  // 12. SELECT tipo_marcado, fecha_hora FROM marcaciones WHERE usuario_id = $1 ORDER BY fecha_hora DESC LIMIT 1
  if (queryStr.includes('FROM marcaciones') && queryStr.includes('usuario_id =') && queryStr.includes('LIMIT 1')) {
    const uId = parseInt(params[0], 10);
    const filtered = mockDb.marcaciones
      .filter(m => m.usuario_id === uId)
      .sort((a, b) => b.fecha_hora - a.fecha_hora);
    return {
      rows: filtered.length > 0 ? [{ tipo_marcado: filtered[0].tipo_marcado, fecha_hora: filtered[0].fecha_hora }] : [],
      rowCount: filtered.length > 0 ? 1 : 0
    };
  }

  // 13. Historial de marcaciones con filtros
  if (queryStr.includes('FROM marcaciones m') && queryStr.includes('JOIN usuarios u') && queryStr.includes('JOIN sedes s')) {
    let result = mockDb.marcaciones.map(m => {
      const user = mockDb.usuarios.find(u => u.id === m.usuario_id) || {};
      const sede = mockDb.sedes.find(s => s.id === m.sede_id) || {};
      return {
        id: m.id,
        tipo_marcado: m.tipo_marcado,
        fecha_hora: m.fecha_hora,
        latitud_marcado: m.latitud_marcado,
        longitud_marcado: m.longitud_marcado,
        foto_path: m.foto_path,
        distancia_metros: m.distancia_metros,
        usuario_nombre: user.nombre,
        usuario_dni: user.dni,
        usuario_rol: user.rol,
        usuario_id: m.usuario_id,
        sede_nombre: sede.nombre,
        sede_radio: sede.radio_permitido_metros,
        sede_id: m.sede_id
      };
    });

    if (queryStr.includes('m.fecha_hora >= CURRENT_DATE')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter(m => new Date(m.fecha_hora) >= today);
    } else if (queryStr.includes("date_trunc('week'")) {
      const now = new Date();
      const first = now.getDate() - now.getDay();
      const startOfWeek = new Date(now.setDate(first));
      startOfWeek.setHours(0, 0, 0, 0);
      result = result.filter(m => new Date(m.fecha_hora) >= startOfWeek);
    } else if (queryStr.includes("date_trunc('month'")) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      result = result.filter(m => new Date(m.fecha_hora) >= startOfMonth);
    }

    let currentParamIdx = 0;
    if (queryStr.includes('m.usuario_id = $')) {
      const uId = parseInt(params[currentParamIdx], 10);
      result = result.filter(m => m.usuario_id === uId);
      currentParamIdx++;
    }
    if (queryStr.includes('m.sede_id = $')) {
      const sId = parseInt(params[currentParamIdx], 10);
      result = result.filter(m => m.sede_id === sId);
      currentParamIdx++;
    }

    result.sort((a, b) => new Date(b.fecha_hora) - new Date(a.fecha_hora));

    return {
      rows: result,
      rowCount: result.length
    };
  }

  console.warn('⚠️ Consulta Mock no manejada:', queryStr, params);
  return { rows: [], rowCount: 0 };
}

const mockClient = {
  query: async (text, params) => {
    return runMockQuery(text, params);
  },
  release: () => {}
};

const poolWrapper = {
  connect: async () => {
    if (useMock) {
      return mockClient;
    }
    try {
      const client = await realPool.connect();
      return client;
    } catch (err) {
      console.warn('\n==================================================================');
      console.warn('⚠️  ADVERTENCIA: No se pudo conectar a la base de datos PostgreSQL.');
      console.warn('   Detalle del error:', err.message);
      console.warn('   Activando el MODO DEMOSTRACIÓN con base de datos en memoria (MOCK).');
      console.warn('==================================================================\n');
      useMock = true;
      return mockClient;
    }
  },
  query: async (text, params) => {
    if (useMock) {
      return runMockQuery(text, params);
    }
    try {
      return await realPool.query(text, params);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
        useMock = true;
        console.warn('⚠️ Falló la conexión a PostgreSQL a mitad de camino. Cambiando a MODO MOCK en memoria...');
        return runMockQuery(text, params);
      }
      throw err;
    }
  },
  on: (event, handler) => {
    realPool.on(event, handler);
  }
};

poolWrapper.pool = poolWrapper;

module.exports = {
  query: poolWrapper.query,
  pool: poolWrapper
};


