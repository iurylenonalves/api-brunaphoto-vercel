import { Request, Response } from 'express';
import { StripeService } from '../services/StripeService';
import { prisma } from '../database/client';
import { sendBookingConfirmation, sendAdminBookingNotification } from '../services/EmailService';

export class CheckoutController {
  
  static async createSession(req: Request, res: Response) {
    try {
      const { packageId, paymentType, locale, customerEmail, sessionDate } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const termsAcceptedAt = new Date().toISOString(); // Capture exact server time of acceptance

      // Securely capture Client IP and User Agent for Audit Trail
      // On Vercel/proxies, IP is often in x-forwarded-for
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const clientUserAgent = req.headers['user-agent'] || 'unknown';

      if (!packageId || !paymentType) {
        return res.status(400).json({ error: 'Missing packageId or paymentType' });
      }

      // Fetch dynamic price from Database
      const pkg = await prisma.package.findUnique({
          where: { id: packageId }
      });

      if (!pkg) {
          return res.status(404).json({ error: 'Package not found' });
      }

      if (!pkg.active) {
          return res.status(400).json({ error: 'This package is no longer available.' });
      }

      // Calculate Amount
      let amount = 0;
      let description = '';
      const isPt = locale === 'pt';
      const packageName = isPt && pkg.namePt ? pkg.namePt : pkg.name;

      if (paymentType === 'DEPOSIT') {
          amount = Number(pkg.depositPrice);
          description = isPt ? `Taxa de reserva (Não reembolsável): ${packageName}` : `Booking Fee (Non-refundable): ${packageName}`;
      } else if (paymentType === 'FULL') {
          amount = Number(pkg.totalPrice);
          description = isPt ? `Pagamento total: ${packageName}` : `Full payment: ${packageName}`;
      } else if (paymentType === 'BALANCE') {
          amount = Number(pkg.totalPrice) - Number(pkg.depositPrice);
          description = isPt ? `Pagamento restante: ${packageName}` : `Remaining balance: ${packageName}`;
      }

      if (amount <= 0) {
          return res.status(400).json({ error: 'Invalid calculation. Price must be greater than 0.' });
      }

      // Return URLs for the Frontend
      const origin = req.headers.origin || 'https://brunaalvesphoto.com';
      const successUrl = `${origin}/${locale || 'en'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/${locale || 'en'}/checkout/cancel`;

      const session = await StripeService.createCheckoutSession({
        packageId,
        amount,
        currency: 'gbp', // Default currency
        productName: isPt ? `Pagamento: ${packageName}` : `Payment: ${packageName}`,
        productDescription: description,
        paymentType,
        locale: locale || 'en',
        customerEmail,
        successUrl,
        cancelUrl,
        sessionDate: sessionDate || undefined, // Pass date to Stripe
        idempotencyKey,
        termsAccepted: "true",
        termsAcceptedAt,
        clientIp,
        clientUserAgent,
      });

      return res.json({ url: session.url });
    } catch (error: any) {
      console.error('Create Session Error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  static async createManualBooking(req: Request, res: Response) {
    try {
      const { packageId, paymentType, locale, customerEmail, customerName, sessionDate } = req.body;
      const termsAcceptedAt = new Date().toISOString();
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const clientUserAgent = req.headers['user-agent'] || 'unknown';

      if (!packageId || !paymentType || !customerEmail || !customerName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg || !pkg.active) {
          return res.status(400).json({ error: 'Package not available' });
      }

      // Create Booking Record
      const booking = await prisma.booking.create({
          data: {
              customerName,
              customerEmail,
              amountPaid: 0, // Payment pending
              currency: 'gbp',
              locale: locale || 'en', // Save locale
              paymentType,
              status: 'pending', // Pending transfer
              packageId,
              sessionDate: sessionDate ? new Date(sessionDate) : null,
              termsAccepted: true,
              termsAcceptedAt: new Date(termsAcceptedAt),
              clientIp,
              clientUserAgent,
              stripeSessionId: null,
              paymentMethod: 'TRANSFER' // Default for manual bookings
          }
      });
      
      // We could trigger an email here "Transfer Instructions sent"

      return res.json({ success: true, bookingId: booking.id, reference: booking.id.slice(0, 8).toUpperCase() });
    } catch (error: any) {
        console.error('Manual Booking Error:', error);
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
        const amount = session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00';
        const currency = (session.currency || 'gbp').toUpperCase();
        const sessionDate = session.metadata?.sessionDate ? new Date(session.metadata.sessionDate) : null;
        
        await prisma.booking.create({
            data: {
                stripeSessionId: session.id,
                customerEmail: session.customer_details?.email || 'unknown',
                customerName: session.customer_details?.name,
                amountPaid: session.amount_total ? session.amount_total / 100 : 0, // Stripe uses cents
                currency: session.currency || 'gbp',
                locale: session.metadata?.locale || 'en', // Save locale
                paymentType: session.metadata?.paymentType || 'UNKNOWN',
                status: 'paid',
                packageId: session.metadata?.packageId || null,
                sessionDate: sessionDate, // Save session date to Database
                paymentMethod: 'STRIPE', // Explicitly set payment method
                // Audit Fields from Metadata
                termsAccepted: session.metadata?.termsAccepted === 'true',
                termsAcceptedAt: session.metadata?.termsAcceptedAt ? new Date(session.metadata.termsAcceptedAt) : null,
                clientIp: session.metadata?.clientIp || null,
                clientUserAgent: session.metadata?.clientUserAgent || session.metadata?.userAgent || null,
            }
        });

        // 2. Fetch Receipt URL (if available)
        let receiptUrl: string | undefined;
        if (session.payment_intent && typeof session.payment_intent === 'string') {
            try {
                const stripe = StripeService.getClient();
                // Expand the payment_intent to get the latest_charge
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
                    expand: ['latest_charge']
                });
                
                // If it's a Charge object
                const charge = paymentIntent.latest_charge as any;
                if (charge && charge.receipt_url) {
                    receiptUrl = charge.receipt_url;
                }
            } catch (err: any) {
                console.error('Error fetching Stripe receipt:', err.message);
            }
        }

        // 3. Send Confirmation Emails
        const emailDetails = {
            customerName: session.customer_details?.name || 'Cliente',
            customerEmail: session.customer_details?.email || '',
            amount: `${currency} ${amount}`,
            packageName: session.metadata?.productName || 'Photography Package', // We need to ensure productName is passed in metadata or fetched
            paymentType: session.metadata?.paymentType as any,
            locale: session.metadata?.locale || 'en',
            stripeSessionId: session.id,
            sessionDate: session.metadata?.sessionDate || undefined, // Send date to email template
            receiptUrl: receiptUrl
        };

        // If productName is not in metadata, we could fetch it from DB, but let's try to rely on session data or fallback
        // To be safe, let's keep it simple for now or fetch the package again if critical
        if (session.metadata?.packageId) {
             const pkg = await prisma.package.findUnique({ where: { id: session.metadata.packageId }});
             if (pkg) {
                 const isPt = emailDetails.locale === 'pt';
                 emailDetails.packageName = isPt && pkg.namePt ? pkg.namePt : pkg.name;
             }
        }

        await sendBookingConfirmation(emailDetails);
        await sendAdminBookingNotification(emailDetails);
        
      } catch (dbError) {
          console.error("Error processing successful payment:", dbError);
          // We don't return 500 so Stripe doesn't keep retrying infinitely if it was a unique database error
          // But ideally the log alerts the dev
      }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  }
}
