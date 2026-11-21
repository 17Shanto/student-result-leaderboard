const { z } = require('zod');
const mongoose = require('mongoose');
const { EXAM_STATUSES } = require('../models/Exam');

const objectId = (label) =>
  z.string({ required_error: `${label} is required` })
    .refine((v) => mongoose.isValidObjectId(v), { message: `${label} is not a valid id` });

const trimmed = (label, max) =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

// ---------- Auth ----------
const login = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});

// ---------- Students ----------
const studentBody = z.object({
  registrationNo: trimmed('Registration number', 50)
    .regex(/^[A-Za-z0-9\-/_.]+$/, 'Registration number may contain letters, digits, - / _ . only'),
  name: trimmed('Name', 120),
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email'),
  batch: trimmed('Batch / session', 50),
  department: trimmed('Department / course', 100),
}).strict();

const studentQuery = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).optional().default(''),
});

// ---------- Exams ----------
const examBody = z.object({
  title: trimmed('Title', 150),
  examDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid examination date' }) }),
  totalMarks: z.coerce.number({ invalid_type_error: 'Total marks must be a number' })
    .int('Total marks must be a whole number')
    .min(1, 'Total marks must be at least 1')
    .max(10000, 'Total marks must be at most 10000'),
  status: z.enum(EXAM_STATUSES, { errorMap: () => ({ message: `Status must be one of: ${EXAM_STATUSES.join(', ')}` }) }),
}).strict();

const examQuery = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).optional().default(''),
  status: z.enum(EXAM_STATUSES).optional(),
});

// ---------- Results ----------
const resultBody = z.object({
  student: objectId('Student'),
  exam: objectId('Examination'),
  marksObtained: z.coerce.number({ invalid_type_error: 'Marks must be a number' })
    .min(0, 'Marks cannot be negative'),
  remarks: z.string().trim().max(300, 'Remarks must be at most 300 characters').optional().default(''),
}).strict();

const resultQuery = z.object({
  ...pageQuery,
  student: objectId('Student').optional(),
  exam: objectId('Examination').optional(),
});

const idParam = z.object({ id: objectId('Id') });
const examIdParam = z.object({ examId: objectId('Examination') });

module.exports = {
  login,
  studentBody,
  studentQuery,
  examBody,
  examQuery,
  resultBody,
  resultQuery,
  idParam,
  examIdParam,
};
