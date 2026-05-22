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
        radio_permitido: sede.radio_permitido_metros
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
      'SELECT id, nombre, latitud, longitud, radio_permitido_metros FROM sedes ORDER BY nombre ASC'
    );
    return res.json(sedesRes.rows);
  } catch (error) {
    console.error('Error al obtener sedes:', error);
    return res.status(500).json({ error: 'Error al obtener el listado de sedes.' });
  }
};

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
      WHERE 1=1
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
    return res.json(historialRes.rows);
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
    WHERE 1=1
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
  return res.rows;
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
        doc.fillColor('#B91C1C').font('Helvetica-Bold').text(m.tipo_marcado, colPositions[4] + 4, y + 6, { width: colWidths[4] - 8, align: 'center' });
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
