const Exam = require('../models/Exam');
const Result = require('../models/Result');
const ApiError = require('../utils/ApiError');
const { assignRanks, toPercentage } = require('./ranking');

/**
 * Builds the leaderboard for one exam directly from the current results.
 * Nothing is cached or stored, so the leaderboard is always correct after any
 * result is created, updated or deleted.
 */
async function getLeaderboard(examId) {
  const exam = await Exam.findById(examId).lean();
  if (!exam) throw ApiError.notFound('Examination not found');

  const results = await Result.find({ exam: examId })
    .populate('student', 'registrationNo name')
    .lean();

  const rows = results
    .filter((r) => r.student) // defensive: ignore any orphaned record
    .map((r) => ({
      resultId: r._id,
      studentId: r.student._id,
      registrationNo: r.student.registrationNo,
      name: r.student.name,
      marksObtained: r.marksObtained,
      totalMarks: exam.totalMarks,
      percentage: toPercentage(r.marksObtained, exam.totalMarks),
    }));

  return {
    exam: {
      _id: exam._id,
      title: exam.title,
      examDate: exam.examDate,
      totalMarks: exam.totalMarks,
      status: exam.status,
    },
    rankingRule: 'Standard competition ranking: equal marks share the same rank; the next rank skips accordingly (1, 2, 2, 4).',
    entries: assignRanks(rows),
  };
}

module.exports = { getLeaderboard };
