const Student = require('../models/Student');
const Result = require('../models/Result');
const ApiError = require('../utils/ApiError');
const { escapeRegex, buildPageMeta } = require('../utils/pagination');

async function list(req, res) {
  const { page, limit, search } = req.query;
  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { registrationNo: rx }, { email: rx }, { batch: rx }, { department: rx }];
  }

  const [items, total] = await Promise.all([
    Student.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  res.json({ success: true, data: items, meta: buildPageMeta(page, limit, total) });
}

async function getOne(req, res) {
  const student = await Student.findById(req.params.id).lean();
  if (!student) throw ApiError.notFound('Student not found');
  res.json({ success: true, data: student });
}

async function create(req, res) {
  const student = await Student.create(req.body);
  res.status(201).json({ success: true, data: student });
}

async function update(req, res) {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');
  student.set(req.body);
  await student.save();
  res.json({ success: true, data: student });
}

/**
 * Reference safety: a student's results are deleted together with the student.
 * Results are removed FIRST so that an interruption can never leave a result
 * pointing to a student that no longer exists.
 */
async function remove(req, res) {
  const student = await Student.findById(req.params.id);
  if (!student) throw ApiError.notFound('Student not found');

  const { deletedCount } = await Result.deleteMany({ student: student._id });
  await student.deleteOne();

  res.json({ success: true, message: 'Student deleted', data: { deletedResults: deletedCount } });
}

module.exports = { list, getOne, create, update, remove };
