import { vi } from 'vitest';

const emailMocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: emailMocks.createTransport,
  },
}));

describe('EmailService', () => {
  const previousEnv = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'admin@example.com';
    process.env.SMTP_PASS = 'secret';

    emailMocks.createTransport.mockReturnValue({
      sendMail: emailMocks.sendMail,
    });
    emailMocks.sendMail.mockResolvedValue({});
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('sends contact email with replyTo and converted line breaks', async () => {
    const emailService = await import('./EmailService');

    await emailService.sendContactEmail('Jane', 'jane@example.com', 'Line 1\nLine 2');

    expect(emailMocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'admin@example.com',
          pass: 'secret',
        },
      })
    );

    expect(emailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        replyTo: 'jane@example.com',
        subject: 'Novo contato de Jane',
        html: expect.stringContaining('Line 1<br>Line 2'),
      })
    );
  });

  it('throws when SMTP configuration is missing', async () => {
    delete process.env.SMTP_HOST;
    const emailService = await import('./EmailService');

    await expect(emailService.sendContactEmail('Jane', 'jane@example.com', 'Message')).rejects.toThrow(
      'SMTP configuration is missing. Please check your environment variables.'
    );
  });

  it('sends PT booking confirmation for BALANCE with completion closing text', async () => {
    const emailService = await import('./EmailService');

    await emailService.sendBookingConfirmation({
      customerName: 'Cliente',
      customerEmail: 'cliente@example.com',
      amount: 'GBP 200.00',
      packageName: 'Pacote Premium',
      paymentType: 'BALANCE',
      locale: 'pt',
      stripeSessionId: 'MANUAL-ABC12345',
      sessionDate: '2026-05-03T10:00:00.000Z',
    });

    expect(emailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@example.com',
        subject: 'Confirmação de Pagamento - Bruna Alves Photography',
        html: expect.stringContaining('Obrigada por concluir o pagamento da sua sessão.'),
      })
    );

    const html = emailMocks.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('ABC12345');
    expect(html).not.toContain('A Taxa de Reserva (Booking Fee) não é reembolsável');
  });

  it('sends EN booking confirmation with policy text and receipt button', async () => {
    const emailService = await import('./EmailService');

    await emailService.sendBookingConfirmation({
      customerName: 'Client',
      customerEmail: 'client@example.com',
      amount: 'GBP 300.00',
      packageName: 'Premium Package',
      paymentType: 'FULL',
      locale: 'en',
      stripeSessionId: 'cs_test_12345678',
      receiptUrl: 'https://receipt.example',
    });

    const html = emailMocks.sendMail.mock.calls[0][0].html as string;

    expect(emailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: 'Payment Confirmation - Bruna Alves Photography',
      })
    );
    expect(html).toContain('The Booking Fee is non-refundable');
    expect(html).toContain('View Receipt');
    expect(html).toContain('https://receipt.example');
    expect(html).toContain('I will be in touch shortly to confirm the next steps for your session.');
  });

  it('sends admin booking notification with locale and payment details', async () => {
    const emailService = await import('./EmailService');

    await emailService.sendAdminBookingNotification({
      customerName: 'Client',
      customerEmail: 'client@example.com',
      amount: '250.00',
      packageName: 'Package A',
      paymentType: 'DEPOSIT',
      locale: 'en',
      stripeSessionId: 'cs_test_1234',
    });

    expect(emailMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: '💰 Nova Venda: Client (£250.00)',
        html: expect.stringContaining('Idioma do Cliente:</strong> EN'),
      })
    );
  });
});
