import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in the environment variables.');
}

interface JwtPayload {
  userId: string;
  email: string;
}

export function generateJWT(payload: JwtPayload): string {
  // Added "!" to assert to TypeScript that JWT_SECRET is not null/undefined here.
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: '1d' });
}

export function verifyJWT(token: string): JwtPayload | null {
  try {
    // Added "!" and safe conversion using "as unknown".
    const decoded = jwt.verify(token, JWT_SECRET!) as unknown as JwtPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}