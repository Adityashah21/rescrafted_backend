const cartService = require('../services/cartService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user._id);
  return sendSuccess(res, 200, 'Cart retrieved successfully.', cart);
});

const addToCart = asyncHandler(async (req, res) => {
  const cart = await cartService.addToCart(req.user._id, req.body);
  return sendSuccess(res, 200, 'Item added to cart.', cart);
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  const cart = await cartService.updateCartItem(req.user._id, itemId, quantity);
  return sendSuccess(res, 200, 'Cart item updated.', cart);
});

const removeCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const cart = await cartService.removeCartItem(req.user._id, itemId);
  return sendSuccess(res, 200, 'Item removed from cart.', cart);
});

const clearCart = asyncHandler(async (req, res) => {
  const result = await cartService.clearCart(req.user._id);
  return sendSuccess(res, 200, result.message);
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
