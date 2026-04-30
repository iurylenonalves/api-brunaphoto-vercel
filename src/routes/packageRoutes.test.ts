import { vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  index: vi.fn((_req: any, res: any) => res.json([])),
  adminList: vi.fn((_req: any, res: any) => res.json([])),
  show: vi.fn((req: any, res: any) => res.json({ id: req.params.id })),
  create: vi.fn((_req: any, res: any) => res.status(201).json({ ok: true })),
  update: vi.fn((_req: any, res: any) => res.json({ ok: true })),
  deletePkg: vi.fn((_req: any, res: any) => res.status(204).send()),
}));

vi.mock('../utils/jwt', () => ({
  verifyJWT: mocks.verifyJWT,
}));

vi.mock('../controllers/packageController', () => ({
  PackageController: {
    index: mocks.index,
    adminList: mocks.adminList,
    show: mocks.show,
    create: mocks.create,
    update: mocks.update,
    delete: mocks.deletePkg,
  },
}));

import packageRouter from './packageRoutes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/packages', packageRouter);
  return app;
}

describe('packageRoutes', () => {
  describe('public routes (no auth required)', () => {
    it('GET / returns 200 without authorization', async () => {
      await request(buildApp()).get('/packages').expect(200);
    });

    it('GET /:id returns 200 without authorization', async () => {
      await request(buildApp()).get('/packages/pkg-1').expect(200);
    });
  });

  describe('protected routes (auth required)', () => {
    it('POST / returns 401 without authorization', async () => {
      await request(buildApp()).post('/packages').expect(401);
    });

    it('PUT /:id returns 401 without authorization', async () => {
      await request(buildApp()).put('/packages/pkg-1').expect(401);
    });

    it('DELETE /:id returns 401 without authorization', async () => {
      await request(buildApp()).delete('/packages/pkg-1').expect(401);
    });

    it('POST / returns 201 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .post('/packages')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test', totalPrice: 100, depositPrice: 50 })
        .expect(201);
    });

    it('PUT /:id returns 200 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .put('/packages/pkg-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Updated' })
        .expect(200);
    });

    it('DELETE /:id returns 204 with a valid token', async () => {
      mocks.verifyJWT.mockReturnValueOnce({ userId: 'u1', email: 'admin@test.com' });
      await request(buildApp())
        .delete('/packages/pkg-1')
        .set('Authorization', 'Bearer valid-token')
        .expect(204);
    });
  });
});
