const db = require('../db');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Formula de Haversine para calcular la distancia en metros entre dos coordenadas
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en metros
}

// Endpoint para realizar la marcacion
exports.marcarAsistencia = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { usuario_id, sede_id, latitud, longitud } = req.body;

    // 1. Validaciones de Parametros Obligatorios
    if (!usuario_id || !sede_id || !latitud || !longitud) {
      return res.status(400).json({ 
        error: 'Todos los campos son obligatorios: usuario_id, sede_id, latitud, longitud.' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'La foto de la camara web es obligatoria.' });
    }

    const latFloat = parseFloat(latitud);
    const lonFloat = parseFloat(longitud);
    const sedeIdInt = parseInt(sede_id, 10);
    const usuarioIdInt = parseInt(usuario_id, 10);

    if (isNaN(latFloat) || isNaN(lonFloat) || isNaN(usuarioIdInt) || isNaN(sedeIdInt)) {
      return res.status(400).json({ error: 'Las coordenadas o IDs enviados no son validos.' });
    }

    await client.query('BEGIN');

    // 2. Verificar Usuario por ID (Previamente autenticado en Login)
    const userRes = await client.query(
      'SELECT id, dni, nombre, rol, status FROM usuarios WHERE id = $1',
      [usuarioIdInt]
    );

    if (userRes.rows.length === 0) {
      throw { status: 404, message: 'Usuario no encontrado en el sistema.' };
    }

    const usuario = userRes.rows[0];
    
    if (usuario.status !== 'ACTIVO') {
      throw { status: 403, message: 'El usuario se encuentra INACTIVO en el sistema.' };
    }

    // 3. Obtener Datos de la Sede Seleccionada
    const sedeRes = await client.query(
      'SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes WHERE id = $1',
      [sedeIdInt]
    );

    if (sedeRes.rows.length === 0) {
      throw { status: 404, message: 'La sede seleccionada no existe.' };
    }

    const sede = sedeRes.rows[0];

    // 4. Calcular Distancia a la Sede
    const latSede = parseFloat(sede.latitud);
    const lonSede = parseFloat(sede.longitud);
    const distanciaMetros = calcularDistanciaHaversine(latFloat, lonFloat, latSede, lonSede);
    const fueraDeRango = distanciaMetros > sede.radio_permitido_metros;

    // 5. Validacion de Secuencia (Consulta de la ultima marcacion)
    const ultimaMarcacionRes = await client.query(
      `SELECT tipo_marcado, fecha_hora 
       FROM marcaciones 
       WHERE usuario_id = $1 
       ORDER BY fecha_hora DESC 
       LIMIT 1`,
      [usuario.id]
    );

    const ultimaMarcacion = ultimaMarcacionRes.rows[0];
    let nuevoTipoMarcado = 'ENTRADA';

    if (ultimaMarcacion) {
      if (ultimaMarcacion.tipo_marcado === 'ENTRADA') {
        nuevoTipoMarcado = 'SALIDA';
      } else {
        nuevoTipoMarcado = 'ENTRADA';
      }
    }

    // 6. Bloqueo de 10 Minutos para la SALIDA
    if (nuevoTipoMarcado === 'SALIDA' && ultimaMarcacion) {
      const horaServidorActual = new Date();
      const horaUltimaEntrada = new Date(ultimaMarcacion.fecha_hora);
      const diferenciaMs = horaServidorActual - horaUltimaEntrada;
      const diferenciaMinutos = diferenciaMs / (1000 * 60);

      if (diferenciaMinutos < 10) {
        const minutosRestantes = Math.ceil(10 - diferenciaMinutos);
        throw { 
          status: 400, 
          message: `Bloqueo de Seguridad: Deben transcurrir al menos 10 minutos desde su Entrada para marcar la Salida. Faltan aproximadamente ${minutosRestantes} minuto(s).` 
        };
      }
    }

    // 7. Ruta de la Foto guardada por Multer
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const relativeFotoPath = `/storage/fotos/${year}/${month}/${req.file.filename}`;

    // 8. Insertar Marcacion en la BD usando America/Lima como zona horaria del servidor
    const insertRes = await client.query(
      `INSERT INTO marcaciones 
       (usuario_id, sede_id, tipo_marcado, fecha_hora, latitud_marcado, longitud_marcado, foto_path, distancia_metros)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7)
       RETURNING id, fecha_hora`,
      [
        usuario.id,
        sede.id,
        nuevoTipoMarcado,
        latFloat,
        lonFloat,
        relativeFotoPath,
        distanciaMetros
      ]
    );

    const registroInsertado = insertRes.rows[0];

    await client.query('COMMIT');

    let horasTrabajadas = null;
    if (nuevoTipoMarcado === 'SALIDA' && ultimaMarcacion) {
      const dateEntrada = new Date(ultimaMarcacion.fecha_hora);
      const dateSalida = new Date(registroInsertado.fecha_hora);
      const diffMs = dateSalida - dateEntrada;
      const decimalHrs = diffMs / 3600000;
      horasTrabajadas = Math.round(decimalHrs * 100) / 100;
    }

    return res.status(201).json({
      success: true,
      message: `¡Registro de ${nuevoTipoMarcado} Exitoso!`,
      data: {
        id: registroInsertado.id,
        usuario: usuario.nombre,
        rol: usuario.rol,
        tipo_marcado: nuevoTipoMarcado,
        sede: sede.nombre,
        fecha_hora: registroInsertado.fecha_hora,
        distancia_metros: Math.round(distanciaMetros * 100) / 100,
        fuera_de_rango: fueraDeRango,
        radio_permitido: sede.radio_permitido_metros,
        horas_trabajadas: horasTrabajadas
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar marcacion:', error);

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error al eliminar foto tras rollback:', err);
      }
    }

    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      error: error.message || 'Error interno del servidor al procesar la marcacion.'
    });
  } finally {
    client.release();
  }
};

// Obtener todas las sedes
exports.obtenerSedes = async (req, res) => {
  try {
    const sedesRes = await db.query(
      "SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes WHERE nombre NOT ILIKE '%Alto Bellavista%' ORDER BY nombre ASC"
    );
    return res.json(sedesRes.rows);
  } catch (error) {
    console.error('Error al obtener sedes:', error);
    return res.status(500).json({ error: 'Error al obtener el listado de sedes.' });
  }
};

// Helper para calcular e inyectar horas_trabajadas en las marcaciones de tipo SALIDA
async function enriquecerMarcacionesConHoras(rows) {
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i];
    if (m.tipo_marcado === 'SALIDA') {
      let entrada = rows.slice(i + 1).find(r => 
        r.usuario_id === m.usuario_id && 
        r.tipo_marcado === 'ENTRADA' && 
        new Date(r.fecha_hora) < new Date(m.fecha_hora)
      );

      if (!entrada) {
        try {
          const res = await db.query(
            `SELECT fecha_hora FROM marcaciones 
             WHERE usuario_id = $1 AND tipo_marcado = 'ENTRADA' AND fecha_hora < $2 
             ORDER BY fecha_hora DESC LIMIT 1`,
            [m.usuario_id, m.fecha_hora]
          );
          if (res.rows.length > 0) {
            entrada = res.rows[0];
          }
        } catch (err) {
          console.error('Error al buscar entrada correspondiente en BD:', err);
        }
      }

      if (entrada) {
        const diffMs = new Date(m.fecha_hora) - new Date(entrada.fecha_hora);
        const hrs = diffMs / 3600000;
        m.horas_trabajadas = Math.round(hrs * 100) / 100;
      }
    }
  }
  return rows;
}

// Historial de marcaciones con filtros
exports.obtenerHistorialMarcaciones = async (req, res) => {
  try {
    const { rango, usuario_id, sede_id } = req.query;
    
    let queryText = `
      SELECT 
        m.id, 
        m.tipo_marcado, 
        m.fecha_hora, 
        m.latitud_marcado, 
        m.longitud_marcado, 
        m.foto_path, 
        m.distancia_metros,
        u.nombre AS usuario_nombre, 
        u.dni AS usuario_dni,
        u.rol AS usuario_rol,
        s.nombre AS sede_nombre,
        s.radio_permitido_metros AS sede_radio
      FROM marcaciones m
      JOIN usuarios u ON m.usuario_id = u.id
      JOIN sedes s ON m.sede_id = s.id
      WHERE s.nombre NOT LIKE '%Alto Bellavista%'
    `;
    
    const queryParams = [];
    let paramCounter = 1;

    if (rango === 'hoy') {
      queryText += ` AND m.fecha_hora >= CURRENT_DATE`;
    } else if (rango === 'semana') {
      queryText += ` AND m.fecha_hora >= date_trunc('week', CURRENT_DATE)`;
    } else if (rango === 'mes') {
      queryText += ` AND m.fecha_hora >= date_trunc('month', CURRENT_DATE)`;
    }

    if (usuario_id) {
      queryText += ` AND m.usuario_id = $${paramCounter}`;
      queryParams.push(parseInt(usuario_id, 10));
      paramCounter++;
    }

    if (sede_id) {
      queryText += ` AND m.sede_id = $${paramCounter}`;
      queryParams.push(parseInt(sede_id, 10));
      paramCounter++;
    }

    queryText += ` ORDER BY m.fecha_hora DESC`;

    const historialRes = await db.query(queryText, queryParams);
    const enriched = await enriquecerMarcacionesConHoras(historialRes.rows);
    return res.json(enriched);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return res.status(500).json({ error: 'Error al obtener el historial de marcaciones.' });
  }
};

// Helper para construir el query de reporte (coincidente con los filtros del Admin)
async function obtenerDatosFiltrados(query) {
  const { rango, usuario_id, sede_id } = query;
  
  let queryText = `
    SELECT 
      m.id, 
      m.tipo_marcado, 
      m.fecha_hora, 
      m.latitud_marcado, 
      m.longitud_marcado, 
      m.foto_path, 
      m.distancia_metros,
      u.nombre AS usuario_nombre, 
      u.dni AS usuario_dni,
      u.rol AS usuario_rol,
      s.nombre AS sede_nombre,
      s.radio_permitido_metros AS sede_radio
    FROM marcaciones m
    JOIN usuarios u ON m.usuario_id = u.id
    JOIN sedes s ON m.sede_id = s.id
    WHERE s.nombre NOT LIKE '%Alto Bellavista%'
  `;
  
  const queryParams = [];
  let paramCounter = 1;

  if (rango === 'hoy') {
    queryText += ` AND m.fecha_hora >= CURRENT_DATE`;
  } else if (rango === 'semana') {
    queryText += ` AND m.fecha_hora >= date_trunc('week', CURRENT_DATE)`;
  } else if (rango === 'mes') {
    queryText += ` AND m.fecha_hora >= date_trunc('month', CURRENT_DATE)`;
  }

  if (usuario_id) {
    queryText += ` AND m.usuario_id = $${paramCounter}`;
    queryParams.push(parseInt(usuario_id, 10));
    paramCounter++;
  }

  if (sede_id) {
    queryText += ` AND m.sede_id = $${paramCounter}`;
    queryParams.push(parseInt(sede_id, 10));
    paramCounter++;
  }

  queryText += ` ORDER BY m.fecha_hora DESC`;

  const res = await db.query(queryText, queryParams);
  const enriched = await enriquecerMarcacionesConHoras(res.rows);
  return enriched;
}

// Exportacion a Excel optimizada en memoria
exports.exportarExcel = async (req, res) => {
  try {
    const rows = await obtenerDatosFiltrados(req.query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Asistencias');

    worksheet.columns = [
      { header: 'ID Marcación', key: 'id', width: 12 },
      { header: 'DNI Empleado', key: 'dni', width: 15 },
      { header: 'Nombre Colaborador', key: 'nombre', width: 30 },
      { header: 'Rol/Cargo', key: 'rol', width: 25 },
      { header: 'Clínica / Sede', key: 'sede', width: 20 },
      { header: 'Tipo Marcado', key: 'tipo', width: 15 },
      { header: 'Fecha y Hora (America/Lima)', key: 'fecha_hora', width: 25 },
      { header: 'Latitud', key: 'latitud', width: 15 },
      { header: 'Longitud', key: 'longitud', width: 15 },
      { header: 'Distancia a Sede (m)', key: 'distancia', width: 22 },
      { header: 'Estado Rango', key: 'rango', width: 18 }
    ];

    // Estilo de la fila de cabecera (Azul oscuro premium)
    worksheet.getRow(1).font = { name: 'Segoe UI', family: 4, size: 11, bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 25;

    // Rellenar datos
    rows.forEach(m => {
      const fecha = new Date(m.fecha_hora);
      const localString = fecha.toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false });
      const dist = parseFloat(m.distancia_metros);
      const fuera = dist > parseInt(m.sede_radio, 10);
      
      worksheet.addRow({
        id: m.id,
        dni: m.usuario_dni,
        nombre: m.usuario_nombre,
        rol: m.usuario_rol,
        sede: m.sede_nombre,
        tipo: m.tipo_marcado,
        fecha_hora: localString,
        latitud: parseFloat(m.latitud_marcado),
        longitud: parseFloat(m.longitud_marcado),
        distancia: Math.round(dist * 100) / 100,
        rango: fuera ? 'FUERA DE RANGO' : 'DENTRO DE RANGO'
      });
    });

    // Estilos de filas de datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.font = { name: 'Segoe UI', family: 4, size: 10 };
        row.height = 20;

        row.getCell('id').alignment = { horizontal: 'center' };
        row.getCell('dni').alignment = { horizontal: 'center' };
        row.getCell('tipo').alignment = { horizontal: 'center' };
        row.getCell('fecha_hora').alignment = { horizontal: 'center' };
        row.getCell('rango').alignment = { horizontal: 'center' };
        row.getCell('latitud').alignment = { horizontal: 'right' };
        row.getCell('longitud').alignment = { horizontal: 'right' };
        row.getCell('distancia').alignment = { horizontal: 'right' };
        
        // Bordes finos
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            left: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
          };
        });

        // Color condicional para Entrada / Salida
        const tipoCell = row.getCell('tipo');
        if (tipoCell.value === 'ENTRADA') {
          tipoCell.font = { bold: true, color: { argb: '047857' } }; // Verde
          tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECFDF5' } };
        } else {
          tipoCell.font = { bold: true, color: { argb: 'B91C1C' } }; // Rojo
          tipoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF2F2' } };
        }

        // Color condicional para Rango
        const rangoCell = row.getCell('rango');
        if (rangoCell.value === 'FUERA DE RANGO') {
          rangoCell.font = { bold: true, color: { argb: 'D97706' } }; // Ambar
          rangoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEB' } };
        } else {
          rangoCell.font = { color: { argb: '047857' } }; // Verde
        }
      }
    });

    // Enviar directamente el stream de escritura a la respuesta Express (bajo consumo RAM)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_asistencia_${Date.now()}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error al exportar Excel:', error);
    return res.status(500).json({ error: 'Error al generar el reporte de Excel.' });
  }
};

// Exportacion a PDF formal y elegante usando Streams directos a la respuesta
exports.exportarPDF = async (req, res) => {
  try {
    const rows = await obtenerDatosFiltrados(req.query);

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_asistencia_sunafil_${Date.now()}.pdf`);
    
    // Conectar el documento directamente con la respuesta HTTP
    doc.pipe(res);

    // Cabecera formal
    doc.rect(30, 30, doc.page.width - 60, 60).fill('#1E3A8A');
    doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold').text('REPORTE OFICIAL DE CONTROL DE ASISTENCIA', 45, 42);
    doc.fontSize(8.5).font('Helvetica').text('Ministerio de Trabajo / SUNAFIL - Control e Inspección de Jornada Laboral', 45, 62);
    
    doc.text(`Generado: ${new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })} (America/Lima)`, doc.page.width - 270, 42, { width: 240, align: 'right' });
    doc.text(`Filtro Rango: ${req.query.rango ? req.query.rango.toUpperCase() : 'TODOS'}`, doc.page.width - 270, 56, { width: 240, align: 'right' });

    // Configuracion de Columnas de la Tabla
    let y = 110;
    const headers = ['Colaborador', 'DNI', 'Rol/Cargo', 'Sede Clínica', 'Marcado', 'Fecha y Hora (Lima)', 'Distancia', 'Estado GPS'];
    const colWidths = [150, 60, 110, 100, 60, 110, 50, 80];
    const colPositions = [];
    
    let currentX = 30;
    for (let i = 0; i < colWidths.length; i++) {
      colPositions.push(currentX);
      currentX += colWidths[i];
    }

    // Cabecera de la Tabla
    doc.rect(30, y, doc.page.width - 60, 22).fill('#3B82F6');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], colPositions[i] + 4, y + 7, { width: colWidths[i] - 8, align: i === 4 || i === 6 ? 'center' : 'left' });
    }
    y += 22;

    // Cuerpo de la Tabla
    doc.font('Helvetica').fontSize(8).fillColor('#1E293B');
    rows.forEach((m, idx) => {
      // Control de salto de pagina automatico para Landscape A4 (alto ~595px)
      if (y > 500) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        y = 40;

        // Redibujar Cabecera en la nueva pagina
        doc.rect(30, y, doc.page.width - 60, 22).fill('#3B82F6');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
        for (let i = 0; i < headers.length; i++) {
          doc.text(headers[i], colPositions[i] + 4, y + 7, { width: colWidths[i] - 8, align: i === 4 || i === 6 ? 'center' : 'left' });
        }
        y += 22;
        doc.font('Helvetica').fontSize(8).fillColor('#1E293B');
      }

      // Fila con fondo alternado
      if (idx % 2 === 0) {
        doc.rect(30, y, doc.page.width - 60, 20).fill('#F8FAFC');
      }

      // Linea divisoria inferior
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(30, y + 20).lineTo(doc.page.width - 30, y + 20).stroke();

      const fecha = new Date(m.fecha_hora);
      const localString = fecha.toLocaleString('es-PE', { timeZone: 'America/Lima', hour12: false });
      const dist = parseFloat(m.distancia_metros);
      const fuera = dist > parseInt(m.sede_radio, 10);

      // Escribir datos
      doc.fillColor('#0F172A').text(m.usuario_nombre, colPositions[0] + 4, y + 6, { width: colWidths[0] - 8, lineBreak: false });
      doc.text(m.usuario_dni, colPositions[1] + 4, y + 6, { width: colWidths[1] - 8, lineBreak: false });
      doc.text(m.usuario_rol, colPositions[2] + 4, y + 6, { width: colWidths[2] - 8, lineBreak: false });
      doc.text(m.sede_nombre, colPositions[3] + 4, y + 6, { width: colWidths[3] - 8, lineBreak: false });
      
      // Tipo Marcado
      if (m.tipo_marcado === 'ENTRADA') {
        doc.fillColor('#047857').font('Helvetica-Bold').text(m.tipo_marcado, colPositions[4] + 4, y + 6, { width: colWidths[4] - 8, align: 'center' });
      } else {
        const durStr = m.horas_trabajadas ? ` (${m.horas_trabajadas}h)` : '';
        doc.fillColor('#B91C1C').font('Helvetica-Bold').text(`${m.tipo_marcado}${durStr}`, colPositions[4] + 4, y + 6, { width: colWidths[4] - 8, align: 'center' });
      }
      doc.font('Helvetica').fillColor('#0F172A');

      doc.text(localString, colPositions[5] + 4, y + 6, { width: colWidths[5] - 8 });
      doc.text(`${Math.round(dist)} m`, colPositions[6] + 4, y + 6, { width: colWidths[6] - 8, align: 'center' });
      
      // Estado Rango
      if (fuera) {
        doc.fillColor('#D97706').font('Helvetica-Bold').text('FUERA SÉDE', colPositions[7] + 4, y + 6, { width: colWidths[7] - 8 });
      } else {
        doc.fillColor('#047857').text('DENTRO RANGO', colPositions[7] + 4, y + 6, { width: colWidths[7] - 8 });
      }
      doc.font('Helvetica').fillColor('#0F172A');

      y += 20;
    });

    // Seccion de Firmas de Auditoria (Validacion legal SUNAFIL)
    if (y > 450) {
      doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
      y = 40;
    }
    
    y += 35;
    doc.lineWidth(1).strokeColor('#64748B');
    doc.moveTo(60, y).lineTo(230, y).stroke();
    doc.moveTo(doc.page.width - 230, y).lineTo(doc.page.width - 60, y).stroke();

    doc.fontSize(8.5).fillColor('#475569');
    doc.text('Firma Encargado de Control', 60, y + 6, { width: 170, align: 'center' });
    doc.text('Firma Delegado de Auditoría', doc.page.width - 230, y + 6, { width: 170, align: 'center' });
    
    doc.fontSize(8).fillColor('#94A3B8');
    doc.text('Este reporte constituye una declaracion jurada de asistencia clinica. Modificaciones no autorizadas estan sancionadas por Ley.', 30, y + 35, { width: doc.page.width - 60, align: 'center' });

    // Finalizar y enviar archivo
    doc.end();

  } catch (error) {
    console.error('Error al exportar PDF:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error al generar el reporte de PDF.' });
    }
  }
};

// ==========================================
// FUNCIONES PURAS DE CÁLCULO ANALÍTICO
// (Compartidas entre modo Real DB y Mock)
// ==========================================

/**
 * Calcula el reporte analítico matricial a partir de marcaciones y ajustes.
 * @param {Array} marcaciones - Array con objetos { usuario_id, tipo_marcado, fecha_hora, ... }
 * @param {Array} ajustes - Array de ajustes_reporte para el periodo
 * @param {Array} usuarios - Array de usuarios (id, nombre, dni, rol)
 * @param {Array} sedes - Array de sedes
 * @param {number} mes - Mes (1-12)
 * @param {number} anio - Año
 * @param {number|null} sedeIdFilter - Filtro opcional por sede
 * @returns {Object} { usuarios: [...], diasEnPeriodo: N, totalesColumnas: {...} }
 */
function calcularReporteAnalitico(marcaciones, ajustes, usuarios, sedes, mes, anio, sedeIdFilter) {
  const diasEnMes = new Date(anio, mes, 0).getDate();
  
  // Filter marcaciones ONLY by Sede (if filtered), keeping the entire fetched date window for correct night shift pairing!
  const marcsFiltradas = marcaciones.filter(m => {
    const matchSede = sedeIdFilter ? (m.sede_id === sedeIdFilter) : true;
    return matchSede;
  });

  // Group by usuario_id
  const porUsuario = {};
  marcsFiltradas.forEach(m => {
    const uid = m.usuario_id;
    if (!porUsuario[uid]) porUsuario[uid] = [];
    porUsuario[uid].push(m);
  });

  const totalesColumnas = {};
  for (let d = 1; d <= diasEnMes; d++) { totalesColumnas[d] = 0; }
  totalesColumnas.totalAsi = 0;
  totalesColumnas.asisten_ad = 0;
  totalesColumnas.totalGC = 0;
  totalesColumnas.totalPuntos = 0;
  totalesColumnas.reten = 0;
  totalesColumnas.exclusi = 0;
  totalesColumnas.proc_val = 0;
  totalesColumnas.rne = 0;
  totalesColumnas.encargatu = 0;
  totalesColumnas.actividades = 0;
  totalesColumnas.vacaciones = 0;
  totalesColumnas.totalFinal = 0;

  const resultUsuarios = usuarios.map(user => {
    const marcasUser = porUsuario[user.id] || [];
    const sede = sedes.find(s => s.id === ((user.id - 1) % 4) + 1) || {};
    
    // 1. Sort all user's marcaciones chronologically
    const marcasOrdenadas = marcasUser.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    // 2. Pair them into complete shifts
    const turnos = [];
    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const diff = (new Date(next.fecha_hora) - new Date(current.fecha_hora)) / 3600000;
            turnos.push({
              entrada: current,
              salida: next,
              horas: diff > 0 ? diff : 0
            });
            i += 2;
            continue;
          }
        }
      }
      i++;
    }

    // 3. Impute hours to the day of the ENTRADA, only if the ENTRADA is in the target month/year
    const diasHoras = {};
    for (let d = 1; d <= diasEnMes; d++) {
      diasHoras[d] = 0;
    }
    let totalAsistencia = 0;

    turnos.forEach(t => {
      const dateEntrada = new Date(t.entrada.fecha_hora);
      if (dateEntrada.getMonth() + 1 === mes && dateEntrada.getFullYear() === anio) {
        const dia = dateEntrada.getDate();
        diasHoras[dia] = (diasHoras[dia] || 0) + t.horas;
        totalAsistencia += t.horas;
        totalesColumnas[dia] = (totalesColumnas[dia] || 0) + t.horas;
      }
    });

    // Round values
    for (let d = 1; d <= diasEnMes; d++) {
      diasHoras[d] = Math.round(diasHoras[d] * 100) / 100;
    }
    totalAsistencia = Math.round(totalAsistencia * 100) / 100;

    // Accumulate column totals
    totalesColumnas.totalAsi += totalAsistencia;

    return {
      id: user.id,
      nombre: user.nombre,
      dni: user.dni,
      rol: user.rol,
      sede_nombre: sede.nombre || '',
      diasHoras,
      totalAsistencia
    };
  });

  // Round column totals
  Object.keys(totalesColumnas).forEach(k => {
    totalesColumnas[k] = Math.round(totalesColumnas[k] * 100) / 100;
  });

  return {
    usuarios: resultUsuarios,
    diasEnPeriodo: diasEnMes,
    totalesColumnas
  };
}

/**
 * Calcula métricas del dashboard a partir de datos analíticos.
 */
function calcularDashboardMetricas(reporteAnalitico, marcaciones, sedes, mes, anio) {
  const { usuarios, diasEnPeriodo } = reporteAnalitico;

  // Leaderboard: top 10 by totalAsistencia DESC
  const leaderboard = [...usuarios]
    .sort((a, b) => b.totalAsistencia - a.totalAsistencia)
    .slice(0, 10)
    .map(u => ({ nombre: u.nombre, horas: u.totalAsistencia }));

  // Distribución de puntos (Fórmula crítica: Horas / 6)
  let alto = 0, medio = 0, base = 0, revision = 0;
  usuarios.forEach(u => {
    const totalPuntos = u.totalAsistencia / 6;
    if (totalPuntos > 25) alto++;
    else if (totalPuntos >= 15) medio++;
    else if (totalPuntos >= 5) base++;
    else revision++;
  });
  const distribucionPuntos = { alto, medio, base, revision };

  // Tendencia temporal: horas totales por día
  const tendenciaTemporal = [];
  for (let d = 1; d <= diasEnPeriodo; d++) {
    let horasTotalesDia = 0;
    usuarios.forEach(u => {
      horasTotalesDia += u.diasHoras[d] || 0;
    });
    tendenciaTemporal.push({ dia: d, horasTotales: Math.round(horasTotalesDia * 100) / 100 });
  }

  // Resumen por sedes
  const sedeMap = {};
  sedes.forEach(s => {
    sedeMap[s.id] = { sede: s.nombre, horasTotales: 0, puntos: 0, count: 0 };
  });

  // Group by user & clinic to pair their complete turns chronologically
  const porSedeUsuario = {};
  marcaciones.forEach(m => {
    const key = `${m.sede_id}_${m.usuario_id}`;
    if (!porSedeUsuario[key]) porSedeUsuario[key] = { sede_id: m.sede_id, marks: [] };
    porSedeUsuario[key].marks.push(m);
  });

  Object.values(porSedeUsuario).forEach(({ sede_id, marks }) => {
    const marcasOrdenadas = marks.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
    
    let horasUser = 0;
    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const diff = (new Date(next.fecha_hora) - new Date(current.fecha_hora)) / 3600000;
            if (diff > 0) {
              const dateEntrada = new Date(current.fecha_hora);
              if (dateEntrada.getMonth() + 1 === mes && dateEntrada.getFullYear() === anio) {
                horasUser += diff;
              }
            }
            i += 2;
            continue;
          }
        }
      }
      i++;
    }

    if (horasUser > 0 && sedeMap[sede_id]) {
      sedeMap[sede_id].horasTotales += horasUser;
      sedeMap[sede_id].count++;
    }
  });

  const resumenSedes = Object.values(sedeMap)
    .filter(s => !s.sede.includes('Alto Bellavista'))
    .map(s => {
      s.horasTotales = Math.round(s.horasTotales * 100) / 100;
      s.puntos = Math.round((s.horasTotales / 6) * 100) / 100;
      s.promedio = s.count > 0 ? Math.round((s.horasTotales / s.count) * 100) / 100 : 0;
      s.estado = s.promedio >= 8 ? 'Óptimo' : s.promedio >= 5 ? 'Aceptable' : 'Bajo';
      return s;
    });

  // 1. Ratio de Alertas "Fuera de Rango" (Gráfico de líneas)
  const ratioFueraRango = [];
  for (let d = 1; d <= diasEnPeriodo; d++) {
    const marcsDia = marcaciones.filter(m => {
      const date = new Date(m.fecha_hora);
      return date.getDate() === d && date.getMonth() + 1 === mes && date.getFullYear() === anio;
    });

    const total = marcsDia.length;
    if (total > 0) {
      let fueraCount = 0;
      marcsDia.forEach(m => {
        const Sede = sedes.find(s => s.id === m.sede_id) || {};
        const radio = parseInt(Sede.radio_permitido_metros || 200, 10);
        if (parseFloat(m.distancia_metros) > radio) {
          fueraCount++;
        }
      });
      const ratio = Math.round((fueraCount / total) * 10000) / 100;
      ratioFueraRango.push({ dia: d, ratio, total, fueraCount });
    } else {
      ratioFueraRango.push({ dia: d, ratio: 0, total: 0, fueraCount: 0 });
    }
  }

  // 2. Densidad de Turnos Nocturnos vs. Diurnos (Columnas apiladas)
  const turnosDiarios = {};
  for (let d = 1; d <= diasEnPeriodo; d++) {
    turnosDiarios[d] = { diurnos: 0, nocturnos: 0 };
  }

  const porUsuarioP = {};
  marcaciones.forEach(m => {
    const uid = m.usuario_id;
    if (!porUsuarioP[uid]) porUsuarioP[uid] = [];
    porUsuarioP[uid].push(m);
  });

  Object.values(porUsuarioP).forEach(marks => {
    const marcasOrdenadas = marks.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const dateEntrada = new Date(current.fecha_hora);
            if (dateEntrada.getMonth() + 1 === mes && dateEntrada.getFullYear() === anio) {
              const dia = dateEntrada.getDate();
              const hh = dateEntrada.getHours();
              const crossesMidnight = new Date(next.fecha_hora).getDate() !== dateEntrada.getDate();
              
              const isNocturno = hh >= 18 || crossesMidnight;
              
              if (turnosDiarios[dia]) {
                if (isNocturno) {
                  turnosDiarios[dia].nocturnos++;
                } else {
                  turnosDiarios[dia].diurnos++;
                }
              }
            }
            i += 2;
            continue;
          }
        }
      }
      i++;
    }
  });

  const densidadTurnos = [];
  for (let d = 1; d <= diasEnPeriodo; d++) {
    densidadTurnos.push({
      dia: d,
      diurnos: turnosDiarios[d].diurnos,
      nocturnos: turnosDiarios[d].nocturnos
    });
  }

  return { leaderboard, distribucionPuntos, tendenciaTemporal, resumenSedes, ratioFueraRango, densidadTurnos };
}

// ==========================================
// ENDPOINTS ANALÍTICOS
// ==========================================

// A. Reporte Analítico Matricial
exports.obtenerReporteAnalitico = async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes, 10) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    // Get all marcaciones for the month, expanding by 1 day forward to capture night shifts crossing the month boundary
    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 1, 23, 59, 59, 999);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora, m.latitud_marcado, m.longitud_marcado, m.foto_path, m.distancia_metros
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const ajustesRes = await db.query(
      'SELECT * FROM ajustes_reporte WHERE mes = $1 AND anio = $2',
      [mes, anio]
    );
    const ajustes = ajustesRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const sedesRes = await db.query('SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC');
    const sedes = sedesRes.rows;

    const resultado = calcularReporteAnalitico(marcaciones, ajustes, usuarios, sedes, mes, anio, sedeIdFilter);
    return res.json(resultado);
  } catch (error) {
    console.error('Error al obtener reporte analítico:', error);
    return res.status(500).json({ error: 'Error al generar el reporte analítico.' });
  }
};

// Función para obtener fecha/hora actual en America/Lima (UTC-5 determinista)
function getLimaNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (5 * 3600000));
}

// Calcular dashboard y métricas completas adaptadas al rango de tiempo dinámico
function calcularDashboardMetricasCompleto(rangoStart, rangoEnd, marcaciones, ajustes, usuarios, sedes, mes, anio, sedeIdFilter, rango) {
  // 1. Filtrar marcaciones por sede (si hay filtro)
  const marcsFiltradas = marcaciones.filter(m => {
    const matchSede = sedeIdFilter ? (m.sede_id === sedeIdFilter) : true;
    return matchSede;
  });

  // 2. Agrupar por usuario
  const porUsuario = {};
  marcsFiltradas.forEach(m => {
    const uid = m.usuario_id;
    if (!porUsuario[uid]) porUsuario[uid] = [];
    porUsuario[uid].push(m);
  });

  // 3. Emparejar turnos y calcular horas totales por usuario dentro del rango estricto [rangoStart, rangoEnd]
  const usuariosConHoras = usuarios.map(u => {
    const marcasUser = porUsuario[u.id] || [];
    const marcasOrdenadas = marcasUser.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    let horasAcumuladas = 0;
    const turnos = [];
    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const diff = (new Date(next.fecha_hora) - new Date(current.fecha_hora)) / 3600000;
            if (diff > 0) {
              const dateEntrada = new Date(current.fecha_hora);
              // Verificar si la fecha de ENTRADA está dentro del rango estricto
              if (dateEntrada >= rangoStart && dateEntrada <= rangoEnd) {
                horasAcumuladas += diff;
                turnos.push({ entrada: current, salida: next, horas: diff });
              }
            }
            i += 2;
            continue;
          }
        }
      }
      i++;
    }

    return {
      ...u,
      horasAcumuladas: Math.round(horasAcumuladas * 100) / 100,
      turnos
    };
  });

  // 4. Leaderboard (Top 10)
  const leaderboard = [...usuariosConHoras]
    .filter(u => u.rol && u.rol.toLowerCase().startsWith('medico'))
    .sort((a, b) => b.horasAcumuladas - a.horasAcumuladas)
    .slice(0, 10)
    .map(u => ({ nombre: u.nombre, horas: u.horasAcumuladas }));

  // 5. Distribución de Puntos (Horas / 6)
  let alto = 0, medio = 0, base = 0, revision = 0;
  usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
    const totalPuntos = u.horasAcumuladas / 6;
    if (totalPuntos > 25) alto++;
    else if (totalPuntos >= 15) medio++;
    else if (totalPuntos >= 5) base++;
    else revision++;
  });
  const distribucionPuntos = { alto, medio, base, revision };

  // 6. Resumen por Sedes
  const sedeMap = {};
  sedes.forEach(s => {
    if (!s.nombre.includes('Alto Bellavista')) {
      sedeMap[s.id] = { sede: s.nombre, horasTotales: 0, puntos: 0, userIds: new Set() };
    }
  });

  usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
    u.turnos.forEach(t => {
      const sedeId = t.entrada.sede_id;
      if (sedeMap[sedeId]) {
        sedeMap[sedeId].horasTotales += t.horas;
        sedeMap[sedeId].userIds.add(u.id); // Guardamos la identidad única del médico
      }
    });
  });

  const resumenSedes = Object.values(sedeMap).map(s => {
    s.horasTotales = Math.round(s.horasTotales * 100) / 100;
    s.puntos = Math.round((s.horasTotales / 6) * 100) / 100;
    s.count = s.userIds.size; // Total de colaboradores únicos en esta sede
    s.promedio = s.count > 0 ? Math.round((s.horasTotales / s.count) * 100) / 100 : 0;
    s.estado = s.promedio >= 8 ? 'Óptimo' : s.promedio >= 5 ? 'Aceptable' : 'Bajo';
    delete s.userIds; // Limpiamos la estructura interna
    return s;
  });

  // 7. Tendencia temporal adaptada al rango
  const tendenciaTemporal = [];
  const turnosDiarios = {}; // Turnos diurnos vs nocturnos
  const ratioFueraRango = []; // Alertas GPS

  if (rango === 'dia') {
    // 1 único punto para hoy
    let horasTotalesDia = 0;
    usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => { horasTotalesDia += u.horasAcumuladas; });
    tendenciaTemporal.push({ dia: 'Hoy', horasTotales: Math.round(horasTotalesDia * 100) / 100 });

    // Turnos
    let diurnos = 0, nocturnos = 0;
    usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
      u.turnos.forEach(t => {
        const hrs = new Date(t.entrada.fecha_hora).getHours();
        if (hrs >= 19 || hrs < 7) nocturnos++;
        else diurnos++;
      });
    });
    turnosDiarios['Hoy'] = { diurnos, nocturnos };

    // Alertas GPS
    let total = 0, fueraCount = 0;
    marcsFiltradas.forEach(m => {
      const date = new Date(m.fecha_hora);
      if (date >= rangoStart && date <= rangoEnd) {
        total++;
        const Sede = sedes.find(s => s.id === m.sede_id) || {};
        const radio = parseInt(Sede.radio_permitido_metros || 200, 10);
        if (parseFloat(m.distancia_metros) > radio) fueraCount++;
      }
    });
    ratioFueraRango.push({ dia: 'Hoy', ratio: total > 0 ? Math.round((fueraCount / total) * 10000) / 100 : 0, total, fueraCount });

  } else if (rango === 'semana') {
    // 7 días de la semana actual
    const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    for (let d = 0; d < 7; d++) {
      const currentDayDate = new Date(rangoStart);
      currentDayDate.setDate(rangoStart.getDate() + d);
      const startOfDay = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(currentDayDate.getFullYear(), currentDayDate.getMonth(), currentDayDate.getDate(), 23, 59, 59, 999);

      let horasTotalesDia = 0;
      let diurnos = 0, nocturnos = 0;

      usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
        u.turnos.forEach(t => {
          const de = new Date(t.entrada.fecha_hora);
          if (de >= startOfDay && de <= endOfDay) {
            horasTotalesDia += t.horas;
            const hrs = de.getHours();
            if (hrs >= 19 || hrs < 7) nocturnos++;
            else diurnos++;
          }
        });
      });

      const label = diasSemana[d];
      tendenciaTemporal.push({ dia: label, horasTotales: Math.round(horasTotalesDia * 100) / 100 });
      turnosDiarios[label] = { diurnos, nocturnos };

      // Alertas GPS
      let total = 0, fueraCount = 0;
      marcsFiltradas.forEach(m => {
        const date = new Date(m.fecha_hora);
        if (date >= startOfDay && date <= endOfDay) {
          total++;
          const Sede = sedes.find(s => s.id === m.sede_id) || {};
          const radio = parseInt(Sede.radio_permitido_metros || 200, 10);
          if (parseFloat(m.distancia_metros) > radio) fueraCount++;
        }
      });
      ratioFueraRango.push({ dia: label, ratio: total > 0 ? Math.round((fueraCount / total) * 10000) / 100 : 0, total, fueraCount });
    }

  } else if (rango === 'anio') {
    // 12 meses del año actual
    const mesesAnio = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let m = 0; m < 12; m++) {
      const startOfMonth = new Date(rangoStart.getFullYear(), m, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(rangoStart.getFullYear(), m + 1, 0, 23, 59, 59, 999);

      let horasTotalesMes = 0;
      let diurnos = 0, nocturnos = 0;

      usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
        u.turnos.forEach(t => {
          const de = new Date(t.entrada.fecha_hora);
          if (de >= startOfMonth && de <= endOfMonth) {
            horasTotalesMes += t.horas;
            const hrs = de.getHours();
            if (hrs >= 19 || hrs < 7) nocturnos++;
            else diurnos++;
          }
        });
      });

      const label = mesesAnio[m];
      tendenciaTemporal.push({ dia: label, horasTotales: Math.round(horasTotalesMes * 100) / 100 });
      turnosDiarios[label] = { diurnos, nocturnos };

      // Alertas GPS
      let total = 0, fueraCount = 0;
      marcsFiltradas.forEach(m => {
        const date = new Date(m.fecha_hora);
        if (date >= startOfMonth && date <= endOfMonth) {
          total++;
          const Sede = sedes.find(s => s.id === m.sede_id) || {};
          const radio = parseInt(Sede.radio_permitido_metros || 200, 10);
          if (parseFloat(m.distancia_metros) > radio) fueraCount++;
        }
      });
      ratioFueraRango.push({ dia: label, ratio: total > 0 ? Math.round((fueraCount / total) * 10000) / 100 : 0, total, fueraCount });
    }

  } else {
    // Mes actual o por defecto (1 a diasEnMes)
    const diasEnPeriodo = new Date(anio, mes, 0).getDate();
    for (let d = 1; d <= diasEnPeriodo; d++) {
      const startOfDay = new Date(anio, mes - 1, d, 0, 0, 0, 0);
      const endOfDay = new Date(anio, mes - 1, d, 23, 59, 59, 999);

      let horasTotalesDia = 0;
      let diurnos = 0, nocturnos = 0;

      usuariosConHoras.filter(u => u.rol && u.rol.toLowerCase().startsWith('medico')).forEach(u => {
        u.turnos.forEach(t => {
          const de = new Date(t.entrada.fecha_hora);
          if (de >= startOfDay && de <= endOfDay) {
            horasTotalesDia += t.horas;
            const hrs = de.getHours();
            if (hrs >= 19 || hrs < 7) nocturnos++;
            else diurnos++;
          }
        });
      });

      tendenciaTemporal.push({ dia: d, horasTotales: Math.round(horasTotalesDia * 100) / 100 });
      turnosDiarios[d] = { diurnos, nocturnos };

      // Alertas GPS
      let total = 0, fueraCount = 0;
      marcsFiltradas.forEach(m => {
        const date = new Date(m.fecha_hora);
        if (date >= startOfDay && date <= endOfDay) {
          total++;
          const Sede = sedes.find(s => s.id === m.sede_id) || {};
          const radio = parseInt(Sede.radio_permitido_metros || 200, 10);
          if (parseFloat(m.distancia_metros) > radio) fueraCount++;
        }
      });
      ratioFueraRango.push({ dia: d, ratio: total > 0 ? Math.round((fueraCount / total) * 10000) / 100 : 0, total, fueraCount });
    }
  }

  // 8. Convertir turnosDiarios a formato Recharts densidadTurnos
  const densidadTurnos = Object.keys(turnosDiarios).map(key => ({
    dia: key,
    diurnos: turnosDiarios[key].diurnos,
    nocturnos: turnosDiarios[key].nocturnos
  }));

  return {
    leaderboard,
    distribucionPuntos,
    resumenSedes,
    colaboradoresUnicos: usuariosConHoras.filter(u => u.turnos.length > 0 && u.rol && u.rol.toLowerCase().startsWith('medico')).length,
    tendenciaTemporal,
    densidadTurnos,
    ratioFueraRango
  };
}

// Local helper to parse ISO week strings like "YYYY-Www" into Monday/Sunday Date objects
function getDatesOfISOWeek(weekStr) {
  if (!weekStr) return null;
  const parts = weekStr.split('-W');
  if (parts.length !== 2) return null;
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(week)) return null;

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() + diffToMonday);

  const targetMonday = new Date(mondayOfWeek1);
  targetMonday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetMonday.getDate() + 6);

  return {
    monday: targetMonday,
    sunday: targetSunday
  };
}

// B. Dashboard Métricas
exports.obtenerDashboardMetricas = async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes, 10) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;
    const rango = req.query.rango; // 'dia', 'semana', 'mes', 'anio'

    let rangoStart, rangoEnd;
    let mesFiltro = mes;
    let anioFiltro = anio;

    if (rango) {
      const limaNow = getLimaNow();
      const isPeriodoActual = (mes === (limaNow.getMonth() + 1)) && (anio === limaNow.getFullYear());

      if (rango === 'dia') {
        let targetYear = anio;
        let targetMonth = mes;
        let targetDay = isPeriodoActual ? limaNow.getDate() : 1;

        if (req.query.selectedDate) {
          const parts = req.query.selectedDate.split('-');
          if (parts.length === 3) {
            targetYear = parseInt(parts[0], 10);
            targetMonth = parseInt(parts[1], 10);
            targetDay = parseInt(parts[2], 10);
          }
        }
        rangoStart = new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0, 0);
        rangoEnd = new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 999);
        mesFiltro = targetMonth;
        anioFiltro = targetYear;
      } else if (rango === 'semana') {
        let baseMonday, baseSunday;
        let parsed = null;
        if (req.query.selectedWeek) {
          parsed = getDatesOfISOWeek(req.query.selectedWeek);
        }
        
        if (parsed) {
          baseMonday = parsed.monday;
          baseSunday = parsed.sunday;
        } else {
          const baseDate = isPeriodoActual ? limaNow : new Date(anio, mes - 1, 1);
          const dayOfWeek = baseDate.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const monday = new Date(baseDate);
          monday.setDate(baseDate.getDate() + diffToMonday);
          baseMonday = monday;
          baseSunday = new Date(monday);
          baseSunday.setDate(monday.getDate() + 6);
        }
        
        rangoStart = new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate(), 0, 0, 0, 0);
        rangoEnd = new Date(baseSunday.getFullYear(), baseSunday.getMonth(), baseSunday.getDate(), 23, 59, 59, 999);
        
        mesFiltro = baseMonday.getMonth() + 1;
        anioFiltro = baseMonday.getFullYear();
      } else if (rango === 'mes') {
        rangoStart = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
        rangoEnd = new Date(anio, mes, 0, 23, 59, 59, 999);
        mesFiltro = mes;
        anioFiltro = anio;
      } else if (rango === 'anio') {
        rangoStart = new Date(anio, 0, 1, 0, 0, 0, 0);
        rangoEnd = new Date(anio, 11, 31, 23, 59, 59, 999);
        mesFiltro = mes;
        anioFiltro = anio;
      }
    } else {
      rangoStart = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
      rangoEnd = new Date(anio, mes, 0, 23, 59, 59, 999);
    }

    // Ventana extendida para turnos nocturnos (+- 24 horas)
    const startDate = new Date(rangoStart.getTime() - 24 * 3600000);
    const endDate = new Date(rangoEnd.getTime() + 24 * 3600000);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora, m.latitud_marcado, m.longitud_marcado, m.foto_path, m.distancia_metros
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const ajustesRes = await db.query(
      'SELECT * FROM ajustes_reporte WHERE mes = $1 AND anio = $2',
      [mesFiltro, anioFiltro]
    );
    const ajustes = ajustesRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const sedesRes = await db.query('SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC');
    const sedes = sedesRes.rows;

    // Calcular dashboard y métricas completas basándose en el rango estricto
    const dashboard = calcularDashboardMetricasCompleto(rangoStart, rangoEnd, marcaciones, ajustes, usuarios, sedes, mesFiltro, anioFiltro, sedeIdFilter, rango);
    
    // Inyectar el rango de fechas calculado
    dashboard.rangoStart = rangoStart.toISOString();
    dashboard.rangoEnd = rangoEnd.toISOString();

    return res.json(dashboard);
  } catch (error) {
    console.error('Error al obtener dashboard métricas:', error);
    return res.status(500).json({ error: 'Error al generar las métricas del dashboard.' });
  }
};

// C. Guardar Ajustes del Reporte (Upsert)
exports.guardarAjustesReporte = async (req, res) => {
  try {
    const { usuario_id, mes, anio, asisten_ad, reten, exclusi, proc_val, rne, encargatu, actividades, vacaciones } = req.body;

    if (!usuario_id || !mes || !anio) {
      return res.status(400).json({ error: 'usuario_id, mes y anio son obligatorios.' });
    }

    const uid = parseInt(usuario_id, 10);
    const m = parseInt(mes, 10);
    const a = parseInt(anio, 10);

    const queryText = `
      INSERT INTO ajustes_reporte (usuario_id, mes, anio, asisten_ad, reten, exclusi, proc_val, rne, encargatu, actividades, vacaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (usuario_id, mes, anio)
      DO UPDATE SET
        asisten_ad = EXCLUDED.asisten_ad,
        reten = EXCLUDED.reten,
        exclusi = EXCLUDED.exclusi,
        proc_val = EXCLUDED.proc_val,
        rne = EXCLUDED.rne,
        encargatu = EXCLUDED.encargatu,
        actividades = EXCLUDED.actividades,
        vacaciones = EXCLUDED.vacaciones
      RETURNING *
    `;

    const result = await db.query(queryText, [
      uid, m, a,
      parseFloat(asisten_ad) || 0,
      parseFloat(reten) || 0,
      parseFloat(exclusi) || 0,
      parseFloat(proc_val) || 0,
      parseFloat(rne) || 0,
      parseFloat(encargatu) || 0,
      parseFloat(actividades) || 0,
      parseFloat(vacaciones) || 0
    ]);

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error al guardar ajustes del reporte:', error);
    return res.status(500).json({ error: 'Error al guardar los ajustes del reporte.' });
  }
};

// D. Exportar Reporte Matricial a Excel
exports.exportarReporteMatricial = async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes, 10) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 1, 23, 59, 59, 999);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const ajustesRes = await db.query('SELECT * FROM ajustes_reporte WHERE mes = $1 AND anio = $2', [mes, anio]);
    const ajustes = ajustesRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const sedesRes = await db.query('SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC');
    const sedes = sedesRes.rows;

    const reporte = calcularReporteAnalitico(marcaciones, ajustes, usuarios, sedes, mes, anio, sedeIdFilter);
    const { usuarios: dataUsuarios, diasEnPeriodo, totalesColumnas } = reporte;

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const nombreMes = meses[mes - 1];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Reporte ${nombreMes} ${anio}`);

    // Title row
    const titleRow = worksheet.addRow([`REPORTE MATRICIAL DE ASISTENCIA - ${nombreMes.toUpperCase()} ${anio}`]);
    titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    titleRow.height = 30;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, diasEnPeriodo + 2);

    // Build column headers with formulas explicitly labeled
    const headers = ['ASISTENCIA'];
    for (let d = 1; d <= diasEnPeriodo; d++) { headers.push(d.toString()); }
    headers.push('TOTAL ASI (Suma)');

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    // Set column widths
    worksheet.getColumn(1).width = 28; // Nombre
    for (let d = 1; d <= diasEnPeriodo; d++) { worksheet.getColumn(d + 1).width = 6; }
    worksheet.getColumn(diasEnPeriodo + 2).width = 18; // Total

    // Data rows
    dataUsuarios.forEach(user => {
      const rowData = [user.nombre];
      for (let d = 1; d <= diasEnPeriodo; d++) {
        rowData.push(user.diasHoras[d] || 0);
      }
      rowData.push(user.totalAsistencia);

      const dataRow = worksheet.addRow(rowData);
      dataRow.font = { name: 'Segoe UI', size: 9 };
      dataRow.height = 18;
      dataRow.alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(1).alignment = { horizontal: 'left' };

      // Conditional formatting: green for hours > 0, red for 0
      for (let d = 1; d <= diasEnPeriodo; d++) {
        const cell = dataRow.getCell(d + 1);
        const val = user.diasHoras[d] || 0;
        if (val > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'ECFDF5' } };
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: '047857' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF2F2' } };
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'B91C1C' } };
        }
      }

      // Borders
      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      });
    });

    // Footer/SUM row
    const footerData = ['TOTALES'];
    for (let d = 1; d <= diasEnPeriodo; d++) {
      footerData.push(totalesColumnas[d] || 0);
    }
    footerData.push(totalesColumnas.totalAsi);

    const footerRow = worksheet.addRow(footerData);
    footerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    footerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
    footerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    footerRow.height = 22;
    footerRow.getCell(1).alignment = { horizontal: 'left' };

    // Send response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar reporte matricial:', error);
    return res.status(500).json({ error: 'Error al generar el reporte matricial en Excel.' });
  }
};

// ==========================================
// NUEVOS REPORTES (REPORTE ANUAL & DETALLE TURNOS)
// ==========================================

// Helper: Calcular Reporte Anual
function calcularReporteAnualInterno(marcaciones, usuarios, anio, sedeIdFilter) {
  const marcsFiltradas = marcaciones.filter(m => {
    return sedeIdFilter ? (m.sede_id === sedeIdFilter) : true;
  });

  const porUsuario = {};
  marcsFiltradas.forEach(m => {
    const uid = m.usuario_id;
    if (!porUsuario[uid]) porUsuario[uid] = [];
    porUsuario[uid].push(m);
  });

  return usuarios.map(user => {
    const marcasUser = porUsuario[user.id] || [];
    const marcasOrdenadas = marcasUser.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    const turnos = [];
    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const diff = (new Date(next.fecha_hora) - new Date(current.fecha_hora)) / 3600000;
            turnos.push({
              entrada: current,
              salida: next,
              horas: diff > 0 ? diff : 0
            });
            i += 2;
            continue;
          }
        }
      }
      i++;
    }

    const meses = {};
    for (let m = 1; m <= 12; m++) {
      meses[m] = 0;
    }
    let totalAnual = 0;

    turnos.forEach(t => {
      const dateEntrada = new Date(t.entrada.fecha_hora);
      if (dateEntrada.getFullYear() === anio) {
        const mes = dateEntrada.getMonth() + 1;
        meses[mes] = (meses[mes] || 0) + t.horas;
        totalAnual += t.horas;
      }
    });

    for (let m = 1; m <= 12; m++) {
      meses[m] = Math.round(meses[m] * 100) / 100;
    }
    totalAnual = Math.round(totalAnual * 100) / 100;

    return {
      id: user.id,
      nombre: user.nombre,
      dni: user.dni,
      rol: user.rol,
      meses,
      totalAnual
    };
  });
}

// Helper: Calcular Detalle Turnos
function calcularDetalleTurnosInterno(marcaciones, usuarios, sedes, mes, anio, SedeIdFilter) {
  const porUsuario = {};
  marcaciones.forEach(m => {
    const uid = m.usuario_id;
    if (!porUsuario[uid]) porUsuario[uid] = [];
    porUsuario[uid].push(m);
  });

  const result = [];

  usuarios.forEach(user => {
    const marcasUser = porUsuario[user.id] || [];
    const marcasOrdenadas = marcasUser.sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

    let i = 0;
    while (i < marcasOrdenadas.length) {
      const current = marcasOrdenadas[i];
      if (current.tipo_marcado === 'ENTRADA') {
        if (i + 1 < marcasOrdenadas.length) {
          const next = marcasOrdenadas[i + 1];
          if (next.tipo_marcado === 'SALIDA') {
            const dateEntrada = new Date(current.fecha_hora);
            const dateSalida = new Date(next.fecha_hora);

            const isTargetPeriod = (dateEntrada.getMonth() + 1 === mes) && (dateEntrada.getFullYear() === anio);

            if (isTargetPeriod) {
              const sede = sedes.find(s => s.id === current.sede_id) || {};
              const matchSedeName = !sede.nombre || !sede.nombre.includes('Alto Bellavista');
              const matchSedeFilter = SedeIdFilter ? (current.sede_id === SedeIdFilter) : true;

              if (matchSedeName && matchSedeFilter) {
                const diffMs = dateSalida - dateEntrada;
                const decimalHrs = diffMs > 0 ? (diffMs / 3600000) : 0;
                
                const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                
                const formatTime = (val) => String(val).padStart(2, '0');
                const durationString = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;

                const puntos = Math.round((decimalHrs / 6) * 100) / 100;

                result.push({
                  fecha: dateEntrada.toISOString().split('T')[0],
                  anestesiologo: user.nombre,
                  ingreso: dateEntrada.toLocaleTimeString('es-PE', { hour12: false }),
                  salida: dateSalida.toLocaleTimeString('es-PE', { hour12: false }),
                  horas_trabajadas: durationString,
                  puntos: puntos,
                  decimal_horas: Math.round(decimalHrs * 100) / 100
                });
              }
            }
            i += 2;
            continue;
          }
        }
      }
      i++;
    }
  });

  return result.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.anestesiologo.localeCompare(b.anestesiologo));
}

// 1. GET /api/asistencia/reporte-anual
exports.obtenerReporteAnual = async (req, res) => {
  try {
    const now = new Date();
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    const startDate = new Date(anio, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(anio, 11, 31, 23, 59, 59, 999);
    endDate.setDate(endDate.getDate() + 1);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const reporte = calcularReporteAnualInterno(marcaciones, usuarios, anio, sedeIdFilter);
    return res.json(reporte);
  } catch (error) {
    console.error('Error al obtener reporte anual:', error);
    return res.status(500).json({ error: 'Error al generar el reporte anual.' });
  }
};

// 2. GET /api/asistencia/exportar/matricial-anual
exports.exportarReporteMatricialAnual = async (req, res) => {
  try {
    const now = new Date();
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    const startDate = new Date(anio, 0, 1, 0, 0, 0, 0);
    const endDate = new Date(anio, 11, 31, 23, 59, 59, 999);
    endDate.setDate(endDate.getDate() + 1);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const dataUsuarios = calcularReporteAnualInterno(marcaciones, usuarios, anio, sedeIdFilter);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Consolidado Anual ${anio}`);

    const titleRow = worksheet.addRow([`REPORTE CONSOLIDADO ANUAL - AÑO ${anio}`]);
    titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    titleRow.height = 30;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, 14);

    const headers = [
      'COLABORADOR',
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
      'TOTAL ANUAL'
    ];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    worksheet.getColumn(1).width = 28;
    for (let col = 2; col <= 13; col++) {
      worksheet.getColumn(col).width = 12;
    }
    worksheet.getColumn(14).width = 18;

    const totalMeses = {};
    for (let m = 1; m <= 12; m++) { totalMeses[m] = 0; }
    let granTotal = 0;

    dataUsuarios.forEach(user => {
      const rowData = [user.nombre];
      for (let m = 1; m <= 12; m++) {
        const val = user.meses[m] || 0;
        rowData.push(val);
        totalMeses[m] += val;
      }
      rowData.push(user.totalAnual);
      granTotal += user.totalAnual;

      const dataRow = worksheet.addRow(rowData);
      dataRow.font = { name: 'Segoe UI', size: 9 };
      dataRow.height = 18;
      dataRow.alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(1).alignment = { horizontal: 'left' };

      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      });
    });

    const footerData = ['TOTALES'];
    for (let m = 1; m <= 12; m++) {
      footerData.push(Math.round(totalMeses[m] * 100) / 100);
    }
    footerData.push(Math.round(granTotal * 100) / 100);

    const footerRow = worksheet.addRow(footerData);
    footerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    footerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
    footerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    footerRow.height = 22;
    footerRow.getCell(1).alignment = { horizontal: 'left' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_anual_${anio}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar reporte anual:', error);
    return res.status(500).json({ error: 'Error al generar el reporte anual en Excel.' });
  }
};

// 3. GET /api/asistencia/reporte-detalle-turnos
exports.obtenerReporteDetalleTurnos = async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes, 10) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 1, 23, 59, 59, 999);
    endDate.setDate(endDate.getDate() + 1);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const sedesRes = await db.query('SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC');
    const sedes = sedesRes.rows;

    const turnosDetallados = calcularDetalleTurnosInterno(marcaciones, usuarios, sedes, mes, anio, sedeIdFilter);
    return res.json(turnosDetallados);
  } catch (error) {
    console.error('Error al obtener detalle de turnos:', error);
    return res.status(500).json({ error: 'Error al generar el reporte de detalle de turnos.' });
  }
};

// 4. GET /api/asistencia/exportar/detalle-turnos
exports.exportarReporteDetalleTurnos = async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes, 10) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio, 10) || now.getFullYear();
    const sedeIdFilter = req.query.sede_id ? parseInt(req.query.sede_id, 10) : null;

    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 1, 23, 59, 59, 999);
    endDate.setDate(endDate.getDate() + 1);

    const marcsRes = await db.query(
      `SELECT m.id, m.usuario_id, m.sede_id, m.tipo_marcado, m.fecha_hora
       FROM marcaciones m 
       JOIN sedes s ON m.sede_id = s.id
       WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2 AND s.nombre NOT LIKE '%Alto Bellavista%'`,
      [startDate, endDate]
    );
    const marcaciones = marcsRes.rows;

    const usersRes = await db.query('SELECT id, dni, nombre, rol, status FROM usuarios ORDER BY nombre ASC');
    const usuarios = usersRes.rows;

    const sedesRes = await db.query('SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC');
    const sedes = sedesRes.rows;

    const turnosDetallados = calcularDetalleTurnosInterno(marcaciones, usuarios, sedes, mes, anio, sedeIdFilter);

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const nombreMes = meses[mes - 1];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Detalle Turnos ${nombreMes}`);

    const titleRow = worksheet.addRow([`REPORTE DETALLADO POR TURNO - ${nombreMes.toUpperCase()} ${anio}`]);
    titleRow.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    titleRow.height = 30;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells(1, 1, 1, 6);

    const headers = [
      'FECHA',
      'ANESTESIÓLOGO',
      'INGRESO',
      'SALIDA',
      'HORAS TRABAJADAS',
      'PUNTOS (Horas/6)'
    ];
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 28;
    worksheet.getColumn(3).width = 15;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 20;
    worksheet.getColumn(6).width = 20;

    let totalHorasDecimales = 0;
    let totalPuntos = 0;

    turnosDetallados.forEach(turno => {
      totalHorasDecimales += turno.decimal_horas;
      totalPuntos += turno.puntos;

      const rowData = [
        turno.fecha,
        turno.anestesiologo,
        turno.ingreso,
        turno.salida,
        turno.horas_trabajadas,
        turno.puntos
      ];

      const dataRow = worksheet.addRow(rowData);
      dataRow.font = { name: 'Segoe UI', size: 9 };
      dataRow.height = 18;
      dataRow.alignment = { vertical: 'middle', horizontal: 'center' };
      dataRow.getCell(2).alignment = { horizontal: 'left' };

      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };
      });
    });

    const formatTime = (val) => String(val).padStart(2, '0');
    const totalSeconds = Math.max(0, Math.floor(totalHorasDecimales * 3600));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const totalHorasString = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;

    const footerData = [
      'TOTALES',
      '',
      '',
      '',
      totalHorasString,
      Math.round(totalPuntos * 100) / 100
    ];

    const footerRow = worksheet.addRow(footerData);
    footerRow.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    footerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '3B82F6' } };
    footerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    footerRow.height = 22;
    footerRow.getCell(1).alignment = { horizontal: 'left' };

    worksheet.mergeCells(footerRow.number, 1, footerRow.number, 4);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=detalle_turnos_${nombreMes.toLowerCase()}_${anio}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error al exportar detalle de turnos:', error);
    return res.status(500).json({ error: 'Error al generar el reporte detallado en Excel.' });
  }
};
