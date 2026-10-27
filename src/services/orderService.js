const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Address = require('../models/Address');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const emailService = require('./emailService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

class OrderService {
  /**
   * Create a new customer order from their active cart
   */
  async createOrder(customerId, { shippingAddressId, paymentMethod = 'cod', notes = '' }) {
    // 1. Fetch active cart
    const cart = await Cart.findOne({ userId: customerId }).populate({
      path: 'items.productId',
      select: 'title slug sku pricePaise compareAtPricePaise stockQuantity images status sellerId'
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError('Cannot create an order with an empty shopping cart', 400);
    }

    // 2. Validate shipping address
    const address = await Address.findOne({ _id: shippingAddressId, userId: customerId });
    if (!address) {
      throw new AppError('Shipping address not found or does not belong to user', 404);
    }

    // 3. Pre-validate stock and published status
    for (const item of cart.items) {
      const product = item.productId;
      if (!product || product.status !== 'published') {
        throw new AppError(`Item in your cart is no longer available`, 400);
      }
      if (product.stockQuantity < item.quantity) {
        throw new AppError(
          `Product "${product.title}" has only ${product.stockQuantity} item(s) in stock. Please adjust your cart.`,
          400
        );
      }
    }

    // 4. Atomic inventory decrement with rollback safeguard
    const decrementedItems = [];
    try {
      for (const item of cart.items) {
        const product = item.productId;
        const updated = await Product.findOneAndUpdate(
          {
            _id: product._id,
            stockQuantity: { $gte: item.quantity },
            status: 'published'
          },
          { $inc: { stockQuantity: -item.quantity } },
          { new: true }
        );

        if (!updated) {
          throw new AppError(
            `Product "${product.title}" became unavailable during checkout. Please try again.`,
            400
          );
        }
        decrementedItems.push({ productId: product._id, quantity: item.quantity });
      }
    } catch (decrementErr) {
      // Rollback any items decremented before failure
      for (const item of decrementedItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: item.quantity }
        });
      }
      throw decrementErr;
    }

    // 5. Group items by Seller Profile for multi-seller fulfillments
    const sellerGroupMap = new Map();
    for (const item of cart.items) {
      const product = item.productId;
      const sellerIdStr = product.sellerId.toString();

      if (!sellerGroupMap.has(sellerIdStr)) {
        sellerGroupMap.set(sellerIdStr, {
          sellerId: product.sellerId,
          items: []
        });
      }

      const effectiveUnitPricePaise = product.pricePaise;

      sellerGroupMap.get(sellerIdStr).items.push({
        productId: product._id,
        title: product.title,
        slug: product.slug,
        sku: product.sku,
        imageUrl: product.images?.[0]?.url || '',
        unitPricePaise: effectiveUnitPricePaise,
        quantity: item.quantity,
        subtotalPaise: effectiveUnitPricePaise * item.quantity
      });
    }

    // Fetch SellerProfile store names
    const sellerIds = Array.from(sellerGroupMap.keys());
    const sellerProfiles = await SellerProfile.find({ _id: { $in: sellerIds } });
    const profileMap = new Map(sellerProfiles.map((sp) => [sp._id.toString(), sp.storeName]));

    const sellerFulfillments = [];
    let subtotalPaise = 0;

    for (const [sellerIdStr, group] of sellerGroupMap.entries()) {
      const storeName = profileMap.get(sellerIdStr) || 'ResCrafted Artisan';
      const groupSubtotal = group.items.reduce((sum, it) => sum + it.subtotalPaise, 0);
      subtotalPaise += groupSubtotal;

      sellerFulfillments.push({
        sellerId: group.sellerId,
        storeNameSnapshot: storeName,
        items: group.items,
        fulfillmentStatus: 'pending'
      });
    }

    // 6. Pricing calculations (Integer paise)
    const FREE_SHIPPING_THRESHOLD_PAISE = 99900; // ₹999.00
    const STANDARD_SHIPPING_PAISE = 9900; // ₹99.00
    const shippingPaise =
      subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_SHIPPING_PAISE;
    const taxPaise = Math.round(subtotalPaise * 0.05); // 5% GST on sustainable crafts
    const discountPaise = 0;
    const totalPaise = subtotalPaise + shippingPaise + taxPaise - discountPaise;

    // 7. Generate unique, human-friendly order number
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestampCode = Date.now().toString(36).toUpperCase();
    const orderNumber = `RC-${timestampCode}-${randomHex}`;

    // 8. Shipping address snapshot
    const shippingAddressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India'
    };

    // 9. Create Order
    const order = await Order.create({
      orderNumber,
      customerId,
      shippingAddressSnapshot,
      sellerFulfillments,
      pricing: {
        subtotalPaise,
        shippingPaise,
        taxPaise,
        discountPaise,
        totalPaise
      },
      paymentStatus: 'pending',
      orderStatus: paymentMethod === 'cod' ? 'confirmed' : 'pending_payment',
      notes: notes || ''
    });

    // 10. Clear customer cart
    cart.items = [];
    await cart.save();

    // 11. Send notification email in background
    User.findById(customerId)
      .select('email')
      .lean()
      .then((user) => {
        if (user && user.email) {
          emailService.sendOrderConfirmationEmail(user.email, order).catch((err) => {
            logger.warn(`Could not dispatch order confirmation email: ${err.message}`);
          });
        }
      })
      .catch((err) => {
        logger.warn(`Error finding user for order email notification: ${err.message}`);
      });

    return order;
  }

  /**
   * Get orders placed by a customer with pagination
   */
  async getUserOrders(customerId, { page = 1, limit = 10, status }) {
    const numericPage = Math.max(1, parseInt(page, 10) || 1);
    const numericLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (numericPage - 1) * numericLimit;

    const query = { customerId };
    if (status) {
      query.orderStatus = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(numericLimit).lean(),
      Order.countDocuments(query)
    ]);

    return {
      orders,
      meta: {
        page: numericPage,
        limit: numericLimit,
        total,
        totalPages: Math.ceil(total / numericLimit) || 1
      }
    };
  }

  /**
   * Get order details by ID with role-based security
   */
  async getOrderById(orderId, userId, userRole = 'customer') {
    let order;
    if (orderId.startsWith('RC-')) {
      order = await Order.findOne({ orderNumber: orderId }).lean();
    } else {
      order = await Order.findById(orderId).lean();
    }

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Role-based authorization
    if (userRole === 'admin') {
      return order;
    }

    if (userRole === 'customer') {
      if (order.customerId.toString() !== userId.toString()) {
        throw new AppError('You do not have permission to view this order', 403);
      }
      return order;
    }

    if (userRole === 'seller') {
      const sellerProfile = await SellerProfile.findOne({ userId });
      if (!sellerProfile) {
        throw new AppError('Seller profile not found', 403);
      }
      const sellerIdStr = sellerProfile._id.toString();
      const hasSellerItems = order.sellerFulfillments.some(
        (f) => f.sellerId.toString() === sellerIdStr
      );
      if (!hasSellerItems) {
        throw new AppError('You do not have any items in this order', 403);
      }
      return order;
    }

    throw new AppError('Unauthorized access', 403);
  }

  /**
   * Cancel an eligible order and restore inventory
   */
  async cancelOrder(orderId, userId, { reason }, userRole = 'customer') {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Authorization
    if (userRole !== 'admin' && order.customerId.toString() !== userId.toString()) {
      throw new AppError('You do not have permission to cancel this order', 403);
    }

    // State machine check
    if (order.orderStatus === 'cancelled') {
      throw new AppError('This order is already cancelled', 400);
    }

    const cancellableStatuses = ['pending_payment', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.orderStatus)) {
      throw new AppError(
        `Order cannot be cancelled because it is in '${order.orderStatus}' status. Only pending or processing orders may be cancelled.`,
        400
      );
    }

    // Restore stock for all products in fulfillment items
    for (const fulfillment of order.sellerFulfillments) {
      for (const item of fulfillment.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stockQuantity: item.quantity }
        });
      }
      fulfillment.fulfillmentStatus = 'cancelled';
      fulfillment.cancelledAt = new Date();
      fulfillment.cancellationReason = reason;
    }

    order.orderStatus = 'cancelled';
    if (order.paymentStatus === 'paid') {
      order.paymentStatus = 'refunded';
    }
    await order.save();

    logger.info(`Order ${order.orderNumber} successfully cancelled by ${userRole} ${userId}`);
    return order;
  }

  /**
   * Update fulfillment status for a seller group
   */
  async updateFulfillmentStatus(
    sellerUserId,
    orderId,
    fulfillmentId,
    { fulfillmentStatus, carrier, trackingNumber, trackingUrl },
    userRole = 'seller'
  ) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    let sellerProfile = null;
    if (userRole !== 'admin') {
      sellerProfile = await SellerProfile.findOne({ userId: sellerUserId });
      if (!sellerProfile) {
        throw new AppError('Seller profile not found', 403);
      }
    }

    const fulfillment = order.sellerFulfillments.id(fulfillmentId);
    if (!fulfillment) {
      throw new AppError('Fulfillment package not found in this order', 404);
    }

    if (userRole !== 'admin') {
      if (fulfillment.sellerId.toString() !== sellerProfile._id.toString()) {
        throw new AppError('You are not authorized to update this fulfillment package', 403);
      }
    }

    // State machine validations
    if (fulfillment.fulfillmentStatus === 'cancelled') {
      throw new AppError('Cannot update status of a cancelled fulfillment package', 400);
    }
    if (fulfillment.fulfillmentStatus === 'delivered' && fulfillmentStatus !== 'delivered') {
      throw new AppError('Delivered packages cannot revert to previous states', 400);
    }

    fulfillment.fulfillmentStatus = fulfillmentStatus;
    if (carrier !== undefined) fulfillment.carrier = carrier;
    if (trackingNumber !== undefined) fulfillment.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) fulfillment.trackingUrl = trackingUrl;

    if (fulfillmentStatus === 'shipped' && !fulfillment.shippedAt) {
      fulfillment.shippedAt = new Date();
    }
    if (fulfillmentStatus === 'delivered' && !fulfillment.deliveredAt) {
      fulfillment.deliveredAt = new Date();
    }

    // Recompute overall order status
    const allStatuses = order.sellerFulfillments.map((f) => f.fulfillmentStatus);
    if (allStatuses.every((s) => s === 'delivered')) {
      order.orderStatus = 'delivered';
    } else if (allStatuses.every((s) => s === 'cancelled')) {
      order.orderStatus = 'cancelled';
    } else if (allStatuses.some((s) => s === 'shipped' || s === 'delivered')) {
      order.orderStatus = 'shipped';
    } else if (allStatuses.some((s) => s === 'processing')) {
      order.orderStatus = 'processing';
    }

    await order.save();
    return order;
  }
}

module.exports = new OrderService();
