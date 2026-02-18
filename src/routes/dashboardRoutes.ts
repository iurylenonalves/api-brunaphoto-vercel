import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { requireAuth } from '../middlewares/auth'; // Ensure this path is correct

const router = Router();

// Protect dashboard routes
router.use(requireAuth);

router.get('/stats', DashboardController.getStats);

export default router;
