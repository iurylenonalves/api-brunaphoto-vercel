import type { Request, Response } from 'express';
import { vi } from 'vitest';
import type { RequestHandler } from 'express';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  findUnique: vi.fn(),
  createUser: vi.fn(),
  generateJWT: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mocks.verifyIdToken,
  })),
}));

vi.mock('../database/client', () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      create: mocks.createUser,
    },
  },
}));

vi.mock('../utils/jwt', () => ({
  generateJWT: mocks.generateJWT,
}));

let googleAuth: RequestHandler;

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('googleAuth controller', () => {
  beforeAll(async () => {
    process.env.ALLOWED_ADMINS = 'admin@example.com';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    vi.resetModules();
    ({ googleAuth } = await import('./authController'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when credential is missing', async () => {
    const req = { body: {} } as Request;
    const res = createMockResponse();

    await googleAuth(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for non-admin emails', async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'client@example.com' }),
    });

    const req = { body: { credential: 'google-token' } } as Request;
    const res = createMockResponse();

    await googleAuth(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns token for allowed admin user', async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'admin@example.com', name: 'Admin', picture: 'avatar' }),
    });
    mocks.findUnique.mockResolvedValueOnce({ id: 'u1', email: 'admin@example.com' });
    mocks.generateJWT.mockReturnValueOnce('jwt-token');
    const req = { body: { credential: 'google-token' } } as Request;
    const res = createMockResponse();

    await googleAuth(req, res, vi.fn());

    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
    expect(res.json).toHaveBeenCalledWith({ token: 'jwt-token' });
  });
});