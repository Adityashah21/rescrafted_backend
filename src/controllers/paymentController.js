const paymentService = require('../services/paymentService');

class PaymentController {
  async initiatePayment(req, res, next) {
    try {
      const data = await paymentService.initiatePayment(req.user._id, req.body.orderId);
      res.status(200).json({
        success: true,
        message: 'Payment order initiated successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(req, res, next) {
    try {
      const result = await paymentService.verifyPayment(req.user._id, req.body);
      res.status(200).json({
        success: true,
        message: 'Payment signature verified and captured',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const result = await paymentService.handleWebhook({
        rawBody,
        signature,
        payload: req.body
      });
      res.status(200).json({
        success: true,
        message: 'Webhook processed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getPaymentDetails(req, res, next) {
    try {
      const payment = await paymentService.getPaymentByOrderId(
        req.params.orderId,
        req.user._id,
        req.user.role
      );
      res.status(200).json({
        success: true,
        message: 'Payment details retrieved',
        data: { payment }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
