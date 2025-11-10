module.exports = {
  apps: [{
    name: 'wpma-api',
    script: 'src/index.js',
    cwd: '/var/www/projects/wpma-io-production',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
} 