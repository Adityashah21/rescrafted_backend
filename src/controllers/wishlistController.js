const wishlistService = require('../services/wishlistService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await wishlistService.getWishlist(req.user._id);
  return sendSuccess(res, 200, 'Wishlist retrieved successfully.', wishlist);
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const wishlist = await wishlistService.addToWishlist(req.user._id, productId);
  return sendSuccess(res, 200, 'Product added to wishlist.', wishlist);
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const wishlist = await wishlistService.removeFromWishlist(req.user._id, productId);
  return sendSuccess(res, 200, 'Product removed from wishlist.', wishlist);
});

const moveToCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const result = await wishlistService.moveToCart(req.user._id, productId);
  return sendSuccess(res, 200, result.message);
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
};
