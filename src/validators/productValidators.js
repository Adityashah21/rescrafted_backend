const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(60),
  description: z.string().trim().optional(),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  parentCategory: z.string().nullable().optional(),
  isSustainabilityCategory: z.boolean().default(false).optional(),
});

const imageSchema = z.object({
  url: z.string().url('Invalid image URL'),
  publicId: z.string().min(1, 'Public ID is required'),
  isPrimary: z.boolean().default(false).optional(),
});

const sustainabilitySpecsSchema = z.object({
  recycledPercentage: z.number().min(0).max(100).default(0).optional(),
  materialsReused: z.array(z.string().trim()).default([]).optional(),
  repairabilityIndex: z.number().min(1).max(10).default(5).optional(),
  packagingType: z
    .enum(['zero_waste', 'biodegradable', 'recycled_cardboard', 'standard'])
    .default('recycled_cardboard')
    .optional(),
  weightGrams: z.number().min(0).default(0).optional(),
  estimatedCo2SavedKg: z.number().min(0).default(0).optional(),
  estimatedWasteDivertedKg: z.number().min(0).default(0).optional(),
  certifications: z
    .array(
      z.object({
        name: z.string().trim(),
        issuingBody: z.string().trim(),
        verified: z.boolean().default(false),
      })
    )
    .default([])
    .optional(),
});

const createProductSchema = z.object({
  title: z
    .string({ required_error: 'Product title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters'),
  pricePaise: z
    .number()
    .int('Price in paise must be a whole integer')
    .min(100, 'Price must be at least ₹1 (100 paise)'),
  compareAtPricePaise: z.number().int().optional().nullable(),
  categoryId: z.string({ required_error: 'Category ID is required' }),
  subcategoryId: z.string().optional().nullable(),
  condition: z.enum(['upcycled', 'recycled', 'refurbished', 'pre-owned']),
  materials: z.array(z.string().trim()).min(1, 'At least one material must be specified'),
  sustainabilitySpecs: sustainabilitySpecsSchema.optional(),
  dimensions: z
    .object({
      lengthCm: z.number().min(0).default(0).optional(),
      widthCm: z.number().min(0).default(0).optional(),
      heightCm: z.number().min(0).default(0).optional(),
    })
    .optional(),
  stockQuantity: z
    .number({ required_error: 'Stock quantity is required' })
    .int()
    .min(0, 'Stock cannot be negative'),
  sku: z.string().trim().toUpperCase().optional(),
  images: z.array(imageSchema).min(1, 'At least one product image is required'),
  status: z.enum(['draft', 'pending_review', 'published']).default('published').optional(),
});

const updateProductSchema = createProductSchema.partial();

const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  condition: z.enum(['upcycled', 'recycled', 'refurbished', 'pre-owned']).optional(),
  minPrice: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  maxPrice: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  minRating: z.string().optional().transform((val) => (val ? parseFloat(val) : undefined)),
  materials: z.string().trim().optional(),
  sellerId: z.string().trim().optional(),
  sort: z
    .enum(['newest', 'price_asc', 'price_desc', 'rating', 'popular'])
    .default('newest')
    .optional(),
  page: z.string().default('1').transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z.string().default('12').transform((val) => Math.min(50, Math.max(1, parseInt(val, 10) || 12))),
});

module.exports = {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
};
