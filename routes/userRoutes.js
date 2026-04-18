const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { updateBankDetails, getProfile } = require('../controllers/userController');

router.get('/profile', protect, getProfile);
router.put('/bank-details', protect, updateBankDetails);

module.exports = router;