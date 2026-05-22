const db = require('../db');
const bcrypt = require('bcryptjs');

// Login de usuario / administrador
exports.login = async (req, res) => {
  try {
    const { dni, pin } = req.body;

    if (!dni || !pin) {
      return res.status(400).json({ error: 'Por favor, ingrese DNI y PIN.' });
    }

    const userRes = await db.query(
      'SELECT id, dni, pin_hash, nombre, rol, status FROM usuarios WHERE dni = $1',
      [dni]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no registrado con ese DNI.' });
    }

    const usuario = userRes.rows[0];

    if (usuario.status !== 'ACTIVO') {
      return res.status(403).json({ error: 'El usuario se encuentra inactivo.' });
    }

    // Verificar el PIN ingresado
    const esValido = await bcrypt.compare(pin, usuario.pin_hash);
    if (!esValido) {
      return res.status(401).json({ error: 'PIN incorrecto. Intente nuevamente.' });
    }

    // Respuesta exitosa
    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        id: usuario.id,
        dni: usuario.dni,
        nombre: usuario.nombre,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno en el servidor durante el login.' });
  }
};

// Crear nuevo usuario (Solo Admin)
exports.crearUsuario = async (req, res) => {
  try {
    const { dni, pin, nombre, rol } = req.body;

    if (!dni || !pin || !nombre || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos para el registro.' });
    }

    // Hashing del PIN con bcryptjs
    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pin, salt);

    const checkDni = await db.query('SELECT id FROM usuarios WHERE dni = $1', [dni]);
    if (checkDni.rows.length > 0) {
      return res.status(400).json({ error: 'El DNI ya se encuentra registrado por otro usuario.' });
    }

    const insertRes = await db.query(
      `INSERT INTO usuarios (dni, pin_hash, nombre, rol, status) 
       VALUES ($1, $2, $3, $4, 'ACTIVO') 
       RETURNING id, dni, nombre, rol, status`,
      [dni, pinHash, nombre, rol]
    );

    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente.',
      data: insertRes.rows[0]
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error interno al crear usuario.' });
  }
};

// Obtener lista de usuarios para la administración
exports.obtenerUsuarios = async (req, res) => {
  try {
    const usersRes = await db.query(
      'SELECT id, dni, nombre, rol, status, created_at FROM usuarios ORDER BY nombre ASC'
    );
    return res.json(usersRes.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
};
