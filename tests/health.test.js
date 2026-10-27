const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');

test('GET / returns API welcome info', async () => {
  const res = await request(app).get('/');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.name, 'ResCrafted 2.0 API');
  assert.strictEqual(res.body.tagline, 'Give Waste a Second Life');
});

test('GET /api/v1/health returns healthy status', async () => {
  const res = await request(app).get('/api/v1/health');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.status, 'healthy');
  assert.strictEqual(res.body.data.version, '2.0.0');
});

test('GET /api/v1/non-existent-route returns 404 with structured error', async () => {
  const res = await request(app).get('/api/v1/non-existent-route');
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, 'NOT_FOUND');
});
