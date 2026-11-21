/**
 * Integration tests against an in-memory MongoDB (no real database needed).
 * The first run downloads a MongoDB binary, so it needs internet access once.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const createApp = require('../src/app');
const Admin = require('../src/models/Admin');

let mongo;
let app;
let agent; // keeps the auth cookie between requests

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = createApp();

  await Admin.create({
    name: 'Test Admin',
    email: 'admin@test.com',
    passwordHash: await Admin.hashPassword('Password123!'),
  });

  agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123!' });
  expect(res.status).toBe(200);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function makeStudent(regNo, name = `Student ${regNo}`) {
  const res = await agent.post('/api/students').send({
    registrationNo: regNo, name, email: `${regNo.toLowerCase()}@test.com`, batch: '2024', department: 'CSE',
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

async function makeExam(totalMarks = 100) {
  const res = await agent.post('/api/exams').send({
    title: `Exam ${Date.now()}`, examDate: '2026-11-01', totalMarks, status: 'completed',
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Authentication', () => {
  test('rejects wrong password with 401 and a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('protected routes reject unauthenticated requests', async () => {
    const res = await request(app).post('/api/students').send({});
    expect(res.status).toBe(401);
  });
});

describe('Students', () => {
  test('rejects duplicate registration numbers (case-insensitive)', async () => {
    await makeStudent('REG-100');
    const res = await agent.post('/api/students').send({
      registrationNo: 'reg-100', name: 'Dup', email: 'dup@test.com', batch: '2024', department: 'CSE',
    });
    expect(res.status).toBe(409);
  });

  test('rejects invalid data with field errors', async () => {
    const res = await agent.post('/api/students').send({ registrationNo: '', email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('email');
    expect(res.body.errors).toHaveProperty('name');
  });

  test('supports search and pagination', async () => {
    await makeStudent('SRCH-1', 'Findable Person');
    const res = await agent.get('/api/students').query({ search: 'findable', page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5, total: 1 });
  });
});

describe('Result integrity', () => {
  test('rejects duplicate result for the same student and exam', async () => {
    const st = await makeStudent('INT-1');
    const ex = await makeExam();
    const body = { student: st._id, exam: ex._id, marksObtained: 70 };
    expect((await agent.post('/api/results').send(body)).status).toBe(201);
    const dup = await agent.post('/api/results').send(body);
    expect(dup.status).toBe(409);
  });

  test('rejects marks above total marks and negative marks', async () => {
    const st = await makeStudent('INT-2');
    const ex = await makeExam(50);
    const over = await agent.post('/api/results').send({ student: st._id, exam: ex._id, marksObtained: 51 });
    expect(over.status).toBe(400);
    expect(over.body.errors).toHaveProperty('marksObtained');
    const neg = await agent.post('/api/results').send({ student: st._id, exam: ex._id, marksObtained: -1 });
    expect(neg.status).toBe(400);
  });

  test('rejects results for a non-existent student', async () => {
    const ex = await makeExam();
    const res = await agent.post('/api/results').send({
      student: new mongoose.Types.ObjectId().toString(), exam: ex._id, marksObtained: 10,
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('student');
  });

  test('cannot lower exam total marks below an existing result', async () => {
    const st = await makeStudent('INT-3');
    const ex = await makeExam(100);
    await agent.post('/api/results').send({ student: st._id, exam: ex._id, marksObtained: 90 });
    const res = await agent.put(`/api/exams/${ex._id}`).send({
      title: ex.title, examDate: '2026-11-01', totalMarks: 80, status: 'completed',
    });
    expect(res.status).toBe(409);
  });

  test('deleting a student also deletes their results (no orphans)', async () => {
    const st = await makeStudent('INT-4');
    const ex = await makeExam();
    await agent.post('/api/results').send({ student: st._id, exam: ex._id, marksObtained: 40 });
    const del = await agent.delete(`/api/students/${st._id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.deletedResults).toBe(1);
    const list = await agent.get('/api/results').query({ exam: ex._id });
    expect(list.body.data).toHaveLength(0);
  });
});

describe('Leaderboard', () => {
  test('ranks ties equally and stays correct after update and delete', async () => {
    const ex = await makeExam(100);
    const a = await makeStudent('LB-A');
    const b = await makeStudent('LB-B');
    const c = await makeStudent('LB-C');
    await agent.post('/api/results').send({ student: a._id, exam: ex._id, marksObtained: 90 });
    const rb = await agent.post('/api/results').send({ student: b._id, exam: ex._id, marksObtained: 90 });
    const rc = await agent.post('/api/results').send({ student: c._id, exam: ex._id, marksObtained: 70 });

    let lb = await request(app).get(`/api/leaderboard/${ex._id}`);
    expect(lb.status).toBe(200);
    expect(lb.body.data.entries.map((e) => e.rank)).toEqual([1, 1, 3]);

    // Update: C overtakes everyone.
    await agent.put(`/api/results/${rc.body.data._id}`).send({ student: c._id, exam: ex._id, marksObtained: 99 });
    lb = await request(app).get(`/api/leaderboard/${ex._id}`);
    expect(lb.body.data.entries[0]).toMatchObject({ registrationNo: 'LB-C', rank: 1, percentage: 99 });

    // Delete: B removed, A becomes rank 2 alone.
    await agent.delete(`/api/results/${rb.body.data._id}`);
    lb = await request(app).get(`/api/leaderboard/${ex._id}`);
    expect(lb.body.data.entries.map((e) => [e.registrationNo, e.rank])).toEqual([['LB-C', 1], ['LB-A', 2]]);
  });
});

describe('Error handling', () => {
  test('invalid ids return 400 without stack traces', async () => {
    const res = await agent.get('/api/students/not-an-id');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js/);
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await agent.get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
