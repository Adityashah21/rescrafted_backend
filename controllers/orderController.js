const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Validate UTR format (12 digit number)
const isValidUTR = (utr) => {
    const utrRegex = /^[0-9]{12}$/;
    return utrRegex.test(utr.toString().trim());
};

// STEP 1: Buyer initiates order - get seller UPI details
exports.initiateOrder = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ message: 'Product and quantity are required.' });
        }

        const product = await Product.findById(productId).populate('seller', 'name email phoneNumber bankDetails');
        if (!product) return res.status(404).json({ message: 'Product not found.' });

        if (product.stock < quantity) {
            return res.status(400).json({ message: `Only ${product.stock} units available.` });
        }

        // Check if seller has UPI
        const sellerUPI = product.seller?.bankDetails?.upiId;
        if (!sellerUPI) {
            return res.status(400).json({
                message: 'Seller has not set up their UPI ID yet. Please contact the seller directly.',
                sellerEmail: product.seller?.email
            });
        }

        const totalAmount = product.price * quantity;

        // Create pending order
        const order = new Order({
            buyer: req.user._id,
            seller: product.seller._id,
            product: productId,
            quantity,
            totalAmount,
            upiId: sellerUPI,
            status: 'pending_utr'
        });
        await order.save();

        res.status(200).json({
            orderId: order._id,
            totalAmount,
            sellerUPI,
            sellerName: product.seller.name,
            productTitle: product.title,
            quantity
        });
    } catch (error) {
        console.error('Initiate Order Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// STEP 2: Buyer submits UTR after payment
exports.submitUTR = async (req, res) => {
    try {
        const { orderId, utrNumber } = req.body;

        if (!orderId || !utrNumber) {
            return res.status(400).json({ message: 'Order ID and UTR number are required.' });
        }

        // Validate UTR format
        if (!isValidUTR(utrNumber)) {
            return res.status(400).json({
                message: 'Invalid UTR number. UTR must be exactly 12 digits.'
            });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found.' });

        if (order.buyer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        if (order.status !== 'pending_utr') {
            return res.status(400).json({ message: 'UTR already submitted for this order.' });
        }

        // Check for duplicate UTR
        const existingUTR = await Order.findOne({
            utrNumber: utrNumber.trim(),
            status: { $in: ['utr_submitted', 'confirmed'] }
        });
        if (existingUTR) {
            return res.status(400).json({ message: 'This UTR number has already been used.' });
        }

        order.utrNumber = utrNumber.trim();
        order.status = 'utr_submitted';
        order.isNotificationRead = false; // notify seller
        await order.save();

        res.status(200).json({
            message: 'UTR submitted successfully! Waiting for seller confirmation.',
            order
        });
    } catch (error) {
        console.error('Submit UTR Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// STEP 3: Seller confirms or rejects
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId, action, note } = req.body;

        if (!['confirmed', 'rejected'].includes(action)) {
            return res.status(400).json({ message: 'Action must be confirmed or rejected.' });
        }

        const order = await Order.findById(orderId)
            .populate('product')
            .populate('buyer', 'name email');

        if (!order) return res.status(404).json({ message: 'Order not found.' });

        if (order.seller.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        if (order.status !== 'utr_submitted') {
            return res.status(400).json({ message: 'Can only confirm/reject orders with submitted UTR.' });
        }

        order.status = action;
        order.sellerNote = note || '';
        order.isNotificationRead = false; // notify buyer

        if (action === 'confirmed') {
            // Reduce stock
            await Product.findByIdAndUpdate(order.product._id, {
                $inc: { stock: -order.quantity }
            });
        }

        await order.save();

        res.status(200).json({
            message: `Order ${action} successfully.`,
            order
        });
    } catch (error) {
        console.error('Update Order Status Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get Seller Orders (incoming)
exports.getSellerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ seller: req.user._id })
            .populate('buyer', 'name email phoneNumber')
            .populate('product', 'title price images unit')
            .sort({ createdAt: -1 });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Buyer Orders
exports.getBuyerOrders = async (req, res) => {
    try {
        const orders = await Order.find({ buyer: req.user._id })
            .populate('seller', 'name email')
            .populate('product', 'title price images unit')
            .sort({ createdAt: -1 });

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark seller notifications as read
exports.markNotificationsRead = async (req, res) => {
    try {
        await Order.updateMany(
            { seller: req.user._id, isNotificationRead: false },
            { isNotificationRead: true }
        );
        res.status(200).json({ message: 'Marked as read.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Order.countDocuments({
            seller: req.user._id,
            isNotificationRead: false,
            status: 'utr_submitted'
        });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Cancel order (buyer)
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found.' });

        if (order.buyer.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        if (!['pending_utr', 'utr_submitted'].includes(order.status)) {
            return res.status(400).json({ message: 'Cannot cancel this order.' });
        }

        order.status = 'cancelled';
        await order.save();

        res.status(200).json({ message: 'Order cancelled.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};