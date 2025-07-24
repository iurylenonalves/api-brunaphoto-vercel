import { Router } from "express";
import postRoutes from "./postRoutes";
import authRoutes from "./authRoutes";
import contactRoutes from "./contactRoutes";

const router = Router();

router.use("/posts", postRoutes);
router.use("/auth", authRoutes);
router.use("/", contactRoutes);

export default router;