const dashboardService = require('../services/dashboardService');

class SellerDashboardController {
  async getDashboard(req, res, next) {
    try {
      const data = await dashboardService.getSellerDashboard(req.user._id);
      res.status(200).json({
        success: true,
        message: 'Seller dashboard retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req, res, next) {
    try {
      const result = await dashboardService.getSellerOrders(req.user._id, req.query);
      res.status(200).json({
        success: true,
        message: 'Seller fulfillment orders retrieved',
        data: { orders: result.orders },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const profile = await dashboardService.updateSellerProfile(req.user._id, req.body);
      res.status(200).json({
        success: true,
        message: 'Seller store profile updated successfully',
        data: { profile }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SellerDashboardController();
