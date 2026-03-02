import jwt from 'jsonwebtoken';

const PAYMENT_LINK_SECRET = process.env.PAYMENT_LINK_SECRET || process.env.JWT_SECRET;

if (!PAYMENT_LINK_SECRET) {
  throw new Error('PAYMENT_LINK_SECRET or JWT_SECRET must be defined in environment variables.');
}

export type LockedPaymentType = 'DEPOSIT' | 'FULL' | 'BALANCE';
export type LockedPaymentMethod = 'CARD' | 'BANK_TRANSFER';
export type LockedLocale = 'en' | 'pt';

export interface LockedPaymentLinkPayload {
  packageId: string;
  paymentType: LockedPaymentType;
  paymentMethod: LockedPaymentMethod;
  locale: LockedLocale;
  sessionDate?: string;
}

interface LockedPaymentTokenPayload extends LockedPaymentLinkPayload {
  purpose: 'locked_payment_link';
  iat?: number;
  exp?: number;
}

export function generatePaymentLinkToken(payload: LockedPaymentLinkPayload): string {
  return jwt.sign(
    {
      ...payload,
      purpose: 'locked_payment_link',
    },
    PAYMENT_LINK_SECRET!,
    { expiresIn: '24h' }
  );
}

export function verifyPaymentLinkToken(token: string): LockedPaymentTokenPayload | null {
  try {
    const decoded = jwt.verify(token, PAYMENT_LINK_SECRET!) as LockedPaymentTokenPayload;
    if (decoded.purpose !== 'locked_payment_link') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
