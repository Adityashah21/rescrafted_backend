const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fallback to HttpOnly cookie
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(
      new AppError(
        'You are not logged in. Please sign in to access this resource.',
        401,
        'UNAUTHORIZED'
      )
    );
  }

  // 3. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(
        new AppError('Your session has expired. Please sign in again.', 401, 'TOKEN_EXPIRED')
      );
    }
    return next(
      new AppError('Invalid authentication token. Please sign in again.', 401, 'INVALID_TOKEN')
    );
  }

  // 4. Check if user still exists in database
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user account belonging to this session no longer exists.',
        401,
        'USER_NOT_FOUND'
      )
    );
  }

  // 5. Check if account is active/suspended
  if (!currentUser.isActive) {
    return next(
      new AppError('Your account has been deactivated. Please contact support.', 403, 'ACCOUNT_DEACTIVATED')
    );
  }

  // 6. Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'Password recently changed. Please sign in again with your new credentials.',
        401,
        'PASSWORD_CHANGED'
      )
    );
  }

  // Grant access and attach user to request object
  req.user = currentUser;
  next();
});

module.exports = authenticate;
