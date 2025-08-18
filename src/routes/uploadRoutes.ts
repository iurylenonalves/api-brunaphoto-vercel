import { Router } from "express";
import { UploadController } from "../controllers/uploadController";
import { requireAuth } from "../middlewares/auth";
import { upload } from "../middlewares/multer";

const router = Router();
const uploadController = new UploadController();

// POST /api/uploads/sign
router.post("/sign", uploadController.sign);

router.post(
  "/image",
  requireAuth,
  upload.single("image"),
  uploadController.processAndStoreImage
);

export default router;
