/**
 * Standard API Response helpers
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const payload = {
    success: true,
    message,
    data
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res, statusCode = 500, message = 'An error occurred', errorCode = 'ERROR', details = null) => {
  const payload = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details && { details })
    }
  };

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendError
};
