const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Nginx: correct client IPs for rate limiting

  app.use(helmet());
  if (config.corsOrigin.length) {
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
  }
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (config.nodeEnv !== 'test') app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;
