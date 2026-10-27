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
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

let sellerToken = '';
let customerToken = '';
let testCategoryId = '';
let createdProductId = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // Find or create test category
  let cat = await Category.findOne();
  if (!cat) {
    cat = await Category.create({ name: 'Test Decor', slug: 'test-decor' });
  }
  testCategoryId = cat._id.toString();

  // Create an authorized seller
  const sellerEmail = `seller_${Date.now()}@rescrafted-products.test`;
  const sellerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Test Artisan',
      email: sellerEmail,
      password: 'SecurePassword123',
      role: 'seller',
    });
  sellerToken = sellerRes.body.data.token;

  // Create a customer
  const customerEmail = `cust_${Date.now()}@rescrafted-products.test`;
  const customerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Regular Customer',
      email: customerEmail,
      password: 'SecurePassword123',
    });
  customerToken = customerRes.body.data.token;
});

test.after(async () => {
  await User.deleteMany({ email: /.*@rescrafted-products\.test$/ });
  await Product.deleteMany({ title: 'Upcycled Denim Travel Tote' });
});

test('GET /api/v1/categories returns list of categories', async () => {
  const res = await request(app).get('/api/v1/categories');

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length > 0);
  assert.ok(res.body.data[0].slug);
});

test('GET /api/v1/products returns paginated catalog', async () => {
  const res = await request(app).get('/api/v1/products?limit=6');

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.meta);
  assert.strictEqual(res.body.meta.limit, 6);
  assert.ok(res.body.meta.total > 0);
});

test('GET /api/v1/products filters by condition', async () => {
  const res = await request(app).get('/api/v1/products?condition=upcycled');

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  res.body.data.forEach((p) => {
    assert.strictEqual(p.condition, 'upcycled');
  });
});

test('GET /api/v1/products/:slug returns product and related items', async () => {
  const product = await Product.findOne({ status: 'published' });
  assert.ok(product, 'A published product must exist in the database');

  const res = await request(app).get(`/api/v1/products/${product.slug}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.product.slug, product.slug);
  assert.ok(res.body.data.product.pricePaise > 0);
  assert.ok(Array.isArray(res.body.data.relatedProducts));
});

test('POST /api/v1/products creates product when authorized as seller', async () => {
  const res = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      title: 'Upcycled Denim Travel Tote',
      description: 'Handcrafted from rescued blue jeans with industrial brass copper rivets and durable lining.',
      pricePaise: 159900, // ₹1,599.00
      compareAtPricePaise: 219900,
      categoryId: testCategoryId,
      condition: 'upcycled',
      materials: ['Recycled Blue Denim', 'Brass Rivets'],
      sustainabilitySpecs: {
        recycledPercentage: 95,
        repairabilityIndex: 8,
        estimatedCo2SavedKg: 5.4,
        estimatedWasteDivertedKg: 1.1,
      },
      stockQuantity: 10,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
          publicId: 'test_tote_1',
          isPrimary: true,
        },
      ],
    });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.title, 'Upcycled Denim Travel Tote');
  assert.ok(res.body.data.slug);
  createdProductId = res.body.data._id;
});

test('PATCH /api/v1/products/:id rejects updates by unauthorized customer', async () => {
  const res = await request(app)
    .patch(`/api/v1/products/${createdProductId}`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      pricePaise: 99900,
    });

  // Customer does not have 'seller' role
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
});
