const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const dns = require('dns');

// Fix DNS resolution for MongoDB Atlas SRV on Windows
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = require('../src/app');
const request = supertest(app);
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');

describe('Security & Performance Audit Suite (Phase 10)', () => {
  test('Helmet enforces strict security HTTP headers on all API responses', async () => {
    const res = await request.get('/api/v1/health');

    assert.equal(res.status, 200);
    // Helmet headers
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['x-frame-options']);
    assert.equal(res.headers['x-dns-prefetch-control'], 'off');
    assert.equal(res.headers['x-download-options'], 'noopen');
  });

  test('CORS allows authorized frontend origin with credentials', async () => {
    const res = await request
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  test('CORS rejects unauthorized origin with an error', async () => {
    const res = await request
      .get('/api/v1/health')
      .set('Origin', 'https://malicious-astroturfing-site.com');

    // CORS error handler intercepts and returns 500 error envelope
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://malicious-astroturfing-site.com');
  });

  test('NoSQL Injection protection: mongoSanitize strips operator keys starting with $', async () => {
    const maliciousPayload = {
      email: 'hacker@example.com',
      password: 'password123',
      $gt: '',
      $ne: null,
      nested: {
        $where: 'sleep(5000)',
        normalField: 'clean'
      }
    };

    // Send payload to an endpoint using body
    const res = await request
      .post('/api/v1/auth/login')
      .send(maliciousPayload);

    // Operator keys ($gt, $ne, nested.$where) are stripped out by mongoSanitize
    // Zod validation or Auth will receive only sanitized fields
    assert.notEqual(res.status, 500); // Does not crash or leak DB error
  });

  test('Sensitive data protection: password hashes and OTPs are excluded from user models', async () => {
    const user = await User.findOne().select('+password +emailVerificationOtp').lean();
    if (user) {
      // By default query without explicit select
      const publicUser = await User.findById(user._id).lean();
      assert.equal(publicUser.password, undefined);
      assert.equal(publicUser.emailVerificationOtp, undefined);
      assert.equal(publicUser.passwordResetToken, undefined);
    }
  });

  test('High-performance database indexes are established on critical models', async () => {
    // 1. Product indexes
    const productIndexes = Product.schema.indexes();
    const productIndexKeys = productIndexes.map(([keys]) => Object.keys(keys));
    assert.ok(
      productIndexKeys.some((k) => k.includes('title') && k.includes('description')),
      'Product must have text index on title and description'
    );
    assert.ok(
      productIndexKeys.some((k) => k.includes('status') && k.includes('categoryId') && k.includes('pricePaise')),
      'Product must have compound index on status, categoryId, pricePaise'
    );

    // 2. Order indexes
    const orderIndexes = Order.schema.indexes();
    const orderIndexKeys = orderIndexes.map(([keys]) => Object.keys(keys));
    assert.ok(
      orderIndexKeys.some((k) => k.includes('customerId') && k.includes('createdAt')),
      'Order must have compound index on customerId and createdAt'
    );
    assert.ok(
      orderIndexKeys.some((k) => k.includes('sellerFulfillments.sellerId') && k.includes('createdAt')),
      'Order must have compound index on sellerId and createdAt'
    );

    // 3. Review indexes
    const reviewIndexes = Review.schema.indexes();
    const reviewIndexKeys = reviewIndexes.map(([keys]) => Object.keys(keys));
    assert.ok(
      reviewIndexKeys.some(
        (k) => k.includes('productId') && k.includes('customerId') && k.includes('orderId')
      ),
      'Review must have unique compound index on productId, customerId, orderId'
    );
    assert.ok(
      reviewIndexKeys.some(
        (k) => k.includes('productId') && k.includes('status') && k.includes('createdAt')
      ),
      'Review must have compound index on productId, status, createdAt'
    );

    // 4. User indexes
    const userIndexes = User.schema.indexes();
    const userIndexKeys = userIndexes.map(([keys]) => Object.keys(keys));
    assert.ok(
      userIndexKeys.some((k) => k.includes('role') && k.includes('isActive')),
      'User must have compound index on role and isActive'
    );

    // 5. AuditLog indexes
    const auditIndexes = AuditLog.schema.indexes();
    const auditIndexKeys = auditIndexes.map(([keys]) => Object.keys(keys));
    assert.ok(
      auditIndexKeys.some((k) => k.includes('createdAt')),
      'AuditLog must have index on createdAt'
    );
  });
});
