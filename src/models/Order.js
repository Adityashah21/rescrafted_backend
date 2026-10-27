const mongoose = require('mongoose');

const orderItemSnapshotSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    title: { type: String, required: true },
    slug: { type: String, required: true },
    sku: { type: String, required: true },
    imageUrl: { type: String, default: '' },
    unitPricePaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Unit price must be an integer (in paise)'
      }
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    subtotalPaise: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Subtotal must be an integer (in paise)'
      }
    }
  },
  { _id: true }
);

const sellerFulfillmentSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
      index: true
    },
    storeNameSnapshot: { type: String, required: true },
    items: [orderItemSnapshotSchema],
    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    carrier: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    trackingUrl: { type: String, default: '' },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String }
  },
  { _id: true }
);

const pricingBreakdownSchema = new mongoose.Schema(
  {
    subtotalPaise: { type: Number, required: true },
    shippingPaise: { type: Number, required: true, default: 0 },
    taxPaise: { type: Number, required: true, default: 0 },
    discountPaise: { type: Number, required: true, default: 0 },
    totalPaise: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    shippingAddressSnapshot: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' }
    },
    sellerFulfillments: [sellerFulfillmentSchema],
    pricing: {
      type: pricingBreakdownSchema,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },
    orderStatus: {
      type: String,
      enum: [
        'pending_payment',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'return_requested',
        'returned',
        'refunded'
      ],
      default: 'pending_payment',
      index: true
    },
    razorpayOrderId: {
      type: String,
      sparse: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      index: true
    },
    notes: {
      type: String,
      maxlength: 500
    }
  },
  {
    timestamps: true
  }
);

// High-performance compound indexes for customer & seller query paths
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ 'sellerFulfillments.sellerId': 1, createdAt: -1 });
orderSchema.index({ 'sellerFulfillments.items.productId': 1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
