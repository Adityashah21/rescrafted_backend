const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');

const testEmail = `testuser_${Date.now()}@rescrafted-auth.test`;
const testPassword = 'SecurePassword123';
let authToken = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }
  // Clean up any test user created for auth tests only
  await User.deleteMany({ email: /.*@rescrafted-auth\.test$/ });
});

test.after(async () => {
  await User.deleteMany({ email: /.*@rescrafted-auth\.test$/ });
});

test('POST /api/v1/auth/register successfully creates a customer account', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Eco Shopper',
      email: testEmail,
      password: testPassword,
      phone: '9876543210',
    });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.user.email, testEmail.toLowerCase());
  assert.strictEqual(res.body.data.user.role, 'customer');
  assert.ok(res.body.data.token);
  assert.strictEqual(res.body.data.user.password, undefined); // Never return password hash!
});

test('POST /api/v1/auth/register rejects duplicate email', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Another User',
      email: testEmail,
      password: testPassword,
    });

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'DUPLICATE_EMAIL');
});

test('POST /api/v1/auth/register rejects weak password', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Weak Pass User',
      email: `weak_${Date.now()}@rescrafted.test`,
      password: 'short',
    });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
});

test('POST /api/v1/auth/login succeeds with correct credentials', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: testEmail,
      password: testPassword,
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.token);
  authToken = res.body.data.token;
});

test('POST /api/v1/auth/login fails with wrong password', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: testEmail,
      password: 'WrongPassword999',
    });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'INVALID_CREDENTIALS');
});

test('GET /api/v1/auth/me returns current user when authorized', async () => {
  const res = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${authToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.user.email, testEmail.toLowerCase());
});

test('GET /api/v1/auth/me rejects requests without token', async () => {
  const res = await request(app).get('/api/v1/auth/me');

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
});

test('Customer role receives 403 FORBIDDEN when attempting admin operations', async () => {
  const res = await request(app)
    .get('/api/v1/auth/admin-check')
    .set('Authorization', `Bearer ${authToken}`);

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'FORBIDDEN');
});
