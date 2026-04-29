import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
  process.env.ALLOWED_ADMINS = process.env.ALLOWED_ADMINS || 'admin@example.com';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_local_tests';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_placeholder_for_local_tests';
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});