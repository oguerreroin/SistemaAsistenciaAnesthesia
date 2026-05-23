const fs = require('fs');
const path = require('path');
const db = require('../backend/src/db');

async function runUpdate() {
  const client = await db.pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'update_sedes.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Ejecutando script de actualización de sedes...');
    await client.query(sql);
    console.log('¡Sedes actualizadas correctamente en la base de datos!');
  } catch (error) {
    console.error('Error al actualizar sedes:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

runUpdate();
