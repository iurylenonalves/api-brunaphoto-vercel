import { Router } from 'express';
import { getAllBookings, confirmBookingPayment, deleteBooking } from '../controllers/bookingController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

// Protect all booking routes (admin only)
router.use(requireAuth);

router.get('/', getAllBookings);
router.post('/:id/confirm', confirmBookingPayment);
router.delete('/:id', deleteBooking);

export default router;
