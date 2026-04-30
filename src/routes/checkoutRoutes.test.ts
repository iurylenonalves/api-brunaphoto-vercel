import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  generatePaymentLink: vi.fn((_req: any, res: any) => res.json({ url: 'https://stripe.com/pay/test' })),
  createSession: vi.fn((_req: any, res: any) => res.json({ url: 'https://stripe.com/pay/test' })),
  createManualBooking: vi.fn((_req: any, res: any) => res.json({ reference: 'BK-001' })),
}));

vi.mock('../utils/jwt', () => ({
  verifyJWT: mocks.verifyJWT,
}));

vi.mock('../controllers/checkoutController', () => ({
  CheckoutController: {
    generatePaymentLink: mocks.generatePaymentLink,
    createSession: mocks.createSession,
    createManualBooking: mocks.createManualBooking,
  },
}));

// Mock rateLimit as a passthrough middleware so tests are never throttled
vi.mock('express-rate-limit', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

import checkoutRouter from './checkoutRoutes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/checkout', checkoutRouter);
  return app;
}

describe('checkoutRoutes', () => {
  describe('POST /link (requireAuth + validation)', () => {
    it('returns 401 without authorization header', async () => {
      await request(buildApp()).post('/checkout/link').send({}).expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce(null);
      await request(buildApp())
        .post('/checkout/link')
        .set('Authorization', 'Bearer bad-token')
        .send({})
        .expect(401);
    });

    it('returns 400 when body is missing required fields (auth passes but validation fails)', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .post('/checkout/link')
        .set('Authorization', 'Bearer valid-token')
        .send({}) // missing packageId, paymentType, paymentMethod
        .expect(400);
    });

    it('returns 200 with valid auth and valid body', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .post('/checkout/link')
        .set('Authorization', 'Bearer valid-token')
        .send({ packageId: 'pkg-1', paymentType: 'DEPOSIT', paymentMethod: 'CARD' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('url');
        });
    });
  });

  describe('POST /session (rateLimit + validation, no auth)', () => {
    it('returns 400 when lockedToken is missing', async () => {
      await request(buildApp())
        .post('/checkout/session')
        .send({}) // no lockedToken
        .expect(400);
    });

    it('returns 200 with valid body', async () => {
      await request(buildApp())
        .post('/checkout/session')
        .send({ lockedToken: 'tok.test.value' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('url');
        });
    });

    it('does not require authorization header', async () => {
      await request(buildApp())
        .post('/checkout/session')
        .send({ lockedToken: 'tok.test.value' })
        .expect(200);
    });
  });

  describe('POST /manual (rateLimit + validation, no auth)', () => {
    it('returns 400 when required fields are missing', async () => {
      await request(buildApp())
        .post('/checkout/manual')
        .send({}) // missing lockedToken, customerName, customerEmail
        .expect(400);
    });

    it('returns 400 when customerEmail is invalid', async () => {
      await request(buildApp())
        .post('/checkout/manual')
        .send({ lockedToken: 'tok.test.value', customerName: 'Jane', customerEmail: 'not-an-email' })
        .expect(400);
    });

    it('returns 200 with valid body', async () => {
      await request(buildApp())
        .post('/checkout/manual')
        .send({ lockedToken: 'tok.test.value', customerName: 'Jane Doe', customerEmail: 'jane@example.com' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('reference');
        });
    });

    it('does not require authorization header', async () => {
      await request(buildApp())
        .post('/checkout/manual')
        .send({ lockedToken: 'tok.test.value', customerName: 'Jane Doe', customerEmail: 'jane@example.com' })
        .expect(200);
    });
  });
});
