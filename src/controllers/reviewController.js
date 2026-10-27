const reviewService = require('../services/reviewService');

class ReviewController {
  async createReview(req, res, next) {
    try {
      const review = await reviewService.createReview(req.user._id, req.body);
      res.status(201).json({
        success: true,
        message: 'Verified review submitted successfully',
        data: { review }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductReviews(req, res, next) {
    try {
      const result = await reviewService.getProductReviews(
        req.params.productId,
        req.query
      );
      res.status(200).json({
        success: true,
        message: 'Product reviews retrieved',
        data: {
          reviews: result.reviews,
          ratingDistribution: result.ratingDistribution
        },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async checkEligibility(req, res, next) {
    try {
      const eligibility = await reviewService.checkPurchaseEligibility(
        req.user?._id,
        req.params.productId
      );
      res.status(200).json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteReview(req, res, next) {
    try {
      const result = await reviewService.deleteReview(
        req.params.id,
        req.user._id,
        req.user.role
      );
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  async moderateReview(req, res, next) {
    try {
      const review = await reviewService.moderateReview(
        req.user._id,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: `Review status updated to ${req.body.status}`,
        data: { review }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProductImpact(req, res, next) {
    try {
      const assessment = await reviewService.getProductImpactAssessment(
        req.params.productId
      );
      res.status(200).json({
        success: true,
        message: 'Product LCA impact assessment retrieved',
        data: assessment
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
