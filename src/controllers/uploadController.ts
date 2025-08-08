import { Request, Response } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyJWT } from "../utils/jwt";

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
}
