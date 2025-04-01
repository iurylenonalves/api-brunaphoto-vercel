import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

export function setupMiddleware(app: Application): void {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(cors({
    origin: 'https://www.brunaalvesphoto.com',
    credentials: true,
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    },
  });

  app.use(limiter);

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}