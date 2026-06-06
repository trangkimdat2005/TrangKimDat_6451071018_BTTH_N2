const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function errorHandler(err, req, res, next) {
  logger.error('Error occurred', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      },
    });
  }

  if (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Facebook access token has expired. Please refresh the token.',
        statusCode: 401,
      },
    });
  }

  if (err.code === 'INVALID_TOKEN') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Facebook access token is invalid.',
        statusCode: 401,
      },
    });
  }

  if (err.code === 'RATE_LIMIT' || err.code === 'APP_RATE_LIMIT') {
    return res.status(429).json({
      success: false,
      error: {
        code: err.code,
        message: 'Facebook API rate limit exceeded. Please try again later.',
        statusCode: 429,
      },
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'NETWORK_ERROR') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unable to connect to Facebook API. Please try again later.',
        statusCode: 503,
      },
    });
  }

  if (err.status === 400 || err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: err.message || 'Invalid request',
        statusCode: 400,
      },
    });
  }

  if (err.status === 404 || err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        statusCode: 404,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      statusCode: 500,
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      statusCode: 404,
    },
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
