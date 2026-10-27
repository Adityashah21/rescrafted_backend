const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Address = require('../src/models/Address');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const Payment = require('../src/models/Payment');

let customerToken = '';
let customerId = '';
let otherCustomerToken = '';
let otherCustomerId = '';
let testProduct = null;
let testAddressId = '';
let createdOrderId = '';
let providerOrderId = '';

test.before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  // 1. Create main customer
  const customerEmail = `payer_${Date.now()}@rescrafted-payments.test`;
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Eco Payer',
      email: customerEmail,
      password: 'SecurePassword123'
    });

  customerToken = registerRes.body.data.token;
  customerId = registerRes.body.data.user._id;

  // 2. Create another customer for authorization checks
  const otherEmail = `other_payer_${Date.now()}@rescrafted-payments.test`;
  const otherRegisterRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Other Payer',
      email: otherEmail,
      password: 'SecurePassword123'
    });

  otherCustomerToken = otherRegisterRes.body.data.token;
  otherCustomerId = otherRegisterRes.body.data.user._id;

  // 3. Find test product
  testProduct = await Product.findOne({ status: 'published', stockQuantity: { $gt: 5 } });
  assert.ok(testProduct, 'Must have at least one published product');

  // 4. Create address
  const addrRes = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      fullName: 'Eco Payer',
      phone: '9876543210',
      addressLine1: '88 Circular Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      isDefault: true
    });

  testAddressId = addrRes.body.data._id;

  // 5. Add product to cart & place online payment order
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      productId: testProduct._id.toString(),
      quantity: 1
    });

  const orderRes = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      shippingAddressId: testAddressId,
      paymentMethod: 'razorpay',
      notes: 'Test order for payment flow'
    });

  assert.strictEqual(orderRes.statusCode, 201);
  createdOrderId = orderRes.body.data.order._id;
});

test.after(async () => {
  if (customerId) {
    await User.findByIdAndDelete(customerId);
    await Cart.deleteMany({ userId: customerId });
    await Address.deleteMany({ userId: customerId });
    await Order.deleteMany({ customerId });
    await Payment.deleteMany({ customerId });
  }
  if (otherCustomerId) {
    await User.findByIdAndDelete(otherCustomerId);
  }
});

test('POST /api/v1/payments/initiate rejects unauthenticated requests with 401', async () => {
  const res = await request(app)
    .post('/api/v1/payments/initiate')
    .send({ orderId: createdOrderId });

  assert.strictEqual(res.statusCode, 401);
});

test('POST /api/v1/payments/initiate initiates gateway order for order owner', async () => {
  const res = await request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ orderId: createdOrderId });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.data.providerOrderId);
  assert.ok(res.body.data.amountPaise > 0);
  assert.strictEqual(res.body.data.currency, 'INR');

  providerOrderId = res.body.data.providerOrderId;
});

test('POST /api/v1/payments/initiate rejects unauthorized customer access with 403', async () => {
  const res = await request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', `Bearer ${otherCustomerToken}`)
    .send({ orderId: createdOrderId });

  assert.strictEqual(res.statusCode, 403);
});

test('POST /api/v1/payments/verify rejects tampered HMAC signature with 400', async () => {
  const res = await request(app)
    .post('/api/v1/payments/verify')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      orderId: createdOrderId,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: 'pay_tampered_123456',
      razorpaySignature: 'invalid_fraudulent_hmac_signature'
    });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/payments/verify successfully captures payment with valid HMAC signature', async () => {
  const fakePaymentId = `pay_${Date.now()}_test`;
  const secret = env.RAZORPAY_KEY_SECRET || 'rzp_mock_secret_key_rescrafted';

  // Compute genuine HMAC SHA-256 signature
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(`${providerOrderId}|${fakePaymentId}`)
    .digest('hex');

  const res = await request(app)
    .post('/api/v1/payments/verify')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      orderId: createdOrderId,
      razorpayOrderId: providerOrderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: validSignature
    });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.order.paymentStatus, 'paid');
  assert.strictEqual(res.body.data.order.orderStatus, 'confirmed');

  // Verify payment record in DB
  const payment = await Payment.findOne({ orderId: createdOrderId });
  assert.ok(payment);
  assert.strictEqual(payment.status, 'captured');
  assert.strictEqual(payment.providerPaymentId, fakePaymentId);
});

test('POST /api/v1/payments/initiate fails when order is already paid', async () => {
  const res = await request(app)
    .post('/api/v1/payments/initiate')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ orderId: createdOrderId });

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('POST /api/v1/payments/webhook rejects payload with invalid signature', async () => {
  const res = await request(app)
    .post('/api/v1/payments/webhook')
    .set('x-razorpay-signature', 'invalid_webhook_signature')
    .send({
      event: 'payment.captured',
      payload: {}
    });

  assert.strictEqual(res.statusCode, 400);
});

test('POST /api/v1/payments/webhook processes payment.captured and handles idempotency', async () => {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || 'rescrafted_webhook_secret_key';
  const eventId = `evt_${Date.now()}`;
  const payload = {
    event: 'payment.captured',
    event_id: eventId,
    payload: {
      order: {
        entity: {
          id: providerOrderId
        }
      },
      payment: {
        entity: {
          id: `pay_${Date.now()}`,
          order_id: providerOrderId
        }
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // First webhook transmission
  const res = await request(app)
    .post('/api/v1/payments/webhook')
    .set('x-razorpay-signature', signature)
    .send(payload);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.data.status, 'success');

  // Duplicate / replay transmission with same eventId
  const duplicateRes = await request(app)
    .post('/api/v1/payments/webhook')
    .set('x-razorpay-signature', signature)
    .send(payload);

  assert.strictEqual(duplicateRes.statusCode, 200);
  assert.strictEqual(duplicateRes.body.data.status, 'already_processed');
});
