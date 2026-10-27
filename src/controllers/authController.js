const authService = require('../services/authService');
const { sendTokenResponse } = require('../utils/generateToken');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return sendTokenResponse(
    user,
    201,
    res,
    'Registration successful. Please verify your email with the OTP sent.'
  );
});

const login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.body);
  return sendTokenResponse(user, 200, res, 'Logged in successfully.');
});

const logout = asyncHandler(async (req, res) => {
  res.cookie('token', 'logged_out', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  return sendSuccess(res, 200, 'Logged out successfully.');
});

const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, 'Profile retrieved.', {
    user: req.user,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const user = await authService.verifyEmail(req.body);
  return sendTokenResponse(user, 200, res, 'Email verified successfully.');
});

const resendOtp = asyncHandler(async (req, res) => {
  await authService.resendOtp(req.body);
  return sendSuccess(res, 200, 'A new verification code has been sent to your email.');
});

const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  return sendSuccess(
    res,
    200,
    'If an account exists with that email, a password reset link has been dispatched.'
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const user = await authService.resetPassword({ token, password });
  return sendTokenResponse(user, 200, res, 'Password reset successful. You are now signed in.');
});

const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await authService.updatePassword({
    userId: req.user._id,
    currentPassword,
    newPassword,
  });
  return sendTokenResponse(user, 200, res, 'Password updated successfully.');
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile({
    userId: req.user._id,
    updateData: req.body,
  });
  return sendSuccess(res, 200, 'Profile updated successfully.', { user });
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendOtp,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateProfile,
};
