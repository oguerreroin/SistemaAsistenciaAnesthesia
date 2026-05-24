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
    // Original 3 users
    { id: 1, dni: '44444444', pin_hash: hashedPin, nombre: 'Dr. Carlos Mendoza', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 2, dni: '77777777', pin_hash: hashedPin, nombre: 'Lic. Maria Fernandez', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 3, dni: '11111111', pin_hash: hashedPin, nombre: 'Administrador Principal', rol: 'ADMIN', status: 'ACTIVO', created_at: new Date() },
    // 35 additional users with realistic Peruvian names
    { id: 4, dni: '20304050', pin_hash: hashedPin, nombre: 'Lic. Rosa Huaman Quispe', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 5, dni: '20304051', pin_hash: hashedPin, nombre: 'Tec. Jorge Castillo Rojas', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 6, dni: '20304052', pin_hash: hashedPin, nombre: 'Lic. Patricia Flores Gutierrez', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 7, dni: '20304053', pin_hash: hashedPin, nombre: 'Tec. Luis Paredes Chavez', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 8, dni: '20304054', pin_hash: hashedPin, nombre: 'Lic. Carmen Torres Valverde', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 9, dni: '20304055', pin_hash: hashedPin, nombre: 'Tec. Miguel Rios Salazar', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 10, dni: '20304056', pin_hash: hashedPin, nombre: 'Lic. Ana Vargas Espinoza', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 11, dni: '20304057', pin_hash: hashedPin, nombre: 'Tec. Roberto Diaz Palacios', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 12, dni: '20304058', pin_hash: hashedPin, nombre: 'Lic. Gabriela Soto Medina', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 13, dni: '20304059', pin_hash: hashedPin, nombre: 'Tec. Fernando Ramos Cordova', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 14, dni: '20304060', pin_hash: hashedPin, nombre: 'Lic. Sandra Ortiz Leon', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 15, dni: '20304061', pin_hash: hashedPin, nombre: 'Tec. Diego Navarro Cruz', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 16, dni: '20304062', pin_hash: hashedPin, nombre: 'Lic. Lucia Ramirez Bellido', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 17, dni: '20304063', pin_hash: hashedPin, nombre: 'Tec. Oscar Herrera Sanchez', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 18, dni: '20304064', pin_hash: hashedPin, nombre: 'Lic. Elena Castro Delgado', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 19, dni: '20304065', pin_hash: hashedPin, nombre: 'Tec. Raul Aguilar Meza', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 20, dni: '20304066', pin_hash: hashedPin, nombre: 'Lic. Veronica Lara Peña', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 21, dni: '20304067', pin_hash: hashedPin, nombre: 'Tec. Hugo Cardenas Ybarra', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 22, dni: '20304068', pin_hash: hashedPin, nombre: 'Lic. Pilar Morales Zuñiga', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 23, dni: '20304069', pin_hash: hashedPin, nombre: 'Tec. Andres Vega Ruiz', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 24, dni: '20304070', pin_hash: hashedPin, nombre: 'Lic. Cecilia Ponce Arce', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 25, dni: '20304071', pin_hash: hashedPin, nombre: 'Tec. Ricardo Luna Villanueva', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 26, dni: '20304072', pin_hash: hashedPin, nombre: 'Lic. Diana Acosta Huamani', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 27, dni: '20304073', pin_hash: hashedPin, nombre: 'Tec. Julio Vera Montalvo', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    { id: 28, dni: '20304074', pin_hash: hashedPin, nombre: 'Lic. Isabel Campos Tapia', rol: 'PERSONAL', status: 'ACTIVO', created_at: new Date() },
    // MEDICO_INDEPENDIENTE (IDs 29-36)
    { id: 29, dni: '30405060', pin_hash: hashedPin, nombre: 'Dr. Alejandro Gutierrez Paz', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 30, dni: '30405061', pin_hash: hashedPin, nombre: 'Dra. Milagros Reyes Aquino', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 31, dni: '30405062', pin_hash: hashedPin, nombre: 'Dr. Enrique Salazar Toro', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 32, dni: '30405063', pin_hash: hashedPin, nombre: 'Dra. Beatriz Coronel Inca', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 33, dni: '30405064', pin_hash: hashedPin, nombre: 'Dr. Victor Chávez Moreno', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 34, dni: '30405065', pin_hash: hashedPin, nombre: 'Dra. Silvia Zamora Peña', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 35, dni: '30405066', pin_hash: hashedPin, nombre: 'Dr. Manuel Quispe Huanca', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    { id: 36, dni: '30405067', pin_hash: hashedPin, nombre: 'Dra. Karina Espejo Rojas', rol: 'MEDICO_INDEPENDIENTE', status: 'ACTIVO', created_at: new Date() },
    // ADMIN (IDs 37-38)
    { id: 37, dni: '40506070', pin_hash: hashedPin, nombre: 'Adm. Pedro Suarez Villa', rol: 'ADMIN', status: 'ACTIVO', created_at: new Date() },
    { id: 38, dni: '40506071', pin_hash: hashedPin, nombre: 'Adm. Laura Mendez Cortez', rol: 'ADMIN', status: 'ACTIVO', created_at: new Date() },
  ],
  sedes: [
    { id: 1, nombre: 'Clinica Delgado', latitud: -12.12170000, longitud: -77.03260000, radio_permitido_metros: 1000 },
    { id: 2, nombre: 'Auna Guardia Civil', latitud: -12.10150000, longitud: -76.99570000, radio_permitido_metros: 1000 },
    { id: 3, nombre: 'Auna Chiclayo', latitud: -6.77140000, longitud: -79.84090000, radio_permitido_metros: 1000 },
    { id: 4, nombre: 'Condominio Alto Bellavista', latitud: -12.05680000, longitud: -77.09540000, radio_permitido_metros: 1000 }
  ],
  // Generated programmatically below
  marcaciones: [],
  ajustes_reporte: []
};

// ==========================================
// GENERADOR DE MARCACIONES MOCK (Enero 2026)
// ==========================================
(function generarMarcacionesEnero2026() {
  const sedes = mockDb.sedes;
  const totalDays = 31; // January 2026

  // Seed-based pseudo-random for reproducibility
  let seed = 42;
  function seededRandom() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Attendance patterns per user: [userId, assignedSedeId, daysToAttend]
  // ~5 perfect (31 days): users 1,4,5,29,30
  // ~8 partial absences (16-26 days): users 2,6,7,8,9,31,32,33
  // ~3 very few (3-8 days): users 3,37,38
  // remaining (~22 users): 15-25 days
  const attendanceConfig = {};

  // Perfect attendance
  [1, 4, 5, 29, 30].forEach(uid => { attendanceConfig[uid] = 31; });

  // Partial absences (missing 5-15 days => 16-26 days)
  [2, 6, 7, 8, 9, 31, 32, 33].forEach((uid, i) => {
    attendanceConfig[uid] = 26 - i * 1; // 26,25,24,23,22,21,20,19
  });

  // Very few days (3-8)
  attendanceConfig[3] = 5;
  attendanceConfig[37] = 3;
  attendanceConfig[38] = 8;

  // Remaining users: 15-25 days
  const remaining = [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,34,35,36];
  remaining.forEach((uid, i) => {
    attendanceConfig[uid] = 15 + Math.floor(seededRandom() * 11); // 15-25
  });

  let marcacionId = 1;

  mockDb.usuarios.forEach(user => {
    const uid = user.id;
    const sedeId = ((uid - 1) % 4) + 1; // distribute across 4 sedes
    const sede = sedes.find(s => s.id === sedeId);
    const daysToAttend = attendanceConfig[uid] || 20;

    // Generate a set of days this user attends (pick random days from 1-31)
    const allDays = Array.from({ length: totalDays }, (_, i) => i + 1);
    // Shuffle and pick
    for (let i = allDays.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [allDays[i], allDays[j]] = [allDays[j], allDays[i]];
    }
    const attendDays = allDays.slice(0, Math.min(daysToAttend, totalDays)).sort((a, b) => a - b);

    attendDays.forEach(day => {
      // Entry time: 6:00 - 10:00 AM (random)
      const entryHour = 6 + Math.floor(seededRandom() * 4);
      const entryMin = Math.floor(seededRandom() * 60);
      const entrySec = Math.floor(seededRandom() * 60);

      // Shift duration: 1.5 to 4.2 hours in milliseconds
      const shiftHours = 1.5 + seededRandom() * 2.7;
      const shiftMs = shiftHours * 3600000;

      const entryDate = new Date(2026, 0, day, entryHour, entryMin, entrySec);
      const exitDate = new Date(entryDate.getTime() + shiftMs);

      // Small random offset from sede coordinates
      const latOffset1 = (seededRandom() - 0.5) * 0.004;
      const lonOffset1 = (seededRandom() - 0.5) * 0.004;
      const latOffset2 = (seededRandom() - 0.5) * 0.004;
      const lonOffset2 = (seededRandom() - 0.5) * 0.004;

      const dist1 = Math.round((10 + seededRandom() * 790) * 100) / 100;
      const dist2 = Math.round((10 + seededRandom() * 790) * 100) / 100;

      // ENTRADA
      mockDb.marcaciones.push({
        id: marcacionId++,
        usuario_id: uid,
        sede_id: sedeId,
        tipo_marcado: 'ENTRADA',
        fecha_hora: entryDate,
        latitud_marcado: parseFloat((sede.latitud + latOffset1).toFixed(8)),
        longitud_marcado: parseFloat((sede.longitud + lonOffset1).toFixed(8)),
        foto_path: '/storage/fotos/2026/01/mock_foto.jpg',
        distancia_metros: dist1,
        created_at: entryDate
      });

      // SALIDA
      mockDb.marcaciones.push({
        id: marcacionId++,
        usuario_id: uid,
        sede_id: sedeId,
        tipo_marcado: 'SALIDA',
        fecha_hora: exitDate,
        latitud_marcado: parseFloat((sede.latitud + latOffset2).toFixed(8)),
        longitud_marcado: parseFloat((sede.longitud + lonOffset2).toFixed(8)),
        foto_path: '/storage/fotos/2026/01/mock_foto.jpg',
        distancia_metros: dist2,
        created_at: exitDate
      });
    });
  });

  console.log(`✅ Mock data generado: ${mockDb.usuarios.length} usuarios, ${mockDb.marcaciones.length} marcaciones (Enero 2026)`);
})();

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

  // 12.1. SELECT marcaciones con rangos de fechas (Soporte Reporte Analítico)
  if (queryStr.includes('FROM marcaciones m') && queryStr.includes('m.fecha_hora >= $1') && queryStr.includes('m.fecha_hora <= $2')) {
    const [startDate, endDate] = params;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const filtered = mockDb.marcaciones.filter(m => {
      const d = new Date(m.fecha_hora);
      return d >= start && d <= end;
    });
    return {
      rows: filtered,
      rowCount: filtered.length
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
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
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

  // 14. INSERT INTO ajustes_reporte (upsert)
  if (queryStr.startsWith('INSERT INTO ajustes_reporte')) {
    const [usuario_id, mes, anio, asisten_ad, reten, exclusi, proc_val, rne, encargatu, actividades, vacaciones] = params;
    const uid = parseInt(usuario_id, 10);
    const m = parseInt(mes, 10);
    const a = parseInt(anio, 10);
    const existing = mockDb.ajustes_reporte.find(r => r.usuario_id === uid && r.mes === m && r.anio === a);
    if (existing) {
      existing.asisten_ad = parseFloat(asisten_ad) || 0;
      existing.reten = parseFloat(reten) || 0;
      existing.exclusi = parseFloat(exclusi) || 0;
      existing.proc_val = parseFloat(proc_val) || 0;
      existing.rne = parseFloat(rne) || 0;
      existing.encargatu = parseFloat(encargatu) || 0;
      existing.actividades = parseFloat(actividades) || 0;
      existing.vacaciones = parseFloat(vacaciones) || 0;
      return { rows: [existing], rowCount: 1 };
    } else {
      const newAjuste = {
        id: mockDb.ajustes_reporte.length + 1,
        usuario_id: uid, mes: m, anio: a,
        asisten_ad: parseFloat(asisten_ad) || 0,
        reten: parseFloat(reten) || 0,
        exclusi: parseFloat(exclusi) || 0,
        proc_val: parseFloat(proc_val) || 0,
        rne: parseFloat(rne) || 0,
        encargatu: parseFloat(encargatu) || 0,
        actividades: parseFloat(actividades) || 0,
        vacaciones: parseFloat(vacaciones) || 0,
        created_at: new Date()
      };
      mockDb.ajustes_reporte.push(newAjuste);
      return { rows: [newAjuste], rowCount: 1 };
    }
  }

  // 15. SELECT FROM ajustes_reporte
  if (queryStr.includes('FROM ajustes_reporte')) {
    let result = [...mockDb.ajustes_reporte];
    if (queryStr.includes('usuario_id =') && queryStr.includes('mes =') && queryStr.includes('anio =')) {
      const uid = parseInt(params[0], 10);
      const m = parseInt(params[1], 10);
      const a = parseInt(params[2], 10);
      result = result.filter(r => r.usuario_id === uid && r.mes === m && r.anio === a);
    } else if (queryStr.includes('mes =') && queryStr.includes('anio =')) {
      const m = parseInt(params[0], 10);
      const a = parseInt(params[1], 10);
      result = result.filter(r => r.mes === m && r.anio === a);
    }
    return { rows: result, rowCount: result.length };
  }

  // 16. UPDATE ajustes_reporte
  if (queryStr.startsWith('UPDATE ajustes_reporte')) {
    const [asisten_ad, reten, exclusi, proc_val, rne, encargatu, actividades, vacaciones, usuario_id, mes, anio] = params;
    const uid = parseInt(usuario_id, 10);
    const m = parseInt(mes, 10);
    const a = parseInt(anio, 10);
    const existing = mockDb.ajustes_reporte.find(r => r.usuario_id === uid && r.mes === m && r.anio === a);
    if (existing) {
      existing.asisten_ad = parseFloat(asisten_ad) || 0;
      existing.reten = parseFloat(reten) || 0;
      existing.exclusi = parseFloat(exclusi) || 0;
      existing.proc_val = parseFloat(proc_val) || 0;
      existing.rne = parseFloat(rne) || 0;
      existing.encargatu = parseFloat(encargatu) || 0;
      existing.actividades = parseFloat(actividades) || 0;
      existing.vacaciones = parseFloat(vacaciones) || 0;
      return { rows: [existing], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
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
  pool: poolWrapper,
  mockDb: mockDb
};


