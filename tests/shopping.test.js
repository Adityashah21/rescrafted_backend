const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Address = require('../src/models/Address');
const Cart = require('../src/models/Cart');
const Wishlist = require('../src/models/Wishlist');

let customerToken = '';
let customerId = '';
let testProduct = null;
let cartItemId = '';
let createdAddressId = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // Create test customer
  const customerEmail = `shopper_${Date.now()}@rescrafted-shopping.test`;
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Eco Shopper',
      email: customerEmail,
      password: 'SecurePassword123',
    });

  customerToken = registerRes.body.data.token;
  customerId = registerRes.body.data.user._id;

  // Find a published product
  testProduct = await Product.findOne({ status: 'published' });
  assert.ok(testProduct, 'Must have at least one published product in DB');
});

test.after(async () => {
  if (customerId) {
    await User.findByIdAndDelete(customerId);
    await Cart.deleteMany({ userId: customerId });
    await Wishlist.deleteMany({ userId: customerId });
    await Address.deleteMany({ userId: customerId });
  }
});

test('GET /api/v1/cart returns empty cart initially', async () => {
  const res = await request(app)
    .get('/api/v1/cart')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.itemCount, 0);
  assert.strictEqual(res.body.data.summary.subtotalPaise, 0);
});

test('POST /api/v1/cart/items adds product and calculates accurate paise totals', async () => {
  const res = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId: testProduct._id.toString(),
      quantity: 2,
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.itemCount, 2);
  assert.strictEqual(res.body.data.items.length, 1);

  cartItemId = res.body.data.items[0]._id;
  const expectedSubtotal = testProduct.pricePaise * 2;
  assert.strictEqual(res.body.data.summary.subtotalPaise, expectedSubtotal);
  assert.ok(res.body.data.summary.totalPaise > expectedSubtotal); // Includes tax / shipping
});

test('PATCH /api/v1/cart/items/:itemId modifies item quantity', async () => {
  const res = await request(app)
    .patch(`/api/v1/cart/items/${cartItemId}`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      quantity: 3,
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.itemCount, 3);
  assert.strictEqual(res.body.data.summary.subtotalPaise, testProduct.pricePaise * 3);
});

test('DELETE /api/v1/cart/items/:itemId removes product from cart', async () => {
  const res = await request(app)
    .delete(`/api/v1/cart/items/${cartItemId}`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.itemCount, 0);
});

test('POST /api/v1/wishlist/items adds product to wishlist', async () => {
  const res = await request(app)
    .post('/api/v1/wishlist/items')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId: testProduct._id.toString(),
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.count, 1);
});

test('DELETE /api/v1/wishlist/items/:productId removes product from wishlist', async () => {
  const res = await request(app)
    .delete(`/api/v1/wishlist/items/${testProduct._id}`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.count, 0);
});

test('POST /api/v1/addresses creates address with default flag', async () => {
  const res = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      fullName: 'Aarav Patel',
      phone: '9876543210',
      addressLine1: 'Flat 402, Green Meadows',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
    });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.isDefault, true); // First address is default
  createdAddressId = res.body.data._id;
});

test('GET /api/v1/addresses retrieves user addresses', async () => {
  const res = await request(app)
    .get('/api/v1/addresses')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].city, 'Bengaluru');
});
