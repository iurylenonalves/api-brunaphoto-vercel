import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/HttpError';
import { errorHandlerMiddleware } from './error-handler';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandlerMiddleware', () => {
  it('returns HttpError status and message', () => {
    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    errorHandlerMiddleware(new HttpError(404, 'Not found'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 for regular Error instances', () => {
    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    errorHandlerMiddleware(new Error('Unexpected failure'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unexpected failure' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns unknown error fallback for non-Error values', () => {
    const req = {} as Request;
    const res = createMockResponse();
    const next = vi.fn() as NextFunction;

    errorHandlerMiddleware('boom', req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unknown error' });
    expect(next).not.toHaveBeenCalled();
  });
});
