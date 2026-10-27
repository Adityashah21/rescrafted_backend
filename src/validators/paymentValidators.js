const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const initiatePaymentSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .trim()
    .regex(objectIdRegex, 'Invalid order ID format')
});

const verifyPaymentSchema = z.object({
  orderId: z
    .string({ required_error: 'Order ID is required' })
    .trim()
    .regex(objectIdRegex, 'Invalid order ID format'),
  razorpayOrderId: z
    .string({ required_error: 'Razorpay order ID is required' })
    .trim()
    .min(1, 'Razorpay order ID cannot be empty'),
  razorpayPaymentId: z
    .string({ required_error: 'Razorpay payment ID is required' })
    .trim()
    .min(1, 'Razorpay payment ID cannot be empty'),
  razorpaySignature: z
    .string({ required_error: 'Razorpay signature is required' })
    .trim()
    .min(1, 'Razorpay signature cannot be empty')
});

module.exports = {
  initiatePaymentSchema,
  verifyPaymentSchema
};
