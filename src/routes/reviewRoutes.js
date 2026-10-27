const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validateRequest = require('../middlewares/validateRequest');
const {
  createReviewSchema,
  moderateReviewSchema
} = require('../validators/reviewValidators');

// Public endpoints
router.get('/product/:productId', reviewController.getProductReviews);
router.get('/product/:productId/impact', reviewController.getProductImpact);

// Customer endpoints (Protected)
router.get(
  '/product/:productId/eligibility',
  authenticate,
  reviewController.checkEligibility
);

router.post(
  '/',
  authenticate,
  validateRequest(createReviewSchema),
  reviewController.createReview
);

router.delete('/:id', authenticate, reviewController.deleteReview);

// Admin moderation endpoint
router.patch(
  '/:id/moderate',
  authenticate,
  authorize('admin'),
  validateRequest(moderateReviewSchema),
  reviewController.moderateReview
);

module.exports = router;
