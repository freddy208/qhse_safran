import { Router, Request, Response } from 'express';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();

const zoneSchema = z.object({ nom: z.string().min(1).max(100) });

// GET /api/projets/:projetId/zones
router.get('/projets/:projetId/zones', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const zones = await prisma.zone.findMany({
    where: { projetId },
    include: { armoires: true },
    orderBy: { id: 'asc' },
  });
  return res.json(zones);
}));

// POST /api/projets/:projetId/zones
router.post('/projets/:projetId/zones', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const zone = await prisma.zone.create({ data: { ...parsed.data, projetId } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'zones', ligneId: zone.id, champModifie: 'création', nouvelleValeur: zone.nom });
  return res.status(201).json(zone);
}));

// PUT /api/zones/:id
router.put('/zones/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const parsed = zoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const avant = await prisma.zone.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Zone introuvable' });
  const zone = await prisma.zone.update({ where: { id }, data: parsed.data });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'zones', ligneId: id, champModifie: 'nom', ancienneValeur: avant.nom, nouvelleValeur: zone.nom });
  return res.json(zone);
}));

// DELETE /api/zones/:id
router.delete('/zones/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) return res.status(404).json({ error: 'Zone introuvable' });
  await prisma.zone.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'zones', ligneId: id, champModifie: 'suppression', ancienneValeur: zone.nom });
  return res.status(204).send();
}));

export default router;
