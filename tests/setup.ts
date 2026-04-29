import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
  process.env.ALLOWED_ADMINS = process.env.ALLOWED_ADMINS || 'admin@example.com';
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});