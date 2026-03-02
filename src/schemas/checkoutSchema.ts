import { z } from 'zod';

const paymentTypeSchema = z.enum(['DEPOSIT', 'FULL', 'BALANCE'], {
  errorMap: () => ({ message: "Payment type must be DEPOSIT, FULL, or BALANCE" })
});

const paymentMethodSchema = z.enum(['CARD', 'BANK_TRANSFER'], {
  errorMap: () => ({ message: 'Payment method must be CARD or BANK_TRANSFER' })
});

const localeSchema = z.enum(['en', 'pt']);

export const checkoutSessionSchema = z.object({
  lockedToken: z.string().min(1, 'Locked payment token is required'),
  customerEmail: z.string().email("Invalid email address").optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" })
  }),
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

export const checkoutManualSchema = z.object({
  lockedToken: z.string().min(1, 'Locked payment token is required'),
  customerName: z.string().min(2, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email address'),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' })
  }),
});

export type CheckoutManualInput = z.infer<typeof checkoutManualSchema>;

export const generatePaymentLinkSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  paymentType: paymentTypeSchema,
  paymentMethod: paymentMethodSchema,
  locale: localeSchema.optional().default('en'),
  sessionDate: z.string().optional(),
});

export type GeneratePaymentLinkInput = z.infer<typeof generatePaymentLinkSchema>;
