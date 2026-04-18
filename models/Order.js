const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, default: 1 },
    totalAmount: { type: Number, required: true },
    utrNumber: { type: String },
    upiId: { type: String }, // seller's UPI ID at time of order
    status: {
        type: String,
        enum: ['pending_utr', 'utr_submitted', 'confirmed', 'rejected', 'cancelled'],
        default: 'pending_utr'
    },
    sellerNote: { type: String }, // rejection reason or confirmation note
    isNotificationRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);