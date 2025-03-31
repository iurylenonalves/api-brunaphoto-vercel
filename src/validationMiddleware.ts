import { Request, Response, NextFunction } from 'express';
import { ContactFormData } from './types';

export function validateContactFormMiddleware(
  req: Request<{}, {}, ContactFormData>,
  res: Response,
  next: NextFunction
): void {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400).json({
      success: false,
      message: 'Todos os campos são obrigatórios (nome, email, mensagem)',
    });
    return; // Certifique-se de retornar aqui para evitar chamar `next()`
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({
      success: false,
      message: 'Email inválido',
    });
    return; // Certifique-se de retornar aqui para evitar chamar `next()`
  }

  next(); // Chame `next()` apenas se a validação passar
}