import { vi } from 'vitest';

type JwtModule = typeof import('./jwt');

async function importJwtModuleWithSecret(secret: string | undefined): Promise<JwtModule> {
  vi.resetModules();

  if (secret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = secret;
  }

  return import('./jwt');
}

describe('jwt utils', () => {
  const previousJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  it('generates and verifies a valid JWT', async () => {
    const jwtModule = await importJwtModuleWithSecret('phase3-jwt-secret');

    const token = jwtModule.generateJWT({
      userId: 'u-1',
      email: 'admin@example.com',
    });

    const decoded = jwtModule.verifyJWT(token);

    expect(decoded).toMatchObject({
      userId: 'u-1',
      email: 'admin@example.com',
    });
  });

  it('returns null for invalid JWT', async () => {
    const jwtModule = await importJwtModuleWithSecret('phase3-jwt-secret');

    expect(jwtModule.verifyJWT('not-a-valid-token')).toBeNull();
  });

  it('throws on import when JWT_SECRET is missing', async () => {
    await expect(importJwtModuleWithSecret(undefined)).rejects.toThrow(
      'JWT_SECRET is not defined in the environment variables.'
    );
  });
});
