import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  id:    number;
  email: string;
  nom:   string;
  role:  string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// Les écritures (POST/PUT/DELETE) sont réservées aux admins
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs' });
  }
  next();
}
