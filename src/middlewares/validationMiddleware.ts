import { Request, Response, NextFunction } from 'express';
import { ContactFormData } from '../types';

export function validateContactFormMiddleware(
  req: Request<{}, {}, ContactFormData>,
  res: Response,
  next: NextFunction
): void {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400).json({
      success: false,
      message: 'All fields are mandatory (name, email, message)',
    });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({
      success: false,
      message: 'Invalid email',
    });
    return;
  }

  const maxMessageLength = 1000;
  if (message.length > maxMessageLength) {
    res.status(400).json({
      success: false,
      message: `Message is too long. Maximum length is ${maxMessageLength} characters.`,
    });
    return;
  }

  next();
}