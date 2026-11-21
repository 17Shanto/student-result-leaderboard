const Exam = require('../models/Exam');
const Result = require('../models/Result');
const ApiError = require('../utils/ApiError');
const { escapeRegex, buildPageMeta } = require('../utils/pagination');

async function list(req, res) {
  const { page, limit, search, status } = req.query;
  const filter = {};
  if (search) filter.title = new RegExp(escapeRegex(search), 'i');
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Exam.find(filter).sort({ examDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Exam.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, meta: buildPageMeta(page, limit, total) });
}

async function getOne(req, res) {
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) throw ApiError.notFound('Examination not found');
  res.json({ success: true, data: exam });
}

async function create(req, res) {
  const exam = await Exam.create(req.body);
  res.status(201).json({ success: true, data: exam });
}

async function update(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw ApiError.notFound('Examination not found');

  // Reference safety: lowering total marks must not make existing results invalid.
  if (req.body.totalMarks < exam.totalMarks) {
    const top = await Result.findOne({ exam: exam._id }).sort({ marksObtained: -1 }).lean();
    if (top && top.marksObtained > req.body.totalMarks) {
      throw ApiError.conflict(
        `Total marks cannot be lower than the highest recorded result (${top.marksObtained}).`,
        { totalMarks: `Must be at least ${top.marksObtained}` }
      );
    }
  }

  exam.set(req.body);
  await exam.save();
  res.json({ success: true, data: exam });
}

/** Deletes the exam and all of its results (results first, see studentController). */
async function remove(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) throw ApiError.notFound('Examination not found');

  const { deletedCount } = await Result.deleteMany({ exam: exam._id });
  await exam.deleteOne();

  res.json({ success: true, message: 'Examination deleted', data: { deletedResults: deletedCount } });
}

module.exports = { list, getOne, create, update, remove };
