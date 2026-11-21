const mongoose = require('mongoose');

const EXAM_STATUSES = ['upcoming', 'ongoing', 'completed'];

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    examDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 1, max: 10000 },
    status: { type: String, enum: EXAM_STATUSES, default: 'upcoming', required: true },
  },
  { timestamps: true }
);

examSchema.index({ examDate: -1 });
examSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Exam', examSchema);
module.exports.EXAM_STATUSES = EXAM_STATUSES;
