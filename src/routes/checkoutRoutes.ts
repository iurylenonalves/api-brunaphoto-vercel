import { Router } from 'express';
import { CheckoutController } from '../controllers/checkoutController';
import { validateRequest } from '../middlewares/zodValidation';
import { checkoutSessionSchema } from '../schemas/checkoutSchema';
import { rateLimit } from 'express-rate-limit'; // Fixed import

const router = Router();

// Specific rate limit for payment session creation
// Prevents brute-forcing or spamming checkout sessions
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
      error: 'Too many checkout attempts from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Route for frontend to call and generate payment session
// POST /api/checkout/session
router.post(
  '/session', 
  checkoutLimiter,
  validateRequest(checkoutSessionSchema),
  CheckoutController.createSession
);

// Route for manual bank transfer booking
// POST /api/checkout/manual
router.post(
  '/manual',
  checkoutLimiter,
  CheckoutController.createManualBooking
);

// Stripe Webhook (Must not have Auth Middleware)
// POST /api/checkout/webhook  <-- Oops, better pattern is /api/webhooks/stripe
// But I'll leave it here for now and adjust in route index.ts

export default router;
