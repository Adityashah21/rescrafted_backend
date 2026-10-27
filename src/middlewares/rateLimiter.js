const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

// General API rate limiter: 300 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next) => {
    next(
      new AppError(
        'Too many requests from this IP, please try again in 15 minutes.',
        429,
        'RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

// Stricter rate limiter for authentication routes: 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (req, res, next) => {
    next(
      new AppError(
        'Too many authentication attempts, please try again in 15 minutes.',
        429,
        'AUTH_RATE_LIMIT_EXCEEDED'
      )
    );
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};
