const bcrypt = require('bcryptjs');
const { ConflictError, AppError } = require('../../errors/app-error');
const { signAccessToken, tokenConfig } = require('./jwt');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-user-password', 10);
const invalidCredentials = () => new AppError('Invalid email or password', {
  code: 'INVALID_CREDENTIALS',
  statusCode: 401,
});

function createAuthService(usersRepository) {
  tokenConfig();
  return {
    async register({ email, password }) {
      const passwordHash = await bcrypt.hash(password, 10);
      try {
        return await usersRepository.create({ email, passwordHash, role: 'USER' });
      } catch (error) {
        if (error?.code === '23505' && error?.constraint === 'users_email_unique') {
          throw new ConflictError('Email is already registered', 'EMAIL_TAKEN');
        }
        throw error;
      }
    },
    async login({ email, password }) {
      const user = await usersRepository.findByEmail(email);
      const passwordWithinBcryptLimit = Buffer.byteLength(password, 'utf8') <= 72;
      const passwordMatches = await bcrypt.compare(
        passwordWithinBcryptLimit ? password : '',
        user?.passwordHash || DUMMY_PASSWORD_HASH,
      );
      if (!user || !passwordWithinBcryptLimit || !passwordMatches) throw invalidCredentials();

      const { token, expiresIn } = signAccessToken(user);
      return { accessToken: token, tokenType: 'Bearer', expiresIn };
    },
    async me(id) {
      const user = await usersRepository.findById(id);
      if (!user) throw new AppError('Authentication required', { code: 'UNAUTHORIZED', statusCode: 401 });
      return user;
    },
  };
}

module.exports = { createAuthService };
