import type { Request, Response } from 'express';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  bookingDelete: vi.fn(),
  sendBookingConfirmation: vi.fn(),
}));

vi.mock('../database/client', () => ({
  prisma: {
    booking: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
      delete: mocks.bookingDelete,
    },
  },
}));

vi.mock('../services/EmailService', () => ({
  sendBookingConfirmation: mocks.sendBookingConfirmation,
}));

import { getAllBookings, confirmBookingPayment, deleteBooking } from './bookingController';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function createBooking(overrides?: Record<string, unknown>) {
  return {
    id: 'booking-1',
    status: 'pending',
    paymentType: 'DEPOSIT',
    amountPaid: 0,
    currency: 'GBP',
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    locale: 'en',
    stripeSessionId: null,
    sessionDate: null,
    package: {
      id: 'pkg-1',
      name: 'Essential',
      totalPrice: 300,
      depositPrice: 100,
    },
    ...overrides,
  };
}

describe('bookingController', () => {
  describe('getAllBookings', () => {
    it('returns all bookings ordered by createdAt desc', async () => {
      const bookings = [createBooking()];
      mocks.findMany.mockResolvedValueOnce(bookings);
      const req = {} as Request;
      const res = createMockResponse();

      await getAllBookings(req, res);

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { package: true } })
      );
      expect(res.json).toHaveBeenCalledWith(bookings);
    });

    it('returns 500 on database error', async () => {
      mocks.findMany.mockRejectedValueOnce(new Error('DB error'));
      const req = {} as Request;
      const res = createMockResponse();

      await getAllBookings(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch bookings' });
    });
  });

  describe('confirmBookingPayment', () => {
    it('returns 404 when booking is not found', async () => {
      mocks.findUnique.mockResolvedValueOnce(null);
      const req = { params: { id: 'missing' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Booking not found' });
    });

    it('returns 400 when booking is already paid', async () => {
      mocks.findUnique.mockResolvedValueOnce(createBooking({ status: 'paid' }));
      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Booking is already paid' });
    });

    it('uses package depositPrice when amountPaid is 0 and paymentType is DEPOSIT', async () => {
      const booking = createBooking({ amountPaid: 0, paymentType: 'DEPOSIT' });
      mocks.findUnique.mockResolvedValueOnce(booking);
      const updated = { ...booking, status: 'paid', amountPaid: 100 };
      mocks.update.mockResolvedValueOnce(updated);
      mocks.sendBookingConfirmation.mockResolvedValueOnce(undefined);

      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paid', amountPaid: 100 }),
        })
      );
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('uses package totalPrice when amountPaid is 0 and paymentType is FULL', async () => {
      const booking = createBooking({ amountPaid: 0, paymentType: 'FULL' });
      mocks.findUnique.mockResolvedValueOnce(booking);
      mocks.update.mockResolvedValueOnce({ ...booking, status: 'paid', amountPaid: 300 });
      mocks.sendBookingConfirmation.mockResolvedValueOnce(undefined);

      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'paid', amountPaid: 300 }),
        })
      );
    });

    it('calculates balance as totalPrice minus depositPrice when paymentType is BALANCE', async () => {
      const booking = createBooking({ amountPaid: 0, paymentType: 'BALANCE' });
      mocks.findUnique.mockResolvedValueOnce(booking);
      mocks.update.mockResolvedValueOnce({ ...booking, status: 'paid' });
      mocks.sendBookingConfirmation.mockResolvedValueOnce(undefined);

      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      const updateCall = mocks.update.mock.calls[0][0];
      expect(Number(updateCall.data.amountPaid)).toBe(200); // 300 - 100
    });

    it('sends confirmation email when customerEmail is present', async () => {
      const booking = createBooking({ amountPaid: 0, paymentType: 'DEPOSIT' });
      mocks.findUnique.mockResolvedValueOnce(booking);
      mocks.update.mockResolvedValueOnce({ ...booking, status: 'paid' });
      mocks.sendBookingConfirmation.mockResolvedValueOnce(undefined);

      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(mocks.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'jane@example.com',
          packageName: 'Essential',
          paymentType: 'DEPOSIT',
        })
      );
    });

    it('does not send email when customerEmail is absent', async () => {
      const booking = createBooking({ customerEmail: null });
      mocks.findUnique.mockResolvedValueOnce(booking);
      mocks.update.mockResolvedValueOnce({ ...booking, status: 'paid' });

      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(mocks.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected database error', async () => {
      mocks.findUnique.mockRejectedValueOnce(new Error('DB error'));
      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await confirmBookingPayment(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to confirm booking' });
    });
  });

  describe('deleteBooking', () => {
    it('deletes booking and responds with 204', async () => {
      mocks.bookingDelete.mockResolvedValueOnce(undefined);
      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await deleteBooking(req, res);

      expect(mocks.bookingDelete).toHaveBeenCalledWith({ where: { id: 'booking-1' } });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 on database error', async () => {
      mocks.bookingDelete.mockRejectedValueOnce(new Error('DB error'));
      const req = { params: { id: 'booking-1' } } as unknown as Request;
      const res = createMockResponse();

      await deleteBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to delete booking' });
    });
  });
});
