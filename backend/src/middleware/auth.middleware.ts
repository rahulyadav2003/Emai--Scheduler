import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../db/prisma';

export interface AuthUserPayload {
  id: string;
  email: string;
  name?: string | null;
  googleId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fallback to HTTP-only cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
    if (!decoded || !decoded.id) {
      res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      return;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      googleId: decoded.googleId,
    };
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export default authenticateToken;
