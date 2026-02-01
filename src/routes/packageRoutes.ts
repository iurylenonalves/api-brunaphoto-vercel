import { Router } from 'express';
import { PackageController } from '../controllers/packageController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Public Routes (Listing for the site)
router.get('/', PackageController.index);
router.get('/:id', PackageController.show);

// Protected Routes (Admin Dashboard)
router.post('/', requireAuth, PackageController.create);
router.put('/:id', requireAuth, PackageController.update);
router.delete('/:id', requireAuth, PackageController.delete);

export default router;
