const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const razorpayProvider = require('./payment/razorpayProvider');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class PaymentService {
  /**
   * Initiate a Razorpay payment order for a customer's order
   */
  async initiatePayment(customerId, orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.customerId.toString() !== customerId.toString()) {
      throw new AppError('You do not have permission to pay for this order', 403);
    }

    if (order.paymentStatus === 'paid') {
      throw new AppError('This order has already been paid for', 400);
    }

    if (order.orderStatus === 'cancelled') {
      throw new AppError('Cannot initiate payment for a cancelled order', 400);
    }

    // Call payment provider abstraction
    const providerOrder = await razorpayProvider.createOrder({
      amountPaise: order.pricing.totalPaise,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        customerId: customerId.toString()
      }
    });

    // Record or update payment record
    let payment = await Payment.findOne({ orderId: order._id, status: 'created' });
    if (!payment) {
      payment = await Payment.create({
        orderId: order._id,
        customerId,
        provider: 'razorpay',
        providerOrderId: providerOrder.id,
        amountPaise: order.pricing.totalPaise,
        currency: 'INR',
        status: 'created',
        idempotencyKey: `init_${order._id}_${Date.now()}`
      });
    } else {
      payment.providerOrderId = providerOrder.id;
      payment.amountPaise = order.pricing.totalPaise;
      await payment.save();
    }

    // Attach provider order ID to Order snapshot
    order.razorpayOrderId = providerOrder.id;
    await order.save();

    logger.info(`Payment initiated for order ${order.orderNumber} with provider order ${providerOrder.id}`);

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      providerOrderId: providerOrder.id,
      amountPaise: order.pricing.totalPaise,
      currency: 'INR',
      keyId: razorpayProvider.keyId
    };
  }

  /**
   * Verify server-side HMAC signature for an online payment
   */
  async verifyPayment(
    customerId,
    { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
  ) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (order.customerId.toString() !== customerId.toString()) {
      throw new AppError('You do not have permission to verify this order payment', 403);
    }

    // Signature verification against secret
    const isValidSignature = razorpayProvider.verifySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    });

    if (!isValidSignature) {
      await Payment.findOneAndUpdate(
        { orderId: order._id },
        { status: 'failed', providerPaymentId: razorpayPaymentId }
      );
      throw new AppError('Payment signature verification failed. Potential fraud attempt detected.', 400);
    }

    // Update payment document
    let payment = await Payment.findOne({ orderId: order._id });
    if (!payment) {
      payment = new Payment({
        orderId: order._id,
        customerId,
        provider: 'razorpay',
        providerOrderId: razorpayOrderId,
        amountPaise: order.pricing.totalPaise,
        currency: 'INR'
      });
    }

    payment.providerPaymentId = razorpayPaymentId;
    payment.providerSignature = razorpaySignature;
    payment.status = 'captured';
    await payment.save();

    // Transition Order state machine
    order.paymentStatus = 'paid';
    if (order.orderStatus === 'pending_payment') {
      order.orderStatus = 'confirmed';
    }
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save();

    logger.info(`Payment successfully verified and captured for order ${order.orderNumber}`);

    return {
      order,
      payment
    };
  }

  /**
   * Process asynchronous webhooks sent by the payment gateway
   */
  async handleWebhook({ rawBody, signature, payload }) {
    // 1. Signature Verification
    const isValid = razorpayProvider.verifyWebhookSignature({
      rawBody,
      signature
    });

    if (!isValid) {
      logger.warn('Razorpay webhook signature verification failed.');
      throw new AppError('Invalid webhook signature', 400);
    }

    const event = payload.event;
    const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    const providerOrderId = orderEntity?.id || paymentEntity?.order_id;
    const providerPaymentId = paymentEntity?.id;

    if (!providerOrderId && !providerPaymentId) {
      logger.warn('Webhook payload missing order and payment identifiers.');
      return { status: 'ignored', message: 'No identifier found in payload' };
    }

    // 2. Find Payment Record
    let payment = await Payment.findOne({
      $or: [
        ...(providerOrderId ? [{ providerOrderId }] : []),
        ...(providerPaymentId ? [{ providerPaymentId }] : [])
      ]
    });

    if (!payment) {
      logger.warn(`No payment record found for webhook providerOrderId: ${providerOrderId}`);
      return { status: 'ignored', message: 'Payment record not found' };
    }

    // 3. Replay Protection / Idempotency Check
    const alreadyProcessed = payment.webhookEvents.some((e) => e.eventId === eventId);
    if (alreadyProcessed) {
      logger.info(`Webhook event ${eventId} already processed. Skipping duplicate execution.`);
      return { status: 'already_processed', eventId };
    }

    // 4. State Machine Transitions based on Event
    const order = await Order.findById(payment.orderId);

    switch (event) {
      case 'payment.captured':
        payment.status = 'captured';
        if (providerPaymentId) payment.providerPaymentId = providerPaymentId;
        if (order) {
          order.paymentStatus = 'paid';
          if (order.orderStatus === 'pending_payment') {
            order.orderStatus = 'confirmed';
          }
          await order.save();
        }
        break;

      case 'payment.failed':
        payment.status = 'failed';
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'failed';
          await order.save();
        }
        break;

      case 'refund.processed':
        payment.status = 'refunded';
        if (order) {
          order.paymentStatus = 'refunded';
          await order.save();
        }
        break;

      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    // 5. Append event to audit log for replay tracking
    payment.webhookEvents.push({
      eventId,
      eventType: event,
      receivedAt: new Date(),
      payloadSummary: {
        providerOrderId,
        providerPaymentId,
        status: payment.status
      }
    });

    await payment.save();
    logger.info(`Webhook event ${event} (${eventId}) processed successfully for order ${order?.orderNumber}`);

    return {
      status: 'success',
      event,
      eventId
    };
  }

  /**
   * Get payment details associated with an order
   */
  async getPaymentByOrderId(orderId, userId, userRole = 'customer') {
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (userRole !== 'admin' && order.customerId.toString() !== userId.toString()) {
      throw new AppError('You do not have permission to view payment details for this order', 403);
    }

    const payment = await Payment.findOne({ orderId }).lean();
    return payment;
  }
}

module.exports = new PaymentService();
