import { z } from 'zod';

export const checkoutSessionSchema = z.object({
  packageId: z.string().min(1, "Package ID is required"),
  paymentType: z.enum(['DEPOSIT', 'FULL', 'BALANCE'], {
    errorMap: (issue, ctx) => ({ message: "Payment type must be DEPOSIT, FULL, or BALANCE" })
  }),
  locale: z.enum(['en', 'pt']).optional().default('en'),
  customerEmail: z.string().email("Invalid email address").optional(),
  sessionDate: z.string().optional(), // Allow string date, validation can be improved if specific format needed
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;
