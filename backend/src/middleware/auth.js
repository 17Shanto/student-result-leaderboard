const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const Admin = require('../models/Admin');

const COOKIE_NAME = 'srls_token';

function cookieOptions() {
  return {
    httpOnly: true, // not readable from JavaScript (XSS protection)
    secure: config.isProduction, // HTTPS only in production
    sameSite: 'strict', // not sent on cross-site requests (CSRF protection)
    path: '/',
  };
}

function signToken(admin) {
  return jwt.sign({ sub: admin.id, role: 'admin' }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = req.cookies?.[COOKIE_NAME] || bearer;
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
    }

    const admin = await Admin.findById(payload.sub);
    if (!admin) throw ApiError.unauthorized('Account no longer exists');

    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, signToken, cookieOptions, COOKIE_NAME };
