const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    initiateOrder,
    submitUTR,
    updateOrderStatus,
    getSellerOrders,
    getBuyerOrders,
    markNotificationsRead,
    getUnreadCount,
    cancelOrder
} = require('../controllers/orderController');

router.post('/initiate', protect, initiateOrder);
router.post('/submit-utr', protect, submitUTR);
router.put('/status', protect, updateOrderStatus);
router.get('/seller', protect, getSellerOrders);
router.get('/buyer', protect, getBuyerOrders);
router.put('/notifications/read', protect, markNotificationsRead);
router.get('/notifications/count', protect, getUnreadCount);
router.put('/cancel/:id', protect, cancelOrder);

module.exports = router;