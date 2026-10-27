const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createOrderSchema = z.object({
  shippingAddressId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'Invalid shipping address ID format'),
  paymentMethod: z
    .enum(['cod', 'razorpay'], {
      errorMap: () => ({ message: 'Payment method must be either "cod" or "razorpay"' })
    })
    .default('cod'),
  notes: z
    .string()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
    .or(z.literal(''))
});

const cancelOrderSchema = z.object({
  reason: z
    .string({ required_error: 'Cancellation reason is required' })
    .trim()
    .min(3, 'Cancellation reason must be at least 3 characters')
    .max(300, 'Cancellation reason cannot exceed 300 characters')
});

const updateFulfillmentSchema = z.object({
  fulfillmentStatus: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid fulfillment status transition' })
  }),
  carrier: z.string().trim().max(100).optional().or(z.literal('')),
  trackingNumber: z.string().trim().max(100).optional().or(z.literal('')),
  trackingUrl: z.string().url('Must be a valid URL').optional().or(z.literal(''))
});

module.exports = {
  createOrderSchema,
  cancelOrderSchema,
  updateFulfillmentSchema
};
