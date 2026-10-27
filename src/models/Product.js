const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    isPrimary: { type: Boolean, default: false }
  },
  { _id: false }
);

const sustainabilitySpecsSchema = new mongoose.Schema(
  {
    recycledPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    materialsReused: [{ type: String, trim: true }],
    repairabilityIndex: {
      type: Number,
      min: 1,
      max: 10,
      default: 5
    },
    packagingType: {
      type: String,
      enum: ['zero_waste', 'biodegradable', 'recycled_cardboard', 'standard'],
      default: 'recycled_cardboard'
    },
    weightGrams: {
      type: Number,
      min: 0,
      default: 0
    },
    estimatedCo2SavedKg: {
      type: Number,
      min: 0,
      default: 0
    },
    estimatedWasteDivertedKg: {
      type: Number,
      min: 0,
      default: 0
    },
    certifications: [
      {
        name: { type: String, trim: true },
        issuingBody: { type: String, trim: true },
        verified: { type: Boolean, default: false }
      }
    ]
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters']
    },
    pricePaise: {
      type: Number,
      required: [true, 'Price is required'],
      min: [100, 'Price must be at least ₹1 (100 paise)'],
      validate: {
        validator: Number.isInteger,
        message: 'Price in paise must be an integer'
      },
      index: true
    },
    compareAtPricePaise: {
      type: Number,
      validate: {
        validator: function (val) {
          return val == null || (Number.isInteger(val) && val >= this.pricePaise);
        },
        message: 'Compare-at price must be greater than or equal to current price'
      }
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    condition: {
      type: String,
      enum: ['upcycled', 'recycled', 'refurbished', 'pre-owned'],
      required: [true, 'Condition is required'],
      index: true
    },
    materials: [{ type: String, trim: true }],
    sustainabilitySpecs: {
      type: sustainabilitySpecsSchema,
      default: () => ({})
    },
    dimensions: {
      lengthCm: { type: Number, min: 0, default: 0 },
      widthCm: { type: Number, min: 0, default: 0 },
      heightCm: { type: Number, min: 0, default: 0 }
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: [0, 'Stock quantity cannot be negative'],
      default: 0
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    images: {
      type: [imageSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one product image is required'
      }
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
      default: 'draft',
      index: true
    },
    ratingsSummary: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      reviewCount: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for search
productSchema.index(
  {
    title: 'text',
    description: 'text',
    materials: 'text'
  },
  {
    weights: {
      title: 10,
      materials: 5,
      description: 2
    },
    name: 'ProductTextIndex'
  }
);

// Compound indexes for catalog sorting and filtering
productSchema.index({ status: 1, categoryId: 1, pricePaise: 1 });
productSchema.index({ status: 1, condition: 1, createdAt: -1 });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
