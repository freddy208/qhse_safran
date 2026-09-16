import { Router, Request, Response } from 'express';
import bcrypt            from 'bcryptjs';
import jwt               from 'jsonwebtoken';
import rateLimit         from 'express-rate-limit';
import { z }             from 'zod';
import { requireAuth }   from '../middleware/auth';
import { ah }            from '../lib/asyncHandler';
import prisma            from '../lib/prisma';

const router  = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  nom:         z.string().min(2).max(100),
  email:       z.string().email(),
  motDePasse:  z.string().min(8).max(128),
});

const loginSchema = z.object({
  email:      z.string().email(),
  motDePasse: z.string().min(1),
});

// POST /api/auth/register
router.post('/register', ah(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { nom, email, motDePasse } = parsed.data;
  const exists = await prisma.utilisateur.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });

  const hash = await bcrypt.hash(motDePasse, 12);
  const user = await prisma.utilisateur.create({
    data: { nom, email, motDePasseHash: hash },
    select: { id: true, nom: true, email: true, role: true, dateCreation: true },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  return res.status(201).json({ token, user });
}));

// POST /api/auth/login  (rate limited)
router.post('/login', loginLimiter, ah(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, motDePasse } = parsed.data;
  const user = await prisma.utilisateur.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const ok = await bcrypt.compare(motDePasse, user.motDePasseHash);
  if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
  return res.json({
    token,
    user: { id: user.id, nom: user.nom, email: user.email, role: user.role },
  });
}));

// GET /api/auth/me
router.get('/me', requireAuth, ah(async (req: Request, res: Response) => {
  const user = await prisma.utilisateur.findUnique({
    where: { id: req.user!.id },
    select: { id: true, nom: true, email: true, role: true, dateCreation: true },
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.json(user);
}));

export default router;
