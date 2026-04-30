import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/app.ts',
        'src/controllers/authController.ts',
        'src/controllers/checkoutController.ts',
        'src/middlewares/auth.ts',
        'src/middlewares/error-handler.ts',
        'src/middlewares/zodValidation.ts',
        'src/schemas/checkoutSchema.ts',
        'src/services/EmailService.ts',
        'src/services/StripeService.ts',
        'src/utils/jwt.ts',
        'src/utils/paymentLinkToken.ts',
      ],
      exclude: ['src/**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});