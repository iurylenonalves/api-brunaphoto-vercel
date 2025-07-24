import { Request, Response, NextFunction } from "express";
import { verifyJWT } from "../utils/jwt";

// Extends the Express Request interface to include the user payload
interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided or malformed header." });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Unauthorized: No token provided." });
    return;
  }

  try {
    // Verify the token using the secret key
    const decoded = verifyJWT(token);

    if (!decoded) {
      res.status(401).json({ error: "Unauthorized: Invalid token." });
      return;
    }

    // Attach user information to the request object
    req.user = decoded;
    
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: Invalid token." });
    return;
  }
};