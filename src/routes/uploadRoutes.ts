import { Router } from "express";
import { UploadController } from "../controllers/uploadController";

const router = Router();
const uploadController = new UploadController();

// POST /api/uploads/sign
router.post("/sign", uploadController.sign);

export default router;
