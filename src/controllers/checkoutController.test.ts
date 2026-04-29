import type { Request, Response } from 'express';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findPackage: vi.fn(),
  createBooking: vi.fn(),
  createCheckoutSession: vi.fn(),
  constructEvent: vi.fn(),
  getClient: vi.fn(),
  sendBookingConfirmation: vi.fn(),
  sendAdminBookingNotification: vi.fn(),
  generatePaymentLinkToken: vi.fn(),
  verifyPaymentLinkToken: vi.fn(),
}));

vi.mock('../database/client', () => ({
  prisma: {
    package: {
      findUnique: mocks.findPackage,
    },
    booking: {
      create: mocks.createBooking,
    },
  },
}));

vi.mock('../services/StripeService', () => ({
  StripeService: {
    createCheckoutSession: mocks.createCheckoutSession,
    constructEvent: mocks.constructEvent,
    getClient: mocks.getClient,
  },
}));

vi.mock('../services/EmailService', () => ({
  sendBookingConfirmation: mocks.sendBookingConfirmation,
  sendAdminBookingNotification: mocks.sendAdminBookingNotification,
}));

vi.mock('../utils/paymentLinkToken', () => ({
  generatePaymentLinkToken: mocks.generatePaymentLinkToken,
  verifyPaymentLinkToken: mocks.verifyPaymentLinkToken,
}));

import { CheckoutController } from './checkoutController';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

function createPackage(overrides?: Record<string, unknown>) {
  return {
    id: 'pkg-1',
    name: 'Essential Session',
    namePt: 'Sessao Essencial',
    active: true,
    totalPrice: 300,
    depositPrice: 100,
    ...overrides,
  };
}

describe('CheckoutController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FRONTEND_URL;
  });

  describe('generatePaymentLink', () => {
    it('returns 404 when package does not exist', async () => {
      mocks.findPackage.mockResolvedValueOnce(null);
      const req = {
        body: { packageId: 'missing', paymentType: 'FULL', paymentMethod: 'CARD', locale: 'en' },
        headers: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.generatePaymentLink(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not found' });
    });

    it('returns 400 when package is inactive', async () => {
      mocks.findPackage.mockResolvedValueOnce(createPackage({ active: false }));
      const req = {
        body: { packageId: 'pkg-1', paymentType: 'FULL', paymentMethod: 'CARD', locale: 'en' },
        headers: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.generatePaymentLink(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'This package is no longer active.' });
    });

    it('returns payment URL when package is valid', async () => {
      process.env.FRONTEND_URL = 'https://frontend.example/';
      mocks.findPackage.mockResolvedValueOnce(createPackage());
      mocks.generatePaymentLinkToken.mockReturnValueOnce('locked-token');
      const req = {
        body: {
          packageId: 'pkg-1',
          paymentType: 'FULL',
          paymentMethod: 'CARD',
          locale: 'pt',
          sessionDate: '2026-05-01',
        },
        headers: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.generatePaymentLink(req, res);

      expect(mocks.generatePaymentLinkToken).toHaveBeenCalledWith({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'pt',
        sessionDate: '2026-05-01',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://frontend.example/pt/payment?token=locked-token',
          expiresAt: expect.any(String),
        })
      );
    });

    it('returns 500 when an unexpected error happens', async () => {
      mocks.findPackage.mockRejectedValueOnce(new Error('db down'));
      const req = {
        body: { packageId: 'pkg-1', paymentType: 'FULL', paymentMethod: 'CARD', locale: 'en' },
        headers: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.generatePaymentLink(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'db down' });
    });
  });

  describe('createSession', () => {
    it('returns 401 when locked token is missing', async () => {
      const req = {
        body: { customerEmail: 'client@example.com', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Locked payment link token is required' });
    });

    it('returns 400 when terms are required but missing', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      const req = {
        body: { lockedToken: 'token' },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'You must accept the terms and conditions to proceed.' });
    });

    it('returns 401 when locked token is invalid', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce(null);
      const req = {
        body: { lockedToken: 'invalid-token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired payment link. Please request a new one.' });
    });

    it('returns 400 when locked payment method is not card', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'en',
      });
      const req = {
        body: { lockedToken: 'token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'This payment link only supports bank transfer.' });
    });

    it('returns 404 when package is not found', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-missing',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      mocks.findPackage.mockResolvedValueOnce(null);

      const req = {
        body: { lockedToken: 'token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not found' });
    });

    it('returns 400 when package is inactive', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      mocks.findPackage.mockResolvedValueOnce(createPackage({ active: false }));

      const req = {
        body: { lockedToken: 'token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'This package is no longer available.' });
    });

    it('returns 400 when amount calculation is invalid', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'BALANCE',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      mocks.findPackage.mockResolvedValueOnce(createPackage({ totalPrice: 100, depositPrice: 100 }));

      const req = {
        body: { lockedToken: 'token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid calculation. Price must be greater than 0.' });
    });

    it('creates checkout session and returns URL', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'DEPOSIT',
        paymentMethod: 'CARD',
        locale: 'pt',
        sessionDate: '2026-06-01',
      });
      mocks.findPackage.mockResolvedValueOnce(createPackage());
      mocks.createCheckoutSession.mockResolvedValueOnce({ url: 'https://stripe.test/session' });

      const req = {
        body: { lockedToken: 'token', customerEmail: 'client@example.com', termsAccepted: true },
        headers: {
          origin: 'https://site.example',
          'idempotency-key': 'idem-1',
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'vitest-agent',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          packageId: 'pkg-1',
          paymentType: 'DEPOSIT',
          locale: 'pt',
          customerEmail: 'client@example.com',
          idempotencyKey: 'idem-1',
          termsAccepted: 'true',
          clientIp: '1.2.3.4',
          clientUserAgent: 'vitest-agent',
        })
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://stripe.test/session' });
    });

    it('returns 500 on Stripe session creation error', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      mocks.findPackage.mockResolvedValueOnce(createPackage());
      mocks.createCheckoutSession.mockRejectedValueOnce(new Error('stripe failed'));

      const req = {
        body: { lockedToken: 'token', termsAccepted: true },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'stripe failed' });
    });
  });

  describe('createManualBooking', () => {
    it('returns 401 when locked token is invalid', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce(null);
      const req = {
        body: { lockedToken: 'invalid', customerName: 'Client', customerEmail: 'client@example.com' },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired payment link. Please request a new one.' });
    });

    it('returns 400 for missing required fields', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'en',
      });
      const req = {
        body: { lockedToken: 'token', customerName: '', customerEmail: '' },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('returns 400 when terms are required but missing', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'en',
      });
      const req = {
        body: { lockedToken: 'token', customerName: 'Client', customerEmail: 'client@example.com' },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'You must accept the terms and conditions to proceed.' });
    });

    it('returns 400 when payment method does not match transfer flow', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'BALANCE',
        paymentMethod: 'CARD',
        locale: 'en',
      });
      const req = {
        body: { lockedToken: 'token', customerName: 'Client', customerEmail: 'client@example.com' },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'This payment link only supports card checkout.' });
    });

    it('creates pending booking for valid bank transfer flow', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'BALANCE',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'pt',
      });
      mocks.findPackage.mockResolvedValueOnce(createPackage());
      mocks.createBooking.mockResolvedValueOnce({ id: 'booking-12345678' });

      const req = {
        body: {
          lockedToken: 'token',
          customerName: 'Client Name',
          customerEmail: 'client@example.com',
        },
        headers: {
          'x-forwarded-for': '9.9.9.9',
          'user-agent': 'vitest-agent',
        },
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(mocks.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
            paymentMethod: 'TRANSFER',
            customerEmail: 'client@example.com',
            locale: 'pt',
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        bookingId: 'booking-12345678',
        reference: 'BOOKING-',
      });
    });

    it('returns 400 when package is unavailable for manual booking', async () => {
      mocks.verifyPaymentLinkToken.mockReturnValueOnce({
        packageId: 'pkg-1',
        paymentType: 'BALANCE',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'pt',
      });
      mocks.findPackage.mockResolvedValueOnce(null);

      const req = {
        body: {
          lockedToken: 'token',
          customerName: 'Client Name',
          customerEmail: 'client@example.com',
        },
        headers: {},
        socket: {},
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.createManualBooking(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not available' });
    });
  });

  describe('handleWebhook', () => {
    it('returns 400 when stripe signature is missing', async () => {
      const req = { headers: {}, body: {} } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.handleWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing Stripe signature');
    });

    it('returns 400 when event construction fails', async () => {
      mocks.constructEvent.mockImplementationOnce(() => {
        throw new Error('invalid signature');
      });

      const req = {
        headers: { 'stripe-signature': 'sig' },
        rawBody: 'raw',
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.handleWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Webhook Error: invalid signature');
    });

    it('returns 400 when raw body is missing', async () => {
      const req = {
        headers: { 'stripe-signature': 'sig' },
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.handleWebhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing raw body for webhook verification');
    });

    it('acknowledges irrelevant webhook events', async () => {
      mocks.constructEvent.mockReturnValueOnce({
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const req = {
        headers: { 'stripe-signature': 'sig' },
        rawBody: 'raw',
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.handleWebhook(req, res);

      expect(mocks.createBooking).not.toHaveBeenCalled();
      expect(res.send).toHaveBeenCalled();
    });

    it('acknowledges checkout.session.completed and processes booking', async () => {
      mocks.constructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1',
            amount_total: 30000,
            currency: 'gbp',
            payment_intent: 'pi_123',
            customer_details: { email: 'client@example.com', name: 'Client' },
            metadata: {
              locale: 'pt',
              paymentType: 'FULL',
              packageId: 'pkg-1',
              productName: 'Photography Package',
              termsAccepted: 'true',
              termsAcceptedAt: '2026-04-29T20:00:00.000Z',
              clientIp: '1.1.1.1',
              userAgent: 'browser',
            },
          },
        },
      });
      mocks.createBooking.mockResolvedValueOnce({ id: 'booking-1' });
      mocks.findPackage.mockResolvedValueOnce(createPackage({ namePt: 'Pacote Premium' }));
      mocks.getClient.mockReturnValueOnce({
        paymentIntents: {
          retrieve: vi.fn().mockResolvedValue({ latest_charge: { receipt_url: 'https://receipt' } }),
        },
      });

      const req = {
        headers: { 'stripe-signature': 'sig' },
        rawBody: 'raw-payload',
      } as unknown as Request;
      const res = createMockResponse();

      await CheckoutController.handleWebhook(req, res);

      expect(mocks.createBooking).toHaveBeenCalled();
      expect(mocks.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: 'client@example.com',
          paymentType: 'FULL',
          packageName: 'Pacote Premium',
          receiptUrl: 'https://receipt',
        })
      );
      expect(mocks.sendAdminBookingNotification).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalled();
    });
  });
});
