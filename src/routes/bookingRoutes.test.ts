import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  getAllBookings: vi.fn((_req: any, res: any) => res.json([])),
  confirmBookingPayment: vi.fn((_req: any, res: any) => res.json({ ok: true })),
  deleteBooking: vi.fn((_req: any, res: any) => res.status(204).send()),
}));

vi.mock('../utils/jwt', () => ({
  verifyJWT: mocks.verifyJWT,
}));

vi.mock('../controllers/bookingController', () => ({
  getAllBookings: mocks.getAllBookings,
  confirmBookingPayment: mocks.confirmBookingPayment,
  deleteBooking: mocks.deleteBooking,
}));

import bookingRouter from './bookingRoutes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/bookings', bookingRouter);
  return app;
}

describe('bookingRoutes – authentication enforcement', () => {
  describe('GET /', () => {
    it('returns 401 without authorization header', async () => {
      await request(buildApp()).get('/bookings').expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce(null);
      await request(buildApp())
        .get('/bookings')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);
    });

    it('returns 200 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .get('/bookings')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('POST /:id/confirm', () => {
    it('returns 401 without authorization header', async () => {
      await request(buildApp()).post('/bookings/booking-1/confirm').expect(401);
    });

    it('returns 200 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .post('/bookings/booking-1/confirm')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);
    });
  });

  describe('DELETE /:id', () => {
    it('returns 401 without authorization header', async () => {
      await request(buildApp()).delete('/bookings/booking-1').expect(401);
    });

    it('returns 204 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .delete('/bookings/booking-1')
        .set('Authorization', 'Bearer valid-token')
        .expect(204);
    });
  });
});
