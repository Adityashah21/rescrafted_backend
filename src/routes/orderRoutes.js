const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validateRequest = require('../middlewares/validateRequest');
const {
  createOrderSchema,
  cancelOrderSchema,
  updateFulfillmentSchema
} = require('../validators/orderValidators');

// All order endpoints require authentication
router.use(authenticate);

// Customer endpoints
router.post('/', validateRequest(createOrderSchema), orderController.createOrder);
router.get('/', orderController.getUserOrders);
router.get('/:id', orderController.getOrderById);
router.post('/:id/cancel', validateRequest(cancelOrderSchema), orderController.cancelOrder);

// Seller / Admin fulfillment management
router.patch(
  '/:orderId/fulfillments/:fulfillmentId',
  authorize('seller', 'admin'),
  validateRequest(updateFulfillmentSchema),
  orderController.updateFulfillment
);

module.exports = router;
