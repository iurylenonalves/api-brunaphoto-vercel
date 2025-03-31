import { Request, Response } from 'express';
import { sendContactEmail } from './emailService';
import { ContactFormData } from './types';

export async function handlePostContact(req: Request<{}, {}, ContactFormData>, res: Response): Promise<void> {
  try {
    console.log('POST /api/contacts chamado');
    const { name, email, message } = req.body;

    // Enviar e-mail
    await sendContactEmail(name, email, message);

    res.status(200).json({
      success: true,
      message: 'Mensagem enviada com sucesso!',
    });
  } catch (error) {
    console.error('Erro ao processar contato:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem. Por favor, tente novamente mais tarde.',
    });
  }
}

// Handler para a rota GET /contacts
export function handleGetContact(_req: Request, res: Response): void {
  res.status(200).json({
    message: 'Este endpoint suporta apenas requisições POST.',
  });
}