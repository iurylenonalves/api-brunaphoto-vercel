import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

export function setupMiddleware(app: Application): void {
  // Special configuration for Stripe Webhooks that need rawBody for signature validation
  app.use(express.json({
    verify: (req: any, res, buf) => {
      if (req.originalUrl.startsWith('/api/webhooks')) {
        req.rawBody = buf.toString();
      }
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  app.use(cors({
    origin: [
      'https://brunaalvesphoto.com',
      'https://www.brunaalvesphoto.com',
      'https://brunaalvesphoto-frontend.vercel.app',
      'http://localhost:3000',
    ],
    credentials: true,
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
     max: process.env.NODE_ENV === 'production' ? 100 : 1000, 
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true, 
    legacyHeaders: false, 
  });

  app.use(limiter);

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}