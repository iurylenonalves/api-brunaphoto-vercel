import { vi } from 'vitest';

const stripeMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  constructEvent: vi.fn(),
}));

vi.mock('stripe', () => {
  class StripeMock {
    checkout = {
      sessions: {
        create: stripeMocks.createSession,
      },
    };

    webhooks = {
      constructEvent: stripeMocks.constructEvent,
    };
  }

  return {
    default: StripeMock,
  };
});

describe('StripeService', () => {
  const previousStripeSecret = process.env.STRIPE_SECRET_KEY;
  const previousWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_phase3';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_phase3';
  });

  afterEach(() => {
    if (previousStripeSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousStripeSecret;
    }

    if (previousWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = previousWebhookSecret;
    }
  });

  it('creates checkout session for DEPOSIT with card only', async () => {
    vi.resetModules();
    stripeMocks.createSession.mockResolvedValueOnce({ id: 'cs_1' });
    const { StripeService } = await import('./StripeService');

    await StripeService.createCheckoutSession({
      packageId: 'pkg-1',
      amount: 123.45,
      currency: 'gbp',
      productName: 'Package A',
      paymentType: 'DEPOSIT',
      locale: 'en',
      successUrl: 'https://site/success',
      cancelUrl: 'https://site/cancel',
      customerEmail: 'client@example.com',
      idempotencyKey: 'idem-1',
      termsAccepted: 'true',
      termsAcceptedAt: '2026-01-01T10:00:00.000Z',
      clientIp: '1.1.1.1',
      clientUserAgent: 'agent',
    });

    expect(stripeMocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: 'client@example.com',
        metadata: expect.objectContaining({
          packageId: 'pkg-1',
          paymentType: 'DEPOSIT',
          locale: 'en',
          termsAccepted: 'true',
          clientIp: '1.1.1.1',
          userAgent: 'agent',
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 12345,
            }),
          }),
        ],
      }),
      { idempotencyKey: 'idem-1' }
    );
  });

  it('creates checkout session for FULL with card, klarna and afterpay_clearpay', async () => {
    vi.resetModules();
    stripeMocks.createSession.mockResolvedValueOnce({ id: 'cs_2' });
    const { StripeService } = await import('./StripeService');

    await StripeService.createCheckoutSession({
      amount: 50,
      currency: 'gbp',
      productName: 'Package B',
      paymentType: 'FULL',
      locale: 'pt',
      successUrl: 'https://site/success',
      cancelUrl: 'https://site/cancel',
    });

    expect(stripeMocks.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ['card', 'klarna', 'afterpay_clearpay'],
        metadata: expect.objectContaining({
          paymentType: 'FULL',
          locale: 'pt',
        }),
        payment_intent_data: expect.objectContaining({
          metadata: expect.objectContaining({
            paymentType: 'FULL',
            locale: 'pt',
          }),
        }),
      }),
      { idempotencyKey: undefined }
    );
  });

  it('throws when STRIPE_SECRET_KEY is missing', async () => {
    vi.resetModules();
    delete process.env.STRIPE_SECRET_KEY;
    const { StripeService } = await import('./StripeService');

    await expect(
      StripeService.createCheckoutSession({
        amount: 10,
        currency: 'gbp',
        productName: 'Package C',
        paymentType: 'BALANCE',
        locale: 'en',
        successUrl: 'https://site/success',
        cancelUrl: 'https://site/cancel',
      })
    ).rejects.toThrow('STRIPE_SECRET_KEY is not defined');
  });

  it('constructs stripe event when webhook secret exists', async () => {
    vi.resetModules();
    stripeMocks.constructEvent.mockReturnValueOnce({ id: 'evt_1' });
    const { StripeService } = await import('./StripeService');

    const event = StripeService.constructEvent('raw-body', 'signature');

    expect(event).toEqual({ id: 'evt_1' });
    expect(stripeMocks.constructEvent).toHaveBeenCalledWith('raw-body', 'signature', 'whsec_phase3');
  });

  it('throws when STRIPE_WEBHOOK_SECRET is missing', async () => {
    vi.resetModules();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { StripeService } = await import('./StripeService');

    expect(() => StripeService.constructEvent('raw-body', 'signature')).toThrow(
      'STRIPE_WEBHOOK_SECRET is not defined'
    );
  });
});
