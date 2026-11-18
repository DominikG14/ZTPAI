const { AppError } = require('../../errors/app-error');
const { verifyAccessToken } = require('./jwt');

function unauthorized() {
  return new AppError('Authentication required', { code: 'UNAUTHORIZED', statusCode: 401 });
}

function requireAuth(req, _res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
  if (!match) return next(unauthorized());
  try {
    const payload = verifyAccessToken(match[1]);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    if (error?.code === 'TOKEN_EXPIRED') {
      return next(new AppError('Token expired', { code: 'TOKEN_EXPIRED', statusCode: 401 }));
    }
    if (error?.message === 'JWT_SECRET must be configured.') return next(error);
    return next(unauthorized());
  }
}

module.exports = { requireAuth };
