import Stripe from 'stripe';
import { prisma } from '../database/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover', // Exact version required by installed SDK
});


interface CheckoutSessionParams {
  packageId?: string; // Internal package ID
  priceId: string;    // Stripe Price ID
  paymentType: 'DEPOSIT' | 'FULL' | 'BALANCE';
  locale: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export class StripeService {
  static getClient() {
    return stripe;
  }

  static async createCheckoutSession(params: CheckoutSessionParams) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }

    // Buscar informações do pacote se packageId for fornecido
    // (This will be useful for metadata, but we'll trust the priceId coming from front for now
    // or validate against DB if we have already populated)
    let packageName = 'Photography Session';
    
    if (params.packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: params.packageId } });
      if (pkg) packageName = pkg.name;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Klarna is enabled in Dashboard, no need to put here explicitly if using 'automatic_payment_methods'
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        packageId: params.packageId || '',
        paymentType: params.paymentType,
        locale: params.locale
      },
      // Enable payment methods configured in Dashboard (Card, Klarna, Apple Pay, etc)
      // But for immediate payment sessions, 'payment_method_types' or 'automatic_payment_methods'
      // The most modern way is to use ui_mode: 'hosted' (default) and let the dashboard control the methods.
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
