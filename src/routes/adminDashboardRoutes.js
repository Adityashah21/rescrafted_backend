const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

// Only administrators can access admin console endpoints
router.use(authenticate, authorize('admin'));

router.get('/metrics', adminDashboardController.getMetrics);
router.get('/users', adminDashboardController.getUsers);
router.patch('/users/:id/status', adminDashboardController.updateUserStatus);
router.get('/sellers', adminDashboardController.getSellers);
router.patch('/sellers/:id/status', adminDashboardController.updateSellerStatus);
router.get('/products', adminDashboardController.getProducts);
router.patch('/products/:id/moderate', adminDashboardController.moderateProduct);
router.get('/audit-logs', adminDashboardController.getAuditLogs);

module.exports = router;
