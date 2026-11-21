const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let message = 'Something went wrong. Please try again later.';
  let details;

  if (err instanceof ApiError) {
    ({ status, message, details } = err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {}).join(', ');
    message = field.includes('student') && field.includes('exam')
      ? 'A result for this student and examination already exists'
      : `A record with this ${field || 'value'} already exists`;
  } else if (err instanceof mongoose.Error && /buffering timed out|ECONNREFUSED|topology/i.test(err.message)) {
    status = 503;
    message = 'Database is temporarily unavailable. Please try again shortly.';
  }

  // Log full error on the server only; never leak stack traces or internals to clients.
  if (status >= 500 && config.nodeEnv !== 'test') {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
