const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const AuditLog = require('../src/models/AuditLog');

let purchaserToken = '';
let purchaserId = '';
let nonPurchaserToken = '';
let nonPurchaserId = '';
let adminToken = '';
let adminId = '';
let testProduct = null;
let createdReviewId = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // 1. Create purchaser customer
  const custRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Verified Reviewer',
      email: `rev_purchaser_${Date.now()}@rescrafted-reviews.test`,
      password: 'SecurePassword123'
    });
  purchaserToken = custRes.body.data.token;
  purchaserId = custRes.body.data.user._id;

  // 2. Create non-purchaser customer
  const nonCustRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Curious Browser',
      email: `rev_browser_${Date.now()}@rescrafted-reviews.test`,
      password: 'SecurePassword123'
    });
  nonPurchaserToken = nonCustRes.body.data.token;
  nonPurchaserId = nonCustRes.body.data.user._id;

  // 3. Create Admin
  const adminEmail = `rev_admin_${Date.now()}@rescrafted-reviews.test`;
  const adminUser = await User.create({
    name: 'Review Admin',
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

  // 4. Find test product
  testProduct = await Product.findOne({ status: 'published' });
  assert.ok(testProduct, 'Must have at least one published product');

  // 5. Create delivered order for the purchaser containing this product
  await Order.create({
    orderNumber: `RC-TEST-REV-${Date.now().toString(36).toUpperCase()}`,
    customerId: purchaserId,
    shippingAddressSnapshot: {
      fullName: 'Verified Reviewer',
      phone: '9876543210',
      addressLine1: '123 Green Way',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India'
    },
    sellerFulfillments: [
      {
        sellerId: testProduct.sellerId,
        storeNameSnapshot: 'Artisan Workshop',
        items: [
          {
            productId: testProduct._id,
            title: testProduct.title,
            slug: testProduct.slug,
            sku: testProduct.sku,
            unitPricePaise: testProduct.pricePaise,
            quantity: 1,
            subtotalPaise: testProduct.pricePaise
          }
        ],
        fulfillmentStatus: 'delivered'
      }
    ],
    pricing: {
      subtotalPaise: testProduct.pricePaise,
      shippingPaise: 0,
      taxPaise: Math.round(testProduct.pricePaise * 0.05),
      discountPaise: 0,
      totalPaise: Math.round(testProduct.pricePaise * 1.05)
    },
    paymentStatus: 'paid',
    orderStatus: 'delivered'
  });
});

test.after(async () => {
  if (purchaserId) {
    await User.findByIdAndDelete(purchaserId);
    await Order.deleteMany({ customerId: purchaserId });
    await Review.deleteMany({ customerId: purchaserId });
  }
  if (nonPurchaserId) await User.findByIdAndDelete(nonPurchaserId);
  if (adminId) {
    await User.findByIdAndDelete(adminId);
    await AuditLog.deleteMany({ actorId: adminId });
  }
});

test('GET /api/v1/reviews/product/:productId returns public reviews and rating distribution', async () => {
  const res = await request(app).get(`/api/v1/reviews/product/${testProduct._id}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.reviews));
  assert.ok(res.body.data.ratingDistribution);
});

test('GET /api/v1/reviews/product/:productId/impact returns Life Cycle Assessment specs', async () => {
  const res = await request(app).get(`/api/v1/reviews/product/${testProduct._id}/impact`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.recycledPercentage !== undefined);
  assert.ok(res.body.data.estimatedCo2SavedKg !== undefined);
  assert.ok(res.body.data.estimatedWasteDivertedKg !== undefined);
});

test('POST /api/v1/reviews rejects unauthenticated submission with 401', async () => {
  const res = await request(app)
    .post('/api/v1/reviews')
    .send({
      productId: testProduct._id.toString(),
      rating: 5,
      comment: 'Super fast delivery and great circular packaging!'
    });

  assert.strictEqual(res.statusCode, 401);
});

test('POST /api/v1/reviews rejects review from customer who has NOT purchased the item with 403', async () => {
  const res = await request(app)
    .post('/api/v1/reviews')
    .set('Authorization', `Bearer ${nonPurchaserToken}`)
    .send({
      productId: testProduct._id.toString(),
      rating: 5,
      comment: 'I did not buy this item but want to comment.'
    });

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/reviews creates verified review and updates product average rating', async () => {
  const res = await request(app)
    .post('/api/v1/reviews')
    .set('Authorization', `Bearer ${purchaserToken}`)
    .send({
      productId: testProduct._id.toString(),
      rating: 5,
      title: 'Remarkable Upcycled Craftsmanship',
      comment: 'The reclaimed wood has authentic natural grain and zero chemical odor. Highly recommend!'
    });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.review.isVerifiedPurchase, true);
  assert.strictEqual(res.body.data.review.rating, 5);

  createdReviewId = res.body.data.review._id;

  // Verify product ratings summary updated
  const updatedProduct = await Product.findById(testProduct._id);
  assert.ok(updatedProduct.ratingsSummary.reviewCount >= 1);
  assert.ok(updatedProduct.ratingsSummary.averageRating > 0);
});

test('POST /api/v1/reviews rejects duplicate review submission for the same purchase', async () => {
  const res = await request(app)
    .post('/api/v1/reviews')
    .set('Authorization', `Bearer ${purchaserToken}`)
    .send({
      productId: testProduct._id.toString(),
      rating: 4,
      comment: 'Attempting to write a second review for the same purchase.'
    });

  assert.strictEqual(res.statusCode, 400);
});

test('GET /api/v1/reviews/product/:productId/eligibility returns already_reviewed status', async () => {
  const res = await request(app)
    .get(`/api/v1/reviews/product/${testProduct._id}/eligibility`)
    .set('Authorization', `Bearer ${purchaserToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.canReview, false);
  assert.strictEqual(res.body.data.reason, 'already_reviewed');
});

test('PATCH /api/v1/reviews/:id/moderate allows administrator to flag review and logs audit trail', async () => {
  const res = await request(app)
    .patch(`/api/v1/reviews/${createdReviewId}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'flagged' });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.review.status, 'flagged');

  const log = await AuditLog.findOne({
    targetId: createdReviewId,
    action: 'REVIEW_FLAGGED'
  });
  assert.ok(log);
});

test('DELETE /api/v1/reviews/:id allows author to delete review and recalibrates ratings', async () => {
  const res = await request(app)
    .delete(`/api/v1/reviews/${createdReviewId}`)
    .set('Authorization', `Bearer ${purchaserToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);

  const reviewInDb = await Review.findById(createdReviewId);
  assert.strictEqual(reviewInDb, null);
});
