const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const validateRequest = require('../middlewares/validateRequest');
const {
  initiatePaymentSchema,
  verifyPaymentSchema
} = require('../validators/paymentValidators');

// Razorpay Webhook listener (Public, validated via HMAC signature in header)
router.post('/webhook', paymentController.handleWebhook);

// Protected routes requiring customer session
router.post(
  '/initiate',
  authenticate,
  validateRequest(initiatePaymentSchema),
  paymentController.initiatePayment
);

router.post(
  '/verify',
  authenticate,
  validateRequest(verifyPaymentSchema),
  paymentController.verifyPayment
);

router.get('/order/:orderId', authenticate, paymentController.getPaymentDetails);

module.exports = router;
