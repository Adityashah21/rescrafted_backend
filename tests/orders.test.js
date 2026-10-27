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
const Order = require('../src/models/Order');

let customerToken = '';
let customerId = '';
let otherToken = '';
let otherCustomerId = '';
let testProduct = null;
let testAddressId = '';
let createdOrderId = '';
let initialStock = 0;

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // 1. Create main customer
  const customerEmail = `order_shopper_${Date.now()}@rescrafted-orders.test`;
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Order Shopper',
      email: customerEmail,
      password: 'SecurePassword123'
    });

  customerToken = registerRes.body.data.token;
  customerId = registerRes.body.data.user._id;

  // 2. Create another customer for authorization checks
  const otherEmail = `other_shopper_${Date.now()}@rescrafted-orders.test`;
  const otherRegisterRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Other Shopper',
      email: otherEmail,
      password: 'SecurePassword123'
    });

  otherToken = otherRegisterRes.body.data.token;
  otherCustomerId = otherRegisterRes.body.data.user._id;

  // 3. Find a test product
  testProduct = await Product.findOne({ status: 'published', stockQuantity: { $gt: 5 } });
  assert.ok(testProduct, 'Must have at least one published product with stock > 5');
  initialStock = testProduct.stockQuantity;

  // 4. Create an address for the main customer
  const addrRes = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      fullName: 'Order Shopper',
      phone: '+91 9876543210',
      addressLine1: '42 Eco Harmony Street',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      isDefault: true
    });

  testAddressId = addrRes.body.data._id;
});

test.after(async () => {
  if (customerId) {
    await User.findByIdAndDelete(customerId);
    await Cart.deleteMany({ userId: customerId });
    await Address.deleteMany({ userId: customerId });
    await Order.deleteMany({ customerId });
  }
  if (otherCustomerId) {
    await User.findByIdAndDelete(otherCustomerId);
    await Cart.deleteMany({ userId: otherCustomerId });
  }
});

test('POST /api/v1/orders rejects order creation when cart is empty', async () => {
  const res = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      shippingAddressId: testAddressId,
      paymentMethod: 'cod'
    });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/orders rejects order with non-existent shipping address', async () => {
  // First add an item to cart
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId: testProduct._id.toString(),
      quantity: 1
    });

  const fakeAddressId = new mongoose.Types.ObjectId().toString();
  const res = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      shippingAddressId: fakeAddressId,
      paymentMethod: 'cod'
    });

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/orders creates order, decrements stock, and empties cart', async () => {
  // Snapshot current stock right before placing order to avoid cross-suite race condition
  const currentProd = await Product.findById(testProduct._id);
  initialStock = currentProd.stockQuantity;

  const res = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      shippingAddressId: testAddressId,
      paymentMethod: 'cod',
      notes: 'Please leave package at the front porch'
    });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  const order = res.body.data.order;
  assert.ok(order._id);
  assert.match(order.orderNumber, /^RC-/);
  assert.strictEqual(order.orderStatus, 'confirmed');
  assert.strictEqual(order.paymentStatus, 'pending');
  assert.ok(order.sellerFulfillments.length > 0);
  assert.strictEqual(order.sellerFulfillments[0].items[0].quantity, 1);
  assert.ok(order.pricing.totalPaise > 0);

  createdOrderId = order._id;

  // Verify stock was decremented
  const updatedProduct = await Product.findById(testProduct._id);
  assert.strictEqual(updatedProduct.stockQuantity, initialStock - 1);

  // Verify cart is now empty
  const cartRes = await request(app)
    .get('/api/v1/cart')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(cartRes.body.data.itemCount, 0);
});

test('GET /api/v1/orders returns customer order list', async () => {
  const res = await request(app)
    .get('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.orders.length >= 1);
  assert.strictEqual(res.body.data.orders[0]._id, createdOrderId);
});

test('GET /api/v1/orders/:id retrieves specific order details', async () => {
  const res = await request(app)
    .get(`/api/v1/orders/${createdOrderId}`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.order._id, createdOrderId);
  assert.strictEqual(res.body.data.order.shippingAddressSnapshot.city, 'Bangalore');
});

test('GET /api/v1/orders/:id rejects unauthorized access by another user', async () => {
  const res = await request(app)
    .get(`/api/v1/orders/${createdOrderId}`)
    .set('Authorization', `Bearer ${otherToken}`);

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/orders/:id/cancel cancels order and restores inventory', async () => {
  const res = await request(app)
    .post(`/api/v1/orders/${createdOrderId}/cancel`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      reason: 'Ordered by mistake, changing color preference'
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.order.orderStatus, 'cancelled');

  // Verify inventory restored
  const restoredProduct = await Product.findById(testProduct._id);
  assert.strictEqual(restoredProduct.stockQuantity, initialStock);
});

test('POST /api/v1/orders/:id/cancel fails if order is already cancelled', async () => {
  const res = await request(app)
    .post(`/api/v1/orders/${createdOrderId}/cancel`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      reason: 'Cancelling again should fail'
    });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});
