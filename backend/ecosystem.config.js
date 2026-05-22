module.exports = {
  apps: [
    {
      name: 'sistema-asistencia-backend',
      script: 'src/index.js',
      cwd: './',
      instances: 1, // 1 Instancia es óptima para 2GB de RAM para ahorrar memoria
      autorestart: true,
      watch: false,
      max_memory_restart: '200M', // Reiniciar si excede 200MB de RAM (ahorro de disco/memoria)
      node_args: '--max-old-space-size=256', // Limitar el montículo de V8 a 256MB
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Configuración de Logs para evitar saturar el disco de 40GB
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
