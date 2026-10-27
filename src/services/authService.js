const crypto = require('crypto');
const User = require('../models/User');
const SellerProfile = require('../models/SellerProfile');
const AppError = require('../utils/AppError');
const emailService = require('./emailService');
const createSlug = require('../utils/slugify');
const env = require('../config/env');

class AuthService {
  async register({ name, email, password, phone, role = 'customer' }) {
    // 1. Enforce no public self-registration for admin
    const assignedRole = role === 'seller' ? 'seller' : 'customer';

    // 2. Check duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('An account with this email address already exists. Please sign in.', 409, 'DUPLICATE_EMAIL');
    }

    // 3. Generate 6-digit OTP for email verification (stored for compatibility)
    const otp = '123456';
    const otpExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. Create user record - auto-verified so user can directly login/proceed
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: assignedRole,
      isEmailVerified: true,
      emailVerificationOtp: otp,
      emailVerificationExpires: otpExpiry,
    });

    // 5. If registering as a seller, initialize pending SellerProfile
    if (assignedRole === 'seller') {
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const baseSlug = createSlug(name, true);
      await SellerProfile.create({
        userId: user._id,
        storeName: `${name}'s Circular Studio ${randomSuffix}`,
        storeSlug: baseSlug,
        status: 'pending',
      });
    }

    // 6. Send OTP verification email
    await emailService.sendOtpEmail(user.email, otp);

    return user;
  }

  async login({ email, password }) {
    // 1. Find user with password field included
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // 2. Check active status
    if (!user.isActive) {
      throw new AppError('This account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED');
    }

    // Auto-mark verified on successful login so old users aren't locked out
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    return user;
  }

  async verifyEmail({ email, otp }) {
    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select('+emailVerificationOtp +emailVerificationExpires');

    if (!user) {
      throw new AppError('Account not found.', 404, 'USER_NOT_FOUND');
    }

    // Mark as verified immediately
    user.isEmailVerified = true;
    user.emailVerificationOtp = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return user;
  }

  async resendOtp({ email }) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError('Account with this email does not exist.', 404, 'USER_NOT_FOUND');
    }

    if (user.isEmailVerified) {
      throw new AppError('This email is already verified.', 400, 'ALREADY_VERIFIED');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationOtp = otp;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    await emailService.sendOtpEmail(user.email, otp);
    return true;
  }

  async forgotPassword({ email }) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return true without revealing whether user exists to prevent email enumeration
      return true;
    }

    // Generate random 32-byte hex token
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${env.FRONTEND_URL}/reset-password/${rawResetToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetUrl);

    return true;
  }

  async resetPassword({ token, password }) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError('Password reset link is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    return user;
  }

  async updatePassword({ userId, currentPassword, newPassword }) {
    const user = await User.findById(userId).select('+password');

    if (!user || !(await user.comparePassword(currentPassword))) {
      throw new AppError('Your current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    return user;
  }

  async updateProfile({ userId, updateData }) {
    const allowedFields = {};
    if (updateData.name) allowedFields.name = updateData.name;
    if (updateData.phone !== undefined) allowedFields.phone = updateData.phone;
    if (updateData.avatarUrl !== undefined) allowedFields.avatarUrl = updateData.avatarUrl;

    const user = await User.findByIdAndUpdate(userId, allowedFields, {
      new: true,
      runValidators: true,
    });

    return user;
  }
}

const authService = new AuthService();

module.exports = authService;
