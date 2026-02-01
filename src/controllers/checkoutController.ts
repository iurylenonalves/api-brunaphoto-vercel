import { Request, Response } from 'express';
import { StripeService } from '../services/StripeService';
import { prisma } from '../database/client';
// import { EmailService } from '../services/EmailService'; // TODO: Import when confirmation method exists

export class CheckoutController {
  
  static async createSession(req: Request, res: Response) {
    try {
      const { priceId, packageId, paymentType, locale, customerEmail } = req.body;

      if (!priceId || !paymentType) {
        return res.status(400).json({ error: 'Missing priceId or paymentType' });
      }

      // Return URLs for the Frontend
      const origin = req.headers.origin || 'https://brunaalvesphoto.com';
      const successUrl = `${origin}/${locale || 'en'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/${locale || 'en'}/checkout/cancel`;

      const session = await StripeService.createCheckoutSession({
        priceId,
        packageId,
        paymentType,
        locale: locale || 'en',
        customerEmail,
        successUrl,
        cancelUrl
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error('Create Session Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing Stripe signature');
    }

    let event;

    try {
        // req.rawBody was added in middleware.ts
        // @ts-ignore
        const rawBody = req.rawBody; 
        if (!rawBody) {
             return res.status(400).send('Missing raw body for webhook verification');
        }

        event = StripeService.constructEvent(rawBody, signature as string);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      console.log(`💰 Payment succeeded: ${session.id}`);

      // 1. Create database record (Booking)
      try {
        await prisma.booking.create({
            data: {
                stripeSessionId: session.id,
                customerEmail: session.customer_details?.email || 'unknown',
                customerName: session.customer_details?.name,
                amountPaid: session.amount_total ? session.amount_total / 100 : 0, // Stripe uses cents
                currency: session.currency || 'gbp',
                paymentType: session.metadata?.paymentType || 'UNKNOWN',
                status: 'paid',
                packageId: session.metadata?.packageId || null
            }
        });

        // 2. Send Confirmation Email
        // await EmailService.sendBookingConfirmation(session.customer_details.email, session.metadata);
        
      } catch (dbError) {
          console.error("Error saving booking to DB:", dbError);
          // We don't return 500 so Stripe doesn't keep retrying infinitely if it was a unique database error
          // But ideally the log alerts the dev
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  }
}
