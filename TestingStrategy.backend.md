# Backend Testing Strategy

## Objectives
- Prevent regressions in auth, checkout, and validation flows.
- Enforce stable API contracts.
- Catch security and input handling issues early.

## Stack
- Vitest (test runner)
- Supertest (HTTP integration)
- @vitest/coverage-v8 (coverage)

## Test Types

### 1. Unit Tests
Scope: isolated logic and middleware behavior.

Targets:
- `src/schemas/*.ts`
- `src/middlewares/*.ts`
- token helpers and utility guards

### 2. Integration Tests (API)
Scope: route + controller behavior with mocked externals.

Targets:
- `POST /api/auth/google`
- `POST /api/checkout/session`
- `POST /api/checkout/manual`
- health endpoints

Rules:
- Assert status, response shape, and error shape.
- Mock Stripe, Nodemailer, Google OAuth, and DB edges where needed.

### 3. Security-Focused Tests
Scope: malformed payloads, missing auth, unauthorized access.

Targets:
- auth middleware (`401` paths)
- schema validation failures (`400` paths)
- payment flow guardrails (wrong payment method/token)

### 4. Error Handling Tests
Scope: failure scenarios.

Targets:
- external provider failures
- invalid token/signature flows
- unexpected exceptions return safe responses

## Coverage Phases

### Phase 1 (current target)
- Coverage gate: 60% on critical paths:
  - `src/app.ts`
  - `src/controllers/authController.ts`
  - `src/middlewares/auth.ts`
  - `src/schemas/checkoutSchema.ts`

### Phase 2
- Expand coverage scope to all controller/middleware/schema files.
- Target: 80% overall coverage.

## Organization
- Co-located tests with source: `*.test.ts`
- Optional shared setup: `tests/setup.ts`

## Naming
- `*.test.ts`
- Use behavior-focused names:
  - `returns 401 when token is missing`
  - `returns 403 when email is not in allowed admins`

## External Dependencies
Must be mocked in tests:
- Stripe
- Nodemailer
- Google OAuth
- Blob storage APIs

## CI Gate
Every PR must pass:
- `npm run lint` (when configured)
- `npm run test`
- `npm run test:coverage`
