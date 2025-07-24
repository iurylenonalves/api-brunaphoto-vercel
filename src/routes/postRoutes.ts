import { Router } from "express";
import { PostController } from "../controllers/postController";
import { PostService } from "../services/PostService";
import { requireAuth } from "../middlewares/auth";
import { upload } from "../middlewares/upload";

const router = Router();

const postService = new PostService();
const postController = new PostController(postService);

router.get("/", postController.getPosts);
router.get("/:slug", postController.getPostBySlug);

router.post("/", requireAuth, upload.array("images"), postController.create);

router.put("/:slug", requireAuth, upload.array("images"), postController.update);
router.delete("/:slug", requireAuth, postController.delete);

export default router;