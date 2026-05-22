const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const asistenciaController = require('./controllers/asistencia');
const authController = require('./controllers/auth');

// Configuración de Multer para almacenar fotos en el sistema de archivos del VPS
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Ruta física en el servidor: backend/storage/fotos/YYYY/MM
    const dir = path.join(__dirname, '../storage/fotos', `${year}`, `${month}`);
    
    // Crear directorios de forma recursiva si no existen
    fs.mkdirSync(dir, { recursive: true });
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generar un nombre único y limpio para la foto: foto_user_[userId]_[TIMESTAMP].jpg
    const userId = req.body.usuario_id || req.body.dni || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `foto_user_${userId}_${timestamp}${ext}`);
  }
});

// Filtro de validación para asegurar que solo se suban archivos de imagen
const upload = multer({
  storage,
  limits: { 
    fileSize: 8 * 1024 * 1024 // 8 MB máximo por foto para optimizar el disco de 40GB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen en formato JPG/PNG/WEBP.'));
    }
  }
});

// ==========================================
// RUTAS DE LA API
// ==========================================

// Marcado de Asistencia (Entrada/Salida) con carga de foto
router.post('/asistencia/marcar', (req, res, next) => {
  upload.single('foto')(req, res, (err) => {
    if (err) {
      console.error('Error al cargar foto con Multer:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, asistenciaController.marcarAsistencia);

// Obtener Sedes para el Combobox
router.get('/sedes', asistenciaController.obtenerSedes);

// Obtener Historial de Marcaciones con filtros (Admin)
router.get('/asistencia/historial', asistenciaController.obtenerHistorialMarcaciones);

// Exportaciones de Reportes Masivos (Admin)
router.get('/asistencia/exportar/excel', asistenciaController.exportarExcel);
router.get('/asistencia/exportar/pdf', asistenciaController.exportarPDF);

// Autenticación de Usuarios y Admin
router.post('/auth/login', authController.login);
router.post('/auth/crear-usuario', authController.crearUsuario);
router.get('/auth/usuarios', authController.obtenerUsuarios);

module.exports = router;
