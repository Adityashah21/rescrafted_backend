const orderService = require('../services/orderService');

class OrderController {
  async createOrder(req, res, next) {
    try {
      const order = await orderService.createOrder(req.user._id, req.body);
      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserOrders(req, res, next) {
    try {
      const result = await orderService.getUserOrders(req.user._id, req.query);
      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: { orders: result.orders },
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const order = await orderService.getOrderById(
        req.params.id,
        req.user._id,
        req.user.role
      );
      res.status(200).json({
        success: true,
        message: 'Order retrieved successfully',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const order = await orderService.cancelOrder(
        req.params.id,
        req.user._id,
        req.body,
        req.user.role
      );
      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateFulfillment(req, res, next) {
    try {
      const order = await orderService.updateFulfillmentStatus(
        req.user._id,
        req.params.orderId,
        req.params.fulfillmentId,
        req.body,
        req.user.role
      );
      res.status(200).json({
        success: true,
        message: 'Fulfillment status updated successfully',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
