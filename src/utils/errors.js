// src/utils/errors.js

/**
 * Operational (known) application errors.
 * These are safe to send to the client.
 */
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details; // Optional extra info (validation errors, etc.)
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 404 shorthand
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404);
  }
}

/**
 * 409 shorthand (duplicate / conflict)
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = { AppError, NotFoundError, ConflictError };
