const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const authenticate = require('../middlewares/authenticate');
const validateRequest = require('../middlewares/validateRequest');
const { addToWishlistSchema } = require('../validators/shoppingValidators');

const router = express.Router();

router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/items', validateRequest(addToWishlistSchema), wishlistController.addToWishlist);
router.delete('/items/:productId', wishlistController.removeFromWishlist);
router.post('/move-to-cart/:productId', wishlistController.moveToCart);

module.exports = router;
