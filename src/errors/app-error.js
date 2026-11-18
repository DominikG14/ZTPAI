class AppError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', statusCode = 500, details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(details, message = 'Validation failed') {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, details });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, { code, statusCode: 404 });
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, { code, statusCode: 409 });
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError };
