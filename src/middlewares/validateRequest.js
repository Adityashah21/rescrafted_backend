const AppError = require('../utils/AppError');

/**
 * Middleware factory to validate request parts with a Zod schema
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} source
 */
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.safeParse(req[source]);
      if (!parsed.success) {
        const errorDetails = parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }));

        return next(
          new AppError('Validation error', 400, 'VALIDATION_ERROR', errorDetails)
        );
      }
      req[source] = parsed.data;
      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = validateRequest;
