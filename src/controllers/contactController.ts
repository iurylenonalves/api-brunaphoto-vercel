import { Request, Response } from 'express';
import { sendContactEmail } from '../services/EmailService';
import { ContactFormData } from '../types';

export async function handlePostContact(req: Request<{}, {}, ContactFormData>, res: Response): Promise<void> {
  try {
    console.log('POST /api/contacts called');
    const { name, email, message } = req.body;
    
    await sendContactEmail(name, email, message);

    res.status(200).json({
      success: true,
      message: 'Message sent successfully!',
    });
  } catch (error) {
    console.error('Error processing contact: ', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message. Please try again later.',
    });
  }
}

export function handleGetContact(_req: Request, res: Response): void {
  res.status(200).json({
    message: 'This endpoint only supports POST requests.',
  });
}