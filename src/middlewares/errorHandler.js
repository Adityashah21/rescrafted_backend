const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const env = require('../config/env');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const message = `Duplicate value entered for ${field}. Please use another value.`;
  return new AppError(message, 409, 'DUPLICATE_FIELD', { field });
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => ({
    field: el.path,
    message: el.message
  }));
  return new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';

  // Log error with logger
  if (error.statusCode >= 500) {
    logger.error({
      err: {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
      }
    });
  } else {
    logger.warn({
      statusCode: error.statusCode,
      message: err.message,
      url: req.originalUrl
    });
  }

  // Handle Mongoose / DB specific errors
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  const isOperational = error.isOperational || error instanceof AppError;

  return res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.errorCode,
      message: isOperational
        ? error.message
        : env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again later.'
        : error.message,
      ...(error.details && { details: error.details }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
