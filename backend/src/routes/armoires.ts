import { Router, Request, Response } from 'express';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { calculerTauxConformiteArmoire } from '../lib/scores';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();
const armoireSchema = z.object({ nom: z.string().min(1).max(100) });

// GET /api/zones/:zoneId/armoires
router.get('/zones/:zoneId/armoires', requireAuth, ah(async (req: Request, res: Response) => {
  const zoneId = parseId(req.params.zoneId, res); if (zoneId === null) return;
  const armoires = await prisma.armoire.findMany({
    where: { zoneId },
    include: { resultats: true, produits: true },
    orderBy: { id: 'asc' },
  });
  const result = armoires.map((a) => ({
    ...a,
    tauxConformite: calculerTauxConformiteArmoire(a.resultats),
    nbProduits:     a.produits.length,
  }));
  return res.json(result);
}));

// POST /api/zones/:zoneId/armoires
router.post('/zones/:zoneId/armoires', requireAuth, ah(async (req: Request, res: Response) => {
  const zoneId = parseId(req.params.zoneId, res); if (zoneId === null) return;
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return res.status(404).json({ error: 'Zone introuvable' });
  const parsed = armoireSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const armoire = await prisma.armoire.create({ data: { ...parsed.data, zoneId } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'armoires', ligneId: armoire.id, champModifie: 'création', nouvelleValeur: armoire.nom });
  return res.status(201).json(armoire);
}));

// PUT /api/armoires/:id
router.put('/armoires/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const parsed = armoireSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const avant = await prisma.armoire.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Armoire introuvable' });
  const armoire = await prisma.armoire.update({ where: { id }, data: parsed.data });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'armoires', ligneId: id, champModifie: 'nom', ancienneValeur: avant.nom, nouvelleValeur: armoire.nom });
  return res.json(armoire);
}));

// DELETE /api/armoires/:id
router.delete('/armoires/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const armoire = await prisma.armoire.findUnique({ where: { id } });
  if (!armoire) return res.status(404).json({ error: 'Armoire introuvable' });
  await prisma.armoire.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'armoires', ligneId: id, champModifie: 'suppression', ancienneValeur: armoire.nom });
  return res.status(204).send();
}));

export default router;
