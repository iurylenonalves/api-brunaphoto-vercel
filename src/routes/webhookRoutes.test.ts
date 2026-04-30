import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  handleWebhook: vi.fn((_req: any, res: any) => res.json({ received: true })),
}));

vi.mock('../controllers/checkoutController', () => ({
  CheckoutController: {
    handleWebhook: mocks.handleWebhook,
  },
}));

import webhookRouter from './webhookRoutes';

function buildApp() {
  const app = express();
  // Replicate the rawBody verify callback from src/middleware.ts so req.rawBody is available
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );
  app.use('/webhooks', webhookRouter);
  return app;
}

describe('webhookRoutes', () => {
  describe('POST /stripe', () => {
    it('returns 200 without any authorization header (public endpoint)', async () => {
      await request(buildApp())
        .post('/webhooks/stripe')
        .send({ type: 'payment_intent.succeeded' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('received', true);
        });
    });

    it('calls handleWebhook controller', async () => {
      await request(buildApp())
        .post('/webhooks/stripe')
        .send({ type: 'checkout.session.completed' });

      expect(mocks.handleWebhook).toHaveBeenCalledTimes(1);
    });

    it('passes rawBody to the request (for Stripe signature verification)', async () => {
      const payload = JSON.stringify({ type: 'checkout.session.completed' });

      mocks.handleWebhook.mockImplementationOnce((req: any, res: any) => {
        expect(req.rawBody).toBe(payload);
        res.json({ received: true });
      });

      await request(buildApp())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(200);
    });
  });
});
