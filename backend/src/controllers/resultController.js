const Result = require('../models/Result');
const Student = require('../models/Student');
const Exam = require('../models/Exam');
const ApiError = require('../utils/ApiError');
const { buildPageMeta } = require('../utils/pagination');
const { toPercentage } = require('../services/ranking');

const POPULATE = [
  { path: 'student', select: 'registrationNo name batch department' },
  { path: 'exam', select: 'title examDate totalMarks status' },
];

function decorate(result) {
  const r = typeof result.toObject === 'function' ? result.toObject() : result;
  return {
    ...r,
    percentage: r.exam?.totalMarks ? toPercentage(r.marksObtained, r.exam.totalMarks) : null,
  };
}

/** Ensures the student and exam exist and the marks are within the exam's range. */
async function assertValidRelations({ student, exam, marksObtained }) {
  const [studentDoc, examDoc] = await Promise.all([
    Student.exists({ _id: student }),
    Exam.findById(exam).lean(),
  ]);

  const errors = {};
  if (!studentDoc) errors.student = 'Selected student does not exist';
  if (!examDoc) errors.exam = 'Selected examination does not exist';
  if (Object.keys(errors).length) throw ApiError.badRequest('Invalid student or examination', errors);

  if (marksObtained > examDoc.totalMarks) {
    throw ApiError.badRequest('Marks are outside the valid range', {
      marksObtained: `Marks must be between 0 and ${examDoc.totalMarks}`,
    });
  }
}

async function list(req, res) {
  const { page, limit, student, exam } = req.query;
  const filter = {};
  if (student) filter.student = student;
  if (exam) filter.exam = exam;

  const [items, total] = await Promise.all([
    Result.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).populate(POPULATE).lean(),
    Result.countDocuments(filter),
  ]);

  res.json({ success: true, data: items.map(decorate), meta: buildPageMeta(page, limit, total) });
}

async function getOne(req, res) {
  const result = await Result.findById(req.params.id).populate(POPULATE).lean();
  if (!result) throw ApiError.notFound('Result not found');
  res.json({ success: true, data: decorate(result) });
}

async function create(req, res) {
  await assertValidRelations(req.body);

  const duplicate = await Result.exists({ student: req.body.student, exam: req.body.exam });
  if (duplicate) {
    throw ApiError.conflict('A result for this student and examination already exists', {
      student: 'This student already has a result for the selected examination',
    });
  }

  // The unique index still protects against a race between two simultaneous requests.
  const result = await Result.create(req.body);
  await result.populate(POPULATE);
  res.status(201).json({ success: true, data: decorate(result) });
}

async function update(req, res) {
  const result = await Result.findById(req.params.id);
  if (!result) throw ApiError.notFound('Result not found');

  await assertValidRelations(req.body);

  const duplicate = await Result.exists({
    _id: { $ne: result._id },
    student: req.body.student,
    exam: req.body.exam,
  });
  if (duplicate) {
    throw ApiError.conflict('A result for this student and examination already exists', {
      student: 'This student already has a result for the selected examination',
    });
  }

  result.set(req.body);
  await result.save();
  await result.populate(POPULATE);
  res.json({ success: true, data: decorate(result) });
}

async function remove(req, res) {
  const result = await Result.findByIdAndDelete(req.params.id);
  if (!result) throw ApiError.notFound('Result not found');
  res.json({ success: true, message: 'Result deleted' });
}

module.exports = { list, getOne, create, update, remove };
