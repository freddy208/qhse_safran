import { Router, Request, Response } from 'express';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();

const commentaireSchema = z.object({
  texte:   z.string().min(1).max(2000),
  zoneId:  z.number().int().optional().nullable(),
  axeId:   z.number().int().optional().nullable(),
});

// GET /api/commentaires?zoneId=&axeId=
router.get('/', requireAuth, ah(async (req: Request, res: Response) => {
  const { zoneId, axeId } = req.query;
  const where: Record<string, unknown> = {};
  if (zoneId) {
    const zid = parseInt(zoneId as string, 10);
    if (!isNaN(zid) && zid > 0) where.zoneId = zid;
  }
  if (axeId) {
    const aid = parseInt(axeId as string, 10);
    if (!isNaN(aid) && aid > 0) where.axeId = aid;
  }
  const commentaires = await prisma.commentaire.findMany({
    where,
    include: { auteur: { select: { id: true, nom: true } } },
    orderBy: { date: 'desc' },
    take: 100,
  });
  return res.json(commentaires);
}));

// POST /api/commentaires
router.post('/', requireAuth, ah(async (req: Request, res: Response) => {
  const parsed = commentaireSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const commentaire = await prisma.commentaire.create({
    data: {
      texte:    parsed.data.texte,
      zoneId:   parsed.data.zoneId ?? null,
      axeId:    parsed.data.axeId  ?? null,
      auteurId: req.user!.id,
    },
    include: { auteur: { select: { id: true, nom: true } } },
  });
  return res.status(201).json(commentaire);
}));

// DELETE /api/commentaires/:id
router.delete('/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id          = parseId(req.params.id, res); if (id === null) return;
  const commentaire = await prisma.commentaire.findUnique({ where: { id } });
  if (!commentaire) return res.status(404).json({ error: 'Commentaire introuvable' });
  if (commentaire.auteurId !== req.user!.id) {
    return res.status(403).json({ error: 'Seul l\'auteur peut supprimer ce commentaire' });
  }
  await prisma.commentaire.delete({ where: { id } });
  return res.status(204).send();
}));

export default router;
