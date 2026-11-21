const Exam = require('../models/Exam');
const { getLeaderboard } = require('../services/leaderboardService');

/** Exams available for the leaderboard selector (minimal public fields). */
async function exams(req, res) {
  const items = await Exam.find({}, 'title examDate totalMarks status').sort({ examDate: -1 }).lean();
  res.json({ success: true, data: items });
}

async function byExam(req, res) {
  const data = await getLeaderboard(req.params.examId);
  res.json({ success: true, data });
}

module.exports = { exams, byExam };
