const Student = require('../models/Student');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const { toPercentage } = require('../services/ranking');

async function summary(req, res) {
  const [students, exams, results, recentExams, recentResults] = await Promise.all([
    Student.countDocuments(),
    Exam.countDocuments(),
    Result.countDocuments(),
    Exam.find().sort({ createdAt: -1 }).limit(5).lean(),
    Result.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('student', 'registrationNo name')
      .populate('exam', 'title totalMarks')
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      totals: { students, exams, results },
      recentExams,
      recentResults: recentResults.map((r) => ({
        ...r,
        percentage: r.exam ? toPercentage(r.marksObtained, r.exam.totalMarks) : null,
      })),
    },
  });
}

module.exports = { summary };
