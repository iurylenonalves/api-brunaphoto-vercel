import { Request, Response, NextFunction } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyJWT } from "../utils/jwt";
import { PostService, ProcessedImageResult } from "../services/PostService";
import { HttpError } from "../errors/HttpError";

/**
  * This method has been replaced by the upload flow via /api/uploads/image.
  * Temporarily kept during the transition.
  * 
  * Generates a token for the client to upload directly to Vercel Blob.
  */
export class UploadController {
  // Generates a short-lived client token for direct-to-Blob uploads
  // and receives the upload completion webhook from Vercel Blob.
  sign = async (req: Request, res: Response) => {
    try {
      const body = req.body as HandleUploadBody;

      const jsonResponse = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
          // Expect a JSON string with a JWT from the client
          if (!clientPayload) {
            throw new Error("Missing clientPayload");
          }

          let token: string | undefined;
          try {
            const parsed = JSON.parse(clientPayload);
            token = parsed?.jwt as string | undefined;
          } catch {
            // ignore JSON parse error
          }
          if (!token) throw new Error("Missing JWT in clientPayload");

          const decoded = verifyJWT(token);
          if (!decoded) throw new Error("Invalid JWT");

          // Optionally restrict path prefix
          // if (!pathname.startsWith('posts/')) throw new Error('Invalid upload path');

          return {
            allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
            maximumSizeInBytes: 200 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ userId: decoded.userId }),
          };
        },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
          try {
            console.log("[Blob] Upload completed:", {
              url: blob?.url,
              pathname: blob?.pathname,
              tokenPayload,
            });
          } catch (err) {
            console.error("[Blob] onUploadCompleted error:", err);
          }
        },
      });

      return res.status(200).json(jsonResponse);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message || "Upload signing failed" });
    }
  };


  /**
   * NEW CENTRALIZED METHOD:
   * Receives an image file, processes it using PostService,
   * and returns the optimized image URL and its data.
   */
  processAndStoreImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new HttpError(400, "No image file provided.");
      }

      // Usamos uma instância do PostService para acessar nosso novo método
      const postService = new PostService();
      const result: ProcessedImageResult = await postService.processAndUploadSingleImage(req.file);
      
      // Retorna os dados da imagem processada para o frontend
      console.log("[UploadController] Image processed successfully:", result.imageUrl);
      res.status(200).json(result);

    } catch (error) {
      // Passa o erro para o middleware de tratamento de erros
      next(error);
    }
  };
}
