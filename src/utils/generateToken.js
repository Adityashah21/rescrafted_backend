const jwt = require('jsonwebtoken');
const env = require('../config/env');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN || '7d',
    }
  );
};

const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user);

  // Cookie expiration: 7 days
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  res.cookie('token', token, cookieOptions);

  // Sanitize user object (remove sensitive fields)
  const sanitizedUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
  };

  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      user: sanitizedUser,
      token,
    },
  });
};

module.exports = {
  generateToken,
  sendTokenResponse,
};
