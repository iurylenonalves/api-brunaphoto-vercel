import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';

const router = Router();

// Endpoint that Stripe calls
// POST /api/webhooks/stripe
router.post('/stripe', CheckoutController.handleWebhook);

export default router;
