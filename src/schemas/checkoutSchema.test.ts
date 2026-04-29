import {
  checkoutManualSchema,
  checkoutSessionSchema,
  generatePaymentLinkSchema,
} from './checkoutSchema';

describe('checkoutSchema', () => {
  it('accepts valid checkout session payload', () => {
    const parsed = checkoutSessionSchema.parse({
      lockedToken: 'token-123',
      customerEmail: 'client@example.com',
      termsAccepted: true,
    });

    expect(parsed.lockedToken).toBe('token-123');
    expect(parsed.customerEmail).toBe('client@example.com');
    expect(parsed.termsAccepted).toBe(true);
  });

  it('rejects checkout session payload without locked token', () => {
    const result = checkoutSessionSchema.safeParse({
      customerEmail: 'client@example.com',
    });

    expect(result.success).toBe(false);
  });

  it('accepts valid manual checkout payload', () => {
    const parsed = checkoutManualSchema.parse({
      lockedToken: 'token-123',
      customerName: 'Jane Doe',
      customerEmail: 'jane@example.com',
      termsAccepted: false,
    });

    expect(parsed.customerName).toBe('Jane Doe');
  });

  it('rejects invalid manual checkout email', () => {
    const result = checkoutManualSchema.safeParse({
      lockedToken: 'token-123',
      customerName: 'Jane Doe',
      customerEmail: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('applies default locale when generating payment link', () => {
    const parsed = generatePaymentLinkSchema.parse({
      packageId: 'pkg-1',
      paymentType: 'DEPOSIT',
      paymentMethod: 'CARD',
    });

    expect(parsed.locale).toBe('en');
  });

  it('rejects unsupported payment method', () => {
    const result = generatePaymentLinkSchema.safeParse({
      packageId: 'pkg-1',
      paymentType: 'DEPOSIT',
      paymentMethod: 'PIX',
    });

    expect(result.success).toBe(false);
  });
});