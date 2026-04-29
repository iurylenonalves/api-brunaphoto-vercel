import type { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
}));

vi.mock('../utils/jwt', () => ({
  verifyJWT: mocks.verifyJWT,
}));

import { requireAuth } from './auth';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth middleware', () => {
  it('returns 401 when authorization header is missing', () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    requireAuth(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', () => {
    mocks.verifyJWT.mockReturnValueOnce(null);
    const req = { headers: { authorization: 'Bearer invalid-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    requireAuth(req as any, res, next);

    expect(mocks.verifyJWT).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to request and calls next when token is valid', () => {
    mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@example.com' });
    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    requireAuth(req as any, res, next);

    expect((req as any).user).toEqual({ userId: 'u1', email: 'admin@example.com' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});