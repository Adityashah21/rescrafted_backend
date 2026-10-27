const AppError = require('../utils/AppError');

/**
 * Restricts access to specified roles
 * @param  {...string} roles - e.g. 'admin', 'seller'
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action.',
          403,
          'FORBIDDEN'
        )
      );
    }
    next();
  };
};

module.exports = authorize;
