const crypto = require('node:crypto');

function tokenConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured.');

  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const match = /^(\d+)(s|m|h|d)?$/.exec(expiresIn);
  if (!match || Number(match[1]) <= 0) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration (for example, 15m).');
  }
  const units = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = Number(match[1]) * units[match[2] || 's'];
  if (!Number.isSafeInteger(seconds)) throw new Error('JWT_EXPIRES_IN is too large.');
  return { secret, expiresIn, seconds };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input, secret) {
  return crypto.createHmac('sha256', secret).update(input).digest();
}

function signAccessToken(user, now = Math.floor(Date.now() / 1000)) {
  const config = tokenConfig();
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: String(user.id),
    role: user.role,
    iat: now,
    exp: now + config.seconds,
  });
  const input = `${header}.${payload}`;
  const token = `${input}.${signature(input, config.secret).toString('base64url')}`;
  return { token, expiresIn: config.expiresIn };
}

function verifyAccessToken(token, now = Math.floor(Date.now() / 1000)) {
  const config = tokenConfig();
  if (typeof token !== 'string') throw new Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  let header;
  let payload;
  let receivedSignature;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    receivedSignature = Buffer.from(parts[2], 'base64url');
  } catch {
    throw new Error('Invalid token');
  }

  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') throw new Error('Invalid token');
  const expectedSignature = signature(`${parts[0]}.${parts[1]}`, config.secret);
  if (receivedSignature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new Error('Invalid token');
  }
  if (typeof payload?.sub !== 'string' || !payload.sub
    || !['USER', 'ADMIN'].includes(payload.role)
    || !Number.isSafeInteger(payload.iat)
    || !Number.isSafeInteger(payload.exp)
    || payload.iat > now + 60) {
    throw new Error('Invalid token');
  }
  if (payload.exp <= now) {
    const error = new Error('Token expired');
    error.code = 'TOKEN_EXPIRED';
    throw error;
  }
  return payload;
}

module.exports = { signAccessToken, verifyAccessToken, tokenConfig };
