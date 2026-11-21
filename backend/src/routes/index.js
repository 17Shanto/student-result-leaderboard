const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const a = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const s = require('../validators/schemas');

const auth = require('../controllers/authController');
const students = require('../controllers/studentController');
const exams = require('../controllers/examController');
const results = require('../controllers/resultController');
const dashboard = require('../controllers/dashboardController');
const leaderboard = require('../controllers/leaderboardController');

const router = express.Router();

// Brute-force protection for the login endpoint.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// ---------- Health ----------
router.get('/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({ success: dbUp, status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'connected' : 'disconnected' });
});

// ---------- Auth ----------
router.post('/auth/login', loginLimiter, validate(s.login), a(auth.login));
router.post('/auth/logout', auth.logout);
router.get('/auth/me', requireAuth, auth.me);

// ---------- Public leaderboard (read-only) ----------
router.get('/leaderboard/exams', a(leaderboard.exams));
router.get('/leaderboard/:examId', validate(s.examIdParam, 'params'), a(leaderboard.byExam));

// ---------- Everything below requires an authenticated administrator ----------
router.use(requireAuth);

router.get('/dashboard', a(dashboard.summary));

function crud(path, controller, bodySchema, querySchema) {
  router.get(path, validate(querySchema, 'query'), a(controller.list));
  router.post(path, validate(bodySchema), a(controller.create));
  router.get(`${path}/:id`, validate(s.idParam, 'params'), a(controller.getOne));
  router.put(`${path}/:id`, validate(s.idParam, 'params'), validate(bodySchema), a(controller.update));
  router.delete(`${path}/:id`, validate(s.idParam, 'params'), a(controller.remove));
}

crud('/students', students, s.studentBody, s.studentQuery);
crud('/exams', exams, s.examBody, s.examQuery);
crud('/results', results, s.resultBody, s.resultQuery);

module.exports = router;
