const Admin = require('../models/Admin');
const ApiError = require('../utils/ApiError');
const { signToken, cookieOptions, COOKIE_NAME } = require('../middleware/auth');

const publicAdmin = (a) => ({ id: a.id, name: a.name, email: a.email });

async function login(req, res) {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select('+passwordHash');

  // Same message for unknown email and wrong password (no account enumeration).
  if (!admin || !(await admin.verifyPassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken(admin);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ success: true, data: { admin: publicAdmin(admin) } });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ success: true, message: 'Logged out' });
}

function me(req, res) {
  res.json({ success: true, data: { admin: publicAdmin(req.admin) } });
}

module.exports = { login, logout, me };
