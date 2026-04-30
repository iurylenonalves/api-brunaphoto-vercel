import type { Request, Response } from 'express';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deletePkg: vi.fn(),
}));

vi.mock('../services/PackageService', () => ({
  PackageService: {
    listAll: mocks.listAll,
    findById: mocks.findById,
    create: mocks.create,
    update: mocks.update,
    delete: mocks.deletePkg,
  },
}));

import { PackageController } from './packageController';

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

const mockPackage = {
  id: 'pkg-1',
  name: 'Essential',
  namePt: 'Essencial',
  totalPrice: 300,
  depositPrice: 100,
  active: true,
};

describe('PackageController', () => {
  describe('index', () => {
    it('returns active packages from PackageService.listAll(false)', async () => {
      mocks.listAll.mockResolvedValueOnce([mockPackage]);
      const req = {} as Request;
      const res = createMockResponse();

      await PackageController.index(req, res);

      expect(mocks.listAll).toHaveBeenCalledWith(false);
      expect(res.json).toHaveBeenCalledWith([mockPackage]);
    });
  });

  describe('adminList', () => {
    it('returns all packages from PackageService.listAll(true)', async () => {
      mocks.listAll.mockResolvedValueOnce([mockPackage]);
      const req = {} as Request;
      const res = createMockResponse();

      await PackageController.adminList(req, res);

      expect(mocks.listAll).toHaveBeenCalledWith(true);
      expect(res.json).toHaveBeenCalledWith([mockPackage]);
    });
  });

  describe('show', () => {
    it('returns package when found', async () => {
      mocks.findById.mockResolvedValueOnce(mockPackage);
      const req = { params: { id: 'pkg-1' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.show(req, res);

      expect(mocks.findById).toHaveBeenCalledWith('pkg-1');
      expect(res.json).toHaveBeenCalledWith(mockPackage);
    });

    it('returns 404 when package is not found', async () => {
      mocks.findById.mockResolvedValueOnce(null);
      const req = { params: { id: 'missing' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.show(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not found' });
    });
  });

  describe('create', () => {
    it('returns 400 when name is missing', async () => {
      const req = { body: { totalPrice: 300, depositPrice: 100 } } as Request;
      const res = createMockResponse();

      await PackageController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('required') })
      );
    });

    it('returns 400 when totalPrice is missing', async () => {
      const req = { body: { name: 'Essential', depositPrice: 100 } } as Request;
      const res = createMockResponse();

      await PackageController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when depositPrice is missing', async () => {
      const req = { body: { name: 'Essential', totalPrice: 300 } } as Request;
      const res = createMockResponse();

      await PackageController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 201 with created package on success', async () => {
      mocks.create.mockResolvedValueOnce(mockPackage);
      const req = {
        body: { name: 'Essential', totalPrice: 300, depositPrice: 100 },
      } as Request;
      const res = createMockResponse();

      await PackageController.create(req, res);

      expect(mocks.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockPackage);
    });

    it('returns 500 when service throws', async () => {
      mocks.create.mockRejectedValueOnce(new Error('DB error'));
      const req = {
        body: { name: 'Essential', totalPrice: 300, depositPrice: 100 },
      } as Request;
      const res = createMockResponse();

      await PackageController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('update', () => {
    it('returns updated package on success', async () => {
      mocks.update.mockResolvedValueOnce({ ...mockPackage, name: 'Updated' });
      const req = { params: { id: 'pkg-1' }, body: { name: 'Updated' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.update(req, res);

      expect(mocks.update).toHaveBeenCalledWith('pkg-1', { name: 'Updated' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }));
    });

    it('returns 404 when package is not found', async () => {
      mocks.update.mockRejectedValueOnce(new Error('Package not found'));
      const req = { params: { id: 'missing' }, body: {} } as unknown as Request;
      const res = createMockResponse();

      await PackageController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not found' });
    });

    it('returns 500 on unexpected error', async () => {
      mocks.update.mockRejectedValueOnce(new Error('DB error'));
      const req = { params: { id: 'pkg-1' }, body: {} } as unknown as Request;
      const res = createMockResponse();

      await PackageController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('delete', () => {
    it('deletes package and responds with 204', async () => {
      mocks.deletePkg.mockResolvedValueOnce(undefined);
      const req = { params: { id: 'pkg-1' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.delete(req, res);

      expect(mocks.deletePkg).toHaveBeenCalledWith('pkg-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 404 when package is not found', async () => {
      mocks.deletePkg.mockRejectedValueOnce(new Error('Package not found'));
      const req = { params: { id: 'missing' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Package not found' });
    });

    it('returns 500 on unexpected error', async () => {
      mocks.deletePkg.mockRejectedValueOnce(new Error('DB error'));
      const req = { params: { id: 'pkg-1' } } as unknown as Request;
      const res = createMockResponse();

      await PackageController.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
