const mongoose = require('mongoose');

const productReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    reason: {
      type: String,
      enum: ['inaccurate_sustainability_claims', 'counterfeit', 'prohibited_item', 'misleading_pricing', 'other'],
      required: true
    },
    details: {
      type: String,
      required: [true, 'Report explanation is required'],
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'dismissed', 'action_taken'],
      default: 'pending',
      index: true
    },
    moderatorNotes: {
      type: String,
      trim: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

const ProductReport = mongoose.model('ProductReport', productReportSchema);

module.exports = ProductReport;
