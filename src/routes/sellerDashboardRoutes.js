const express = require('express');
const router = express.Router();
const sellerDashboardController = require('../controllers/sellerDashboardController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Only authorized sellers or admins can access seller dashboard endpoints
router.use(authenticate, authorize('seller', 'admin'));

router.get('/dashboard', sellerDashboardController.getDashboard);
router.get('/orders', sellerDashboardController.getOrders);
router.patch('/profile', sellerDashboardController.updateProfile);

module.exports = router;
