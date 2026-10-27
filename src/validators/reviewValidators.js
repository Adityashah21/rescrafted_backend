const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createReviewSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .regex(objectIdRegex, 'Invalid Product ID format'),
  rating: z
    .number({ required_error: 'Rating is required' })
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1 star')
    .max(5, 'Rating cannot exceed 5 stars'),
  title: z
    .string()
    .max(100, 'Title cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),
  comment: z
    .string({ required_error: 'Review comment is required' })
    .trim()
    .min(5, 'Review comment must be at least 5 characters')
    .max(1000, 'Review comment cannot exceed 1000 characters'),
  images: z.array(z.string().url()).optional().default([])
});

const moderateReviewSchema = z.object({
  status: z.enum(['approved', 'flagged', 'hidden'], {
    errorMap: () => ({ message: 'Status must be approved, flagged, or hidden' })
  })
});

module.exports = {
  createReviewSchema,
  moderateReviewSchema
};
