import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { vi } from 'vitest';
import { validateRequest } from './zodValidation';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('validateRequest middleware', () => {
  it('parses valid body and calls next', () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validateRequest(schema);
    const req = { body: { email: 'client@example.com' } } as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ email: 'client@example.com' });
  });

  it('returns 400 when schema validation fails', () => {
    const schema = z.object({ email: z.string().email() });
    const middleware = validateRequest(schema);
    const req = { body: { email: 'invalid-email' } } as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation Error',
        details: expect.any(Array),
      })
    );
  });
});
