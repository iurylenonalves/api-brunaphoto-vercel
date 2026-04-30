import jwt from 'jsonwebtoken';
import { vi } from 'vitest';

type TokenModule = typeof import('./paymentLinkToken');

async function importTokenModuleWithEnv(overrides: Record<string, string | undefined>): Promise<TokenModule> {
  vi.resetModules();

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return import('./paymentLinkToken');
}

describe('paymentLinkToken utils', () => {
  const previousPaymentSecret = process.env.PAYMENT_LINK_SECRET;
  const previousJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (previousPaymentSecret === undefined) {
      delete process.env.PAYMENT_LINK_SECRET;
    } else {
      process.env.PAYMENT_LINK_SECRET = previousPaymentSecret;
    }

    if (previousJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousJwtSecret;
    }
  });

  it('generates and verifies a valid locked payment token', async () => {
    const tokenModule = await importTokenModuleWithEnv({
      PAYMENT_LINK_SECRET: 'phase3-payment-secret',
      JWT_SECRET: 'unused-jwt-secret',
    });

    const token = tokenModule.generatePaymentLinkToken({
      packageId: 'pkg-1',
      paymentType: 'DEPOSIT',
      paymentMethod: 'CARD',
      locale: 'en',
      sessionDate: '2026-06-20',
    });

    const decoded = tokenModule.verifyPaymentLinkToken(token);

    expect(decoded).toMatchObject({
      packageId: 'pkg-1',
      paymentType: 'DEPOSIT',
      paymentMethod: 'CARD',
      locale: 'en',
      purpose: 'locked_payment_link',
    });
  });

  it('returns null for invalid token', async () => {
    const tokenModule = await importTokenModuleWithEnv({
      PAYMENT_LINK_SECRET: 'phase3-payment-secret',
      JWT_SECRET: 'unused-jwt-secret',
    });

    expect(tokenModule.verifyPaymentLinkToken('invalid-token')).toBeNull();
  });

  it('returns null for expired token', async () => {
    const tokenModule = await importTokenModuleWithEnv({
      PAYMENT_LINK_SECRET: 'phase3-payment-secret',
      JWT_SECRET: 'unused-jwt-secret',
    });

    const expiredToken = jwt.sign(
      {
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'CARD',
        locale: 'pt',
        purpose: 'locked_payment_link',
      },
      'phase3-payment-secret',
      { expiresIn: -1 }
    );

    expect(tokenModule.verifyPaymentLinkToken(expiredToken)).toBeNull();
  });

  it('returns null when purpose is not locked_payment_link', async () => {
    const tokenModule = await importTokenModuleWithEnv({
      PAYMENT_LINK_SECRET: 'phase3-payment-secret',
      JWT_SECRET: 'unused-jwt-secret',
    });

    const wrongPurposeToken = jwt.sign(
      {
        packageId: 'pkg-1',
        paymentType: 'FULL',
        paymentMethod: 'BANK_TRANSFER',
        locale: 'en',
        purpose: 'another-purpose',
      },
      'phase3-payment-secret',
      { expiresIn: '1h' }
    );

    expect(tokenModule.verifyPaymentLinkToken(wrongPurposeToken)).toBeNull();
  });

  it('throws on import when PAYMENT_LINK_SECRET and JWT_SECRET are missing', async () => {
    await expect(
      importTokenModuleWithEnv({
        PAYMENT_LINK_SECRET: undefined,
        JWT_SECRET: undefined,
      })
    ).rejects.toThrow('PAYMENT_LINK_SECRET or JWT_SECRET must be defined in environment variables.');
  });
});
