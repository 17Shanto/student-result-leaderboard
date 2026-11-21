// PM2 process file. Keeps the API running and restarts it on crash or server reboot.
//   cd backend && pm2 start ../deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'srls-api',
      script: 'src/server.js',
      cwd: __dirname + '/../backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
