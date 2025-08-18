import { Handler, Request, Response, NextFunction } from "express";
import { PostService } from "../services/PostService";

export class PostController {
  constructor(private readonly postService: PostService) {}

  getPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale } = req.query; // Pega o locale da query
      const posts = await this.postService.findAll(locale as string | undefined);
      res.json(posts);
    } catch (error) {
      next(error);
    }
  };

  getPostBySlug: Handler = async (req: Request, res: Response, next: NextFunction) => {
     try {
      const { slug } = req.params;
      const { locale } = req.query;
      
      if (typeof locale !== 'string') {
        res.status(400).json({ error: "Locale query parameter is required." });
        return;
      }

      const post = await this.postService.findBySlug(slug, locale);
      res.json(post);
    } catch (error) {
      next(error);
    }
  };

  getRelatedPost: Handler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { relatedSlug } = req.query;
      const { locale } = req.query;

      if (typeof relatedSlug !== "string" || typeof locale !== "string") {
        res.status(400).json({ error: "relatedSlug and locale query parameters are required." });
        return;
      }

      const post = await this.postService.findByRelatedSlug(relatedSlug, locale);
      res.json(post);
    } catch (error) {
      next(error);
    }
  };

  create: Handler = async (req: Request, res: Response, next: NextFunction) => {
    console.log("\n--- [POST /api/posts] Received Request (New JSON Flow) ---");
    try {
      const { title, subtitle, locale, blocks, publishedAt, thumbnailSrc, relatedSlug, thumbnailAlt } = req.body;      

      if (!title || !subtitle || !locale || !blocks) {
        console.error("[Controller] Validation failed: Missing required fields.");
        res.status(400).json({ error: "Title, subtitle, locale, and blocks are required." });
        return;
      }
          
      console.log("[Controller] Calling PostService.create...");
      const newPost = await this.postService.create({
        title,
        subtitle,
        locale,
        blocks,
        publishedAt,
        thumbnailSrc,
        relatedSlug,
        thumbnailAlt,
      });
      console.log("[Controller] PostService.create finished successfully. Post ID:", newPost.id);

      res.status(201).json(newPost);
      console.log("--- [POST /api/posts] Request Finished Successfully ---\n");
    } catch (error) {
      console.error("--- !!! [POST /api/posts] UNHANDLED ERROR IN CONTROLLER !!! ---");
      console.error(error);
      console.error("----------------------------------------------------------\n");
      next(error);
    }
  };

  update: Handler = async (req: Request, res: Response, next: NextFunction) => {
    console.log("\n--- [PUT /api/posts/:slug] Received Update Request (New JSON Flow) ---");
    try {
      const { slug } = req.params;
      const { locale, title, subtitle, blocks, publishedAt, thumbnailSrc, relatedSlug, thumbnailAlt } = req.body;
            
      console.log("[Controller] Update request for slug:", slug);
      console.log("[Controller] Received data:", { title, subtitle, locale, publishedAt });      
  
      if (!title || !subtitle || !locale || !blocks) {
        console.error("[Controller] Validation failed: Missing required fields.");
        res.status(400).json({ error: "Title, subtitle, locale, and blocks are required." });
        return;
      }

      console.log("[Controller] Calling PostService.update...");
      const updatedPost = await this.postService.update(slug, locale, {
        title,
        subtitle,
        blocks,
        publishedAt,        
        thumbnailSrc,
        relatedSlug,
        thumbnailAlt,
      });
      
      console.log("[Controller] PostService.update finished successfully. Post ID:", updatedPost.id);
      res.json({
        message: "Post updated successfully",
        post: updatedPost,
      });
      console.log("--- [PUT /api/posts/:slug] Request Finished Successfully ---\n");
    } catch (error) {
      console.error("--- !!! [PUT /api/posts/:slug] UNHANDLED ERROR IN CONTROLLER !!! ---");
      console.error(error);
      console.error("----------------------------------------------------------\n");
      next(error);
    }
  };

  delete: Handler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const { locale } = req.query;

      if (typeof locale !== "string") {
        res.status(400).json({ error: "Locale query parameter is required for deletion." });
        return;
      }

      await this.postService.delete(slug, locale);
      res.json({ message: "Post deleted successfully." });
    } catch (error) {
      next(error);
    }
  };
}