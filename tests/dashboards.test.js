const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const SellerProfile = require('../src/models/SellerProfile');
const Product = require('../src/models/Product');
const AuditLog = require('../src/models/AuditLog');

let customerToken = '';
let customerId = '';
let sellerToken = '';
let sellerId = '';
let sellerProfileId = '';
let adminToken = '';
let adminId = '';
let targetUserToSuspendId = '';
let testProductId = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // 1. Create Customer
  const custRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Regular Customer',
      email: `dash_cust_${Date.now()}@rescrafted-dashboards.test`,
      password: 'SecurePassword123'
    });
  customerToken = custRes.body.data.token;
  customerId = custRes.body.data.user._id;

  // 2. Create Seller
  const sellerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Eco Artisan',
      email: `dash_seller_${Date.now()}@rescrafted-dashboards.test`,
      password: 'SecurePassword123',
      role: 'seller',
      storeName: `Artisan Studio ${Date.now()}`
    });
  sellerToken = sellerRes.body.data.token;
  sellerId = sellerRes.body.data.user._id;

  const profile = await SellerProfile.findOne({ userId: sellerId });
  if (profile) {
    profile.status = 'approved';
    await profile.save();
    sellerProfileId = profile._id.toString();
  }

  // 3. Create Admin directly
  const adminEmail = `dash_admin_${Date.now()}@rescrafted-dashboards.test`;
  const adminUser = await User.create({
    name: 'Super Admin',
    email: adminEmail,
    password: 'SecurePassword123',
    role: 'admin',
    isEmailVerified: true
  });
  adminId = adminUser._id.toString();

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: adminEmail,
      password: 'SecurePassword123'
    });
  adminToken = loginRes.body.data.token;

  // 4. Create dummy user to suspend
  const dummyUser = await User.create({
    name: 'Suspend Target',
    email: `suspend_${Date.now()}@rescrafted-dashboards.test`,
    password: 'SecurePassword123',
    role: 'customer'
  });
  targetUserToSuspendId = dummyUser._id.toString();

  // 5. Find a product for moderation test
  const prod = await Product.findOne({ status: 'published' });
  if (prod) {
    testProductId = prod._id.toString();
  }
});

test.after(async () => {
  if (customerId) await User.findByIdAndDelete(customerId);
  if (sellerId) {
    await User.findByIdAndDelete(sellerId);
    await SellerProfile.deleteOne({ userId: sellerId });
  }
  if (adminId) {
    await User.findByIdAndDelete(adminId);
    await AuditLog.deleteMany({ actorId: adminId });
  }
  if (targetUserToSuspendId) await User.findByIdAndDelete(targetUserToSuspendId);
});

// Seller Hub Tests
test('GET /api/v1/seller/dashboard rejects regular customer with 403', async () => {
  const res = await request(app)
    .get('/api/v1/seller/dashboard')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 403);
});

test('GET /api/v1/seller/dashboard retrieves seller metrics and analytics', async () => {
  const res = await request(app)
    .get('/api/v1/seller/dashboard')
    .set('Authorization', `Bearer ${sellerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.stats);
  assert.ok(Array.isArray(res.body.data.monthlyTrends));
});

test('GET /api/v1/seller/orders retrieves seller fulfillment packages', async () => {
  const res = await request(app)
    .get('/api/v1/seller/orders')
    .set('Authorization', `Bearer ${sellerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.orders));
});

test('PATCH /api/v1/seller/profile updates store bio and information', async () => {
  const res = await request(app)
    .patch('/api/v1/seller/profile')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      bio: 'Upcycling teak and rosewood into minimalist home artifacts.'
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(
    res.body.data.profile.bio,
    'Upcycling teak and rosewood into minimalist home artifacts.'
  );
});

// Admin Console Tests
test('GET /api/v1/admin/metrics rejects non-admin users with 403', async () => {
  const res = await request(app)
    .get('/api/v1/admin/metrics')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 403);
});

test('GET /api/v1/admin/metrics returns platform overview metrics', async () => {
  const res = await request(app)
    .get('/api/v1/admin/metrics')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.metrics.totalUsers >= 3);
  assert.ok(Array.isArray(res.body.data.monthlyTrends));
});

test('GET /api/v1/admin/users retrieves platform user directory', async () => {
  const res = await request(app)
    .get('/api/v1/admin/users')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.users.length >= 1);
});

test('PATCH /api/v1/admin/users/:id/status suspends user and creates audit log', async () => {
  const res = await request(app)
    .patch(`/api/v1/admin/users/${targetUserToSuspendId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isActive: false });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.user.isActive, false);

  const log = await AuditLog.findOne({
    targetId: targetUserToSuspendId,
    action: 'USER_SUSPENDED'
  });
  assert.ok(log, 'Audit log must be created on user suspension');
});

test('GET /api/v1/admin/sellers returns seller applications', async () => {
  const res = await request(app)
    .get('/api/v1/admin/sellers')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.sellers.length >= 1);
});

test('PATCH /api/v1/admin/sellers/:id/status updates seller status and creates audit log', async () => {
  const res = await request(app)
    .patch(`/api/v1/admin/sellers/${sellerProfileId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'approved' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.profile.status, 'approved');

  const log = await AuditLog.findOne({
    targetId: sellerProfileId,
    action: 'SELLER_APPROVED'
  });
  assert.ok(log);
});

test('PATCH /api/v1/admin/products/:id/moderate updates product status', async () => {
  if (!testProductId) return;

  const res = await request(app)
    .patch(`/api/v1/admin/products/${testProductId}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'published' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.product.status, 'published');
});

test('GET /api/v1/admin/audit-logs retrieves platform audit logs', async () => {
  const res = await request(app)
    .get('/api/v1/admin/audit-logs')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.logs.length >= 1);
});
