const { AppError, ValidationError } = require('./app-error');

function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  if (error?.code === '23P01') {
    error = new AppError('Room is already reserved for this time', { code: 'ROOM_ALREADY_BOOKED', statusCode: 409 });
  } else if (error?.code === '23505') {
    const duplicateRoom = error.constraint === 'rooms_building_id_name_unique';
    const duplicateEmail = error.constraint === 'users_email_unique';
    error = new AppError(
      duplicateRoom ? 'A room with this name already exists in the building' : duplicateEmail ? 'Email is already registered' : 'A record with these values already exists',
      { code: duplicateRoom ? 'ROOM_NAME_ALREADY_EXISTS' : duplicateEmail ? 'EMAIL_TAKEN' : 'UNIQUE_CONSTRAINT_VIOLATION', statusCode: 409 },
    );
  } else if (error?.code === '23503') {
    error = new AppError('A referenced resource does not exist', { code: 'REFERENCED_RESOURCE_NOT_FOUND', statusCode: 404 });
  }

  if (error?.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400 && 'body' in error)) {
    error = new ValidationError([{ location: 'body', field: '_', message: 'Invalid JSON body' }], 'Invalid JSON body');
    error.code = 'INVALID_JSON';
  }

  const knownError = error instanceof AppError;
  const statusCode = knownError ? error.statusCode : 500;
  if (!knownError) console.error(error);

  const payload = {
    error: {
      code: knownError ? error.code : 'INTERNAL_ERROR',
      message: knownError ? error.message : 'Internal server error',
      ...(knownError && error.details !== undefined ? { details: error.details } : {}),
      requestId: req.id,
    },
  };
  res.status(statusCode).json(payload);
}

module.exports = { errorHandler };
