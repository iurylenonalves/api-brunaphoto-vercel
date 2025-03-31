import nodemailer, { Transporter } from 'nodemailer';
import { SmtpConfig } from './types';

function getSmtpConfig(): SmtpConfig {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Configurações SMTP ausentes nas variáveis de ambiente.');
  }

  return {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: SMTP_PORT === '465',
    user: SMTP_USER,
    pass: SMTP_PASS,
  };
}

function createTransporter(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

export async function sendContactEmail(name: string, email: string, message: string): Promise<void> {
  const config = getSmtpConfig();
  const transporter = createTransporter(config);

  const mailOptions = {
    from: `"Contato" <${config.user}>`,
    to: config.user,
    replyTo: email,
    subject: `Novo contato de ${name}`,
    html: `
      <h2>Novo contato recebido</h2>
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Mensagem:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}