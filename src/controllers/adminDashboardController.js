const dashboardService = require('../services/dashboardService');

class AdminDashboardController {
  async getMetrics(req, res, next) {
    try {
      const data = await dashboardService.getAdminDashboardMetrics();
      res.status(200).json({
        success: true,
        message: 'Platform metrics retrieved successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req, res, next) {
    try {
      const result = await dashboardService.getAdminUsers(req.query);
      res.status(200).json({
        success: true,
        message: 'Users retrieved',
        data: { users: result.users },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req, res, next) {
    try {
      const user = await dashboardService.updateUserStatus(
        req.user._id,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: `User status updated to ${req.body.isActive ? 'active' : 'suspended'}`,
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  async getSellers(req, res, next) {
    try {
      const result = await dashboardService.getAdminSellers(req.query);
      res.status(200).json({
        success: true,
        message: 'Seller profiles retrieved',
        data: { sellers: result.sellers },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSellerStatus(req, res, next) {
    try {
      const profile = await dashboardService.updateSellerStatus(
        req.user._id,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: `Seller application updated to ${req.body.status}`,
        data: { profile }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const Product = require('../models/Product');
      const { status, search, page = 1, limit = 20 } = req.query;
      const numericPage = Math.max(1, parseInt(page, 10) || 1);
      const numericLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (numericPage - 1) * numericLimit;

      const query = {};
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } }
        ];
      }

      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('sellerId', 'storeName')
          .populate('categoryId', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(numericLimit)
          .lean(),
        Product.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        message: 'Platform products retrieved',
        data: { products },
        meta: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages: Math.ceil(total / numericLimit) || 1
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async moderateProduct(req, res, next) {
    try {
      const product = await dashboardService.moderateProduct(
        req.user._id,
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: `Product listing status updated to ${req.body.status}`,
        data: { product }
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const result = await dashboardService.getAdminAuditLogs(req.query);
      res.status(200).json({
        success: true,
        message: 'Audit logs retrieved',
        data: { logs: result.logs },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminDashboardController();
