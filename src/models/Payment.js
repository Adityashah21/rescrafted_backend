const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      default: 'razorpay'
    },
    providerOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    providerPaymentId: {
      type: String,
      sparse: true,
      index: true
    },
    providerSignature: {
      type: String
    },
    amountPaise: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true
    },
    webhookEvents: [
      {
        eventId: String,
        eventType: String,
        receivedAt: { type: Date, default: Date.now },
        payloadSummary: mongoose.Schema.Types.Mixed
      }
    ]
  },
  {
    timestamps: true
  }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
