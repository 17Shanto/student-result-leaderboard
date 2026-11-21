require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];

function loadConfig() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET || 'test-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    corsOrigin: (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}

module.exports = loadConfig();
