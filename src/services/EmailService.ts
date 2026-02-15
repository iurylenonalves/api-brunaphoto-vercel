import nodemailer, { Transporter } from 'nodemailer';
import { SmtpConfig } from '../types';

function getSmtpConfig(): SmtpConfig {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP configuration is missing. Please check your environment variables.');
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

interface BookingEmailDetails {
  customerName: string;
  customerEmail: string;
  amount: string;
  packageName: string;
  paymentType: 'DEPOSIT' | 'FULL' | 'BALANCE';
  locale: string;
  stripeSessionId: string;
  sessionDate?: string;
}

export async function sendBookingConfirmation(details: BookingEmailDetails): Promise<void> {
  const config = getSmtpConfig();
  const transporter = createTransporter(config);
  
  const isPt = details.locale === 'pt';
  const subject = isPt ? 'Confirmação de Pagamento - Bruna Alves Photography' : 'Payment Confirmation - Bruna Alves Photography';
  
  // Legal Text / Policy Text
  const policyTextPt = details.paymentType === 'DEPOSIT' || details.paymentType === 'FULL'
    ? '<p style="color: #666; font-size: 12px; margin-top: 20px;"><strong>Importante:</strong> A Taxa de Reserva (Booking Fee) não é reembolsável e serve para garantir a exclusividade da sua data.</p>'
    : '';
    
  const policyTextEn = details.paymentType === 'DEPOSIT' || details.paymentType === 'FULL'
    ? '<p style="color: #666; font-size: 12px; margin-top: 20px;"><strong>Important:</strong> The Booking Fee is non-refundable and secures your session date exclusivelly.</p>'
    : '';

  const messageBodyPt = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Olá, ${details.customerName}!</h2>
      <p>Recebemos seu pagamento com sucesso. Muito obrigada!</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Pacote:</strong> ${details.packageName}</p>
        ${details.sessionDate ? `<p><strong>Data da Sessão:</strong> ${formatDateForEmail(details.sessionDate, 'pt')}</p>` : ''}
        <p><strong>Valor Pago:</strong> ${details.amount}</p>
        <p><strong>Tipo de Pagamento:</strong> ${formatPaymentType(details.paymentType, 'pt')}</p>
        <p><strong>Referência:</strong> ${details.stripeSessionId.slice(-8)}</p>
      </div>

      <p>Em breve entrarei em contato para confirmarmos os próximos passos da sua sessão.</p>

      ${policyTextPt}
      
      <p style="margin-top: 30px;">Com carinho,<br>Bruna Alves</p>
    </div>
  `;

  const messageBodyEn = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Hi ${details.customerName}!</h2>
      <p>We have successfully received your payment. Thank you so much!</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Package:</strong> ${details.packageName}</p>
        ${details.sessionDate ? `<p><strong>Session Date:</strong> ${formatDateForEmail(details.sessionDate, 'en')}</p>` : ''}
        <p><strong>Amount Paid:</strong> ${details.amount}</p>
        <p><strong>Payment Type:</strong> ${formatPaymentType(details.paymentType, 'en')}</p>
        <p><strong>Reference:</strong> ${details.stripeSessionId.slice(-8)}</p>
      </div>

      <p>I will be in touch shortly to confirm the next steps for your session.</p>
      
      ${policyTextEn}
      
      <p style="margin-top: 30px;">Best regards,<br>Bruna Alves</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Bruna Alves Photography" <${config.user}>`,
    to: details.customerEmail,
    subject: subject,
    html: isPt ? messageBodyPt : messageBodyEn,
  });
}

export async function sendAdminBookingNotification(details: BookingEmailDetails): Promise<void> {
  const config = getSmtpConfig();
  const transporter = createTransporter(config);

  const subject = `💰 Nova Venda: ${details.customerName} (£${details.amount})`;

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color: #2c3e50;">Nova Venda Confirmada! 🎉</h2>
      
      <ul style="line-height: 1.6;">
        <li><strong>Cliente:</strong> ${details.customerName} (${details.customerEmail})</li>
        <li><strong>Pacote:</strong> ${details.packageName}</li>
        ${details.sessionDate ? `<li><strong>Data da Sessão:</strong> ${formatDateForEmail(details.sessionDate, 'pt')}</li>` : ''}
        <li><strong>Valor:</strong> ${details.amount}</li>
        <li><strong>Tipo:</strong> ${details.paymentType}</li>
        <li><strong>Idioma do Cliente:</strong> ${details.locale.toUpperCase()}</li>
      </ul>

      <p>Verifique o painel do Stripe ou seu Banco de Dados para mais detalhes.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Sistema Bruna Alves" <${config.user}>`,
    to: config.user, // Sends to you (the admin)
    subject: subject,
    html: html,
  });
}

function formatPaymentType(type: string, locale: string): string {
  const types: any = {
    'DEPOSIT': { pt: 'Taxa de Reserva', en: 'Booking Fee' },
    'FULL': { pt: 'Pagamento Total', en: 'Full Payment' },
    'BALANCE': { pt: 'Saldo Restante', en: 'Remaining Balance' }
  };
  return types[type]?.[locale] || type;
}

function formatDateForEmail(dateStr: string, locale: string): string {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-GB', {
             weekday: 'long', 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric',
             hour: '2-digit',
             minute: '2-digit'
        }).format(date);
    } catch {
        return dateStr;
    }
}
