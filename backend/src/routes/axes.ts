import { Router, Request, Response } from 'express';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { calculerScoreAxe, calculerScoreProjet } from '../lib/scores';
import { logAudit }     from '../lib/auditLog';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();

export async function sauvegarderHistoriqueProjet(projetId: number) {
  const axes = await prisma.axe.findMany({
    where: { projetId },
    include: { sousActions: true },
  });
  const score = calculerScoreProjet(axes);
  await prisma.historiqueScore.create({ data: { projetId, score } });
  for (const ax of axes) {
    await prisma.historiqueScore.create({
      data: { projetId, axeId: ax.id, score: calculerScoreAxe(ax.sousActions) },
    });
  }
}

const axeSchema = z.object({
  code:        z.string().min(1).max(20),
  intitule:    z.string().min(1).max(200),
  ponderation: z.number().min(0).max(100),
});

// GET /api/projets/:projetId/axes
router.get('/projets/:projetId/axes', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const axes = await prisma.axe.findMany({
    where: { projetId },
    include: { sousActions: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });
  return res.json(axes.map((ax) => ({ ...ax, score: calculerScoreAxe(ax.sousActions) })));
}));

// POST /api/projets/:projetId/axes
router.post('/projets/:projetId/axes', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const parsed = axeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const axe = await prisma.axe.create({ data: { ...parsed.data, projetId } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'axes', ligneId: axe.id, champModifie: 'création', nouvelleValeur: axe.intitule });
  return res.status(201).json({ ...axe, score: 0 });
}));

// GET /api/axes/:id
router.get('/axes/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const axe = await prisma.axe.findUnique({
    where: { id },
    include: { sousActions: { orderBy: { id: 'asc' } } },
  });
  if (!axe) return res.status(404).json({ error: 'Axe introuvable' });
  return res.json({ ...axe, score: calculerScoreAxe(axe.sousActions) });
}));

// PUT /api/axes/:id
router.put('/axes/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const parsed = axeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const avant = await prisma.axe.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Axe introuvable' });
  const axe = await prisma.axe.update({ where: { id }, data: parsed.data });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'axes', ligneId: id, champModifie: 'mise à jour', ancienneValeur: JSON.stringify(avant), nouvelleValeur: JSON.stringify(axe) });
  await sauvegarderHistoriqueProjet(axe.projetId);
  return res.json(axe);
}));

// DELETE /api/axes/:id
router.delete('/axes/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const axe = await prisma.axe.findUnique({ where: { id } });
  if (!axe) return res.status(404).json({ error: 'Axe introuvable' });
  await prisma.axe.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'axes', ligneId: id, champModifie: 'suppression', ancienneValeur: axe.intitule });
  return res.status(204).send();
}));

export default router;
