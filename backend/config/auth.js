const INSECURE_DEFAULT = 'dev_only_change_me';

// AUTH_JWT_SECRET signs every session token. Falling back to a known default
// would let anyone forge a valid token for any account, so production refuses
// to boot without a real secret instead of just warning and staying up.
function getAuthSecret() {
  const secret = (process.env.AUTH_JWT_SECRET || '').trim();

  if (!secret || secret === INSECURE_DEFAULT) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AUTH_JWT_SECRET is not set (or is the insecure default). Set a strong, random value before starting in production.'
      );
    }
    console.warn('[AUTH] WARNING: AUTH_JWT_SECRET is using the insecure default. Set a strong secret in production.');
    return INSECURE_DEFAULT;
  }

  return secret;
}

module.exports = { getAuthSecret };
