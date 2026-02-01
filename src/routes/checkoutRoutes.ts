import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';

const router = Router();

// Route for frontend to call and generate payment session
// POST /api/checkout/session
router.post('/session', CheckoutController.createSession);

// Stripe Webhook (Must not have Auth Middleware)
// POST /api/checkout/webhook  <-- Oops, better pattern is /api/webhooks/stripe
// But I'll leave it here for now and adjust in route index.ts

export default router;
