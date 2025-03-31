export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}