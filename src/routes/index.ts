import { Router } from "express";
import postRoutes from "./postRoutes";
import authRoutes from "./authRoutes";
import contactRoutes from "./contactRoutes";
import uploadRoutes from "./uploadRoutes";
import checkoutRoutes from "./checkoutRoutes";
import webhookRoutes from "./webhookRoutes";
import packageRoutes from "./packageRoutes";
import bookingRoutes from "./bookingRoutes";

const router = Router();

router.use("/posts", postRoutes);
router.use("/auth", authRoutes);
router.use("/contacts", contactRoutes); 
router.use("/contact", contactRoutes); 
router.use("/uploads", uploadRoutes);

// Payment & Packages
router.use("/packages", packageRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/webhooks", webhookRoutes);

// Admin Only
// Note: We might want to protect `bookings` specifically, but the route file already has middleware attached
router.use("/bookings", bookingRoutes);


export default router;