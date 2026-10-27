const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middlewares/authenticate');
const validateRequest = require('../middlewares/validateRequest');
const { authLimiter } = require('../middlewares/rateLimiter');
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  updateProfileSchema,
} = require('../validators/authValidators');

const router = express.Router();

// Public authentication routes (with auth rate limiter)
router.post(
  '/register',
  authLimiter,
  validateRequest(registerSchema),
  authController.register
);

router.post(
  '/login',
  authLimiter,
  validateRequest(loginSchema),
  authController.login
);

router.post(
  '/verify-email',
  validateRequest(verifyEmailSchema),
  authController.verifyEmail
);

router.post(
  '/resend-otp',
  authLimiter,
  validateRequest(resendOtpSchema),
  authController.resendOtp
);

router.post(
  '/forgot-password',
  authLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  '/reset-password/:token',
  authLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

// Authenticated session routes
router.use(authenticate);

router.get('/me', authController.getMe);
router.post('/logout', authController.logout);

// Role verification probe
const authorize = require('../middlewares/authorize');
router.get('/admin-check', authorize('admin'), (req, res) => {
  res.json({ success: true, message: 'Admin authorization verified' });
});

router.patch(
  '/update-password',
  validateRequest(updatePasswordSchema),
  authController.updatePassword
);

router.patch(
  '/update-profile',
  validateRequest(updateProfileSchema),
  authController.updateProfile
);

module.exports = router;
