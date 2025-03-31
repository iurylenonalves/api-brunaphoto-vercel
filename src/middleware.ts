import express, { Application } from 'express';
import cors from 'cors';

export function setupMiddleware(app: Application): void {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  }));

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}