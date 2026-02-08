// PM2 ecosystem configuration for doc-store
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'doc-store-api',
      script: 'packages/api/dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      merge_logs: true,
    },
    {
      name: 'doc-store-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: `${__dirname}/packages/web`,
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '../../logs/web-error.log',
      out_file: '../../logs/web-out.log',
      merge_logs: true,
    },
  ],
};
