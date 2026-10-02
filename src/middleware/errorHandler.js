// src/middleware/errorHandler.js
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

/**
 * Central Express error handler.
 * Catches all errors passed via next(err).
 */
const errorHandler = (err, req, res, next) => {
  // ─── Mongoose Validation Error ────────────────────────────
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      status: 'fail',
      message: 'Validation failed',
      details,
    });
  }

  // ─── Mongoose Duplicate Key ───────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      status: 'fail',
      message: `Duplicate value for '${field}'. Please use a different value.`,
    });
  }

  // ─── Mongoose Cast Error (invalid ObjectId) ───────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      status: 'fail',
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // ─── Multer File Size Limit ───────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'fail',
      message: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 5}MB allowed.`,
    });
  }

  // ─── JWT Errors ───────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ status: 'fail', message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ status: 'fail', message: 'Token expired.' });
  }

  // ─── Operational (AppError) ───────────────────────────────
  if (err.isOperational) {
    const response = {
      status: err.status,
      message: err.message,
    };
    if (err.details) response.details = err.details;
    return res.status(err.statusCode).json(response);
  }

  // ─── Unknown / Programming Error ─────────────────────────
  logger.error('UNHANDLED ERROR', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    status: 'error',
    message: isProd ? 'Something went wrong. Please try again later.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
