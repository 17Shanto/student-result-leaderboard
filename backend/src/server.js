const config = require('./config/env');
const createApp = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

async function start() {
  try {
    await connectDB(config.mongoUri);
    console.log('MongoDB connected');

    const app = createApp();
    const server = app.listen(config.port, () => {
      console.log(`API listening on port ${config.port} (${config.nodeEnv})`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1); // PM2 will restart the process
  }
}

start();
