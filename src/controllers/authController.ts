import { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../database/client";
import { generateJWT } from '../utils/jwt';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const allowedAdmins = process.env.ALLOWED_ADMINS
  ? process.env.ALLOWED_ADMINS.split(",").map(email => email.trim())
  : [];

export const googleAuth: RequestHandler = async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400).json({ error: "Missing credential" });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(401).json({ error: "No email found" });
      return;
    }

    // Check if the user is an allowed admin    
    if (!allowedAdmins.includes(payload.email)) {
      console.warn(`Unauthorized login attempt: ${payload.email}`);
      res.status(403).json({ error: "Access denied: not an admin" });
      return;
    }

    // Only allows registered admins (or creates automatically)
    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name,
          avatar: payload.picture,
        },
      });
    }

    // Generate JWT token for the user    
    const token = generateJWT({ userId: user.id, email: user.email });

    res.json({ token });
  } catch (err) {
    res.status(401).json({ error: "Invalid Google token" });
  }
};