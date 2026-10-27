const express = require('express');
const cartController = require('../controllers/cartController');
const authenticate = require('../middlewares/authenticate');
const validateRequest = require('../middlewares/validateRequest');
const {
  addToCartSchema,
  updateCartItemSchema,
} = require('../validators/shoppingValidators');

const router = express.Router();

// All cart endpoints require an authenticated session
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', validateRequest(addToCartSchema), cartController.addToCart);
router.patch('/items/:itemId', validateRequest(updateCartItemSchema), cartController.updateCartItem);
router.delete('/items/:itemId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;
