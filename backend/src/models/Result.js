const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// Result integrity: one result per (student, exam) pair, enforced by the database.
resultSchema.index({ student: 1, exam: 1 }, { unique: true });
// Leaderboard query: all results of one exam ordered by marks.
resultSchema.index({ exam: 1, marksObtained: -1 });
// Dashboard "recent activity".
resultSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Result', resultSchema);
