import { Router, Request, Response } from 'express';
import { requireAuth }  from '../middleware/auth';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';
import { calculerScoreProjet, calculerScoreAxe } from '../lib/scores';
import { ah }           from '../lib/asyncHandler';

const router = Router();

// GET /api/projets
router.get('/projets', requireAuth, ah(async (_req: Request, res: Response) => {
  const projets = await prisma.projet.findMany({
    include: {
      axes: { include: { sousActions: true } },
    },
  });

  const result = projets.map((p) => ({
    id:          p.id,
    nom:         p.nom,
    description: p.description,
    scoreGlobal: calculerScoreProjet(p.axes),
    nbAxes:      p.axes.length,
  }));

  return res.json(result);
}));

// GET /api/projets/:id
router.get('/projets/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const projet = await prisma.projet.findUnique({
    where: { id },
    include: {
      axes: {
        include: { sousActions: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  const axes = projet.axes.map((ax) => ({
    ...ax,
    score: calculerScoreAxe(ax.sousActions),
  }));

  return res.json({
    id:          projet.id,
    nom:         projet.nom,
    description: projet.description,
    scoreGlobal: calculerScoreProjet(projet.axes),
    axes,
  });
}));

export default router;
