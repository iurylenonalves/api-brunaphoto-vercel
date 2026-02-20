import Stripe from 'stripe';
import { prisma } from '../database/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover', // Exact version required by installed SDK
});


interface CheckoutSessionParams {
  packageId?: string;
  amount: number;     // Amount in cents (or smallest currency unit)
  currency: string;   // 'gbp', 'eur', etc.
  productName: string;
  productDescription?: string;
  paymentType: 'DEPOSIT' | 'FULL' | 'BALANCE';
  locale: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  sessionDate?: string; // Add optional session date to parameters
  idempotencyKey?: string;
  termsAccepted?: string;
  termsAcceptedAt?: string;
  clientIp?: string;
  clientUserAgent?: string;
}

export class StripeService {
  static getClient() {
    return stripe;
  }

  static async createCheckoutSession(params: CheckoutSessionParams) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }

    // Booking Fee (DEPOSIT) must be paid immediately via Card (non-refundable).
    // Installment/Wallet options like Klarna/Afterpay/PayPal are disabled for this type.
    const allowedPaymentMethods: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = 
        params.paymentType === 'DEPOSIT' 
            ? ['card'] 
            : ['card', 'klarna', 'afterpay_clearpay']; // Allow more methods for FULL/BALANCE payments (Config - 'paypal' may require additional setup)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: allowedPaymentMethods,
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: params.productName,
              description: params.productDescription,
              metadata: {
                  packageId: params.packageId || ''
              }
            },
            unit_amount: Math.round(params.amount * 100), // Ensure integer cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      // Metadata for the Checkout Session (visible in Session details)
      metadata: {
        packageId: params.packageId || '',
        paymentType: params.paymentType,
        locale: params.locale,
        sessionDate: params.sessionDate || '',
        termsAccepted: params.termsAccepted || 'false',
        termsAcceptedAt: params.termsAcceptedAt || '',
        termsVersion: 'v1-feb-2026',
        clientIp: params.clientIp || 'unknown',
        userAgent: params.clientUserAgent || 'unknown',
      },
      // Ensure metadata is copied to the Payment Intent (visible in Payment/Charge details)
      payment_intent_data: {
        metadata: {
          packageId: params.packageId || '',
          paymentType: params.paymentType,
          locale: params.locale,
          sessionDate: params.sessionDate || '',
          termsAccepted: params.termsAccepted || 'false',
          termsAcceptedAt: params.termsAcceptedAt || '',
          termsVersion: 'v1-feb-2026',
          clientIp: params.clientIp || 'unknown',
          userAgent: params.clientUserAgent || 'unknown',
        }
      },
    }, {
      idempotencyKey: params.idempotencyKey, // Use key if provided
    });

    return session;
  }

  static constructEvent(rawBody: string | Buffer, signature: string) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}
