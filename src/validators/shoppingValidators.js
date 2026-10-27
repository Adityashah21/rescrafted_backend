const { z } = require('zod');

const addToCartSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Cannot add more than 50 units at once'),
});

const updateCartItemSchema = z.object({
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(50, 'Cannot exceed 50 units'),
});

const addToWishlistSchema = z.object({
  productId: z.string({ required_error: 'Product ID is required' }).regex(/^[0-9a-fA-F]{24}$/, 'Invalid Product ID'),
});

const createAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+ -]{10,15}$/, 'Please enter a valid phone number'),
  addressLine1: z.string().trim().min(3, 'Address line 1 is required'),
  addressLine2: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  postalCode: z.string().trim().regex(/^[0-9]{6}$/, 'Postal code must be exactly 6 digits'),
  country: z.string().trim().default('India').optional(),
  isDefault: z.boolean().default(false).optional(),
});

const updateAddressSchema = createAddressSchema.partial();

module.exports = {
  addToCartSchema,
  updateCartItemSchema,
  addToWishlistSchema,
  createAddressSchema,
  updateAddressSchema,
};
