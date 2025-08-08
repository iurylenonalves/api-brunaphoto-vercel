import { Router } from "express";
import postRoutes from "./postRoutes";
import authRoutes from "./authRoutes";
import contactRoutes from "./contactRoutes";
import uploadRoutes from "./uploadRoutes";

const router = Router();

router.use("/posts", postRoutes);
router.use("/auth", authRoutes);
router.use("/contact", contactRoutes);
// Temporary compatibility route for frontend
router.use("/contacts", contactRoutes);
router.use("/uploads", uploadRoutes);

export default router;