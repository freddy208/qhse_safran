import { Router, Request, Response } from 'express';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { calculerConformiteProduit, calculerTauxConformiteArmoire } from '../lib/scores';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();

const produitSchema = z.object({
  nom:                 z.string().min(1).max(200),
  codeProduit:         z.string().max(100).optional().nullable(),
  quantitePresente:    z.number().optional().nullable(),
  quantiteUtilisee:    z.number().optional().nullable(),
  volumeMax:           z.number().optional().nullable(),
  datePeremption:      z.string().datetime().optional().nullable(),
  urlFds:              z.string().url().optional().nullable().or(z.literal('')),
  fdsDateVerification: z.string().datetime().optional().nullable(),
});

async function getTauxArmoire(armoireId: number): Promise<number | null> {
  const resultats = await prisma.resultatCritere.findMany({ where: { armoireId } });
  return calculerTauxConformiteArmoire(resultats);
}

// GET /api/armoires/:armoireId/produits  (avec pagination)
router.get('/armoires/:armoireId/produits', requireAuth, ah(async (req: Request, res: Response) => {
  const armoireId = parseId(req.params.armoireId, res); if (armoireId === null) return;

  const page  = Math.max(1, parseInt(req.query.page  as string || '1',  10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '100', 10) || 100));
  const skip  = (page - 1) * limit;

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({ where: { armoireId }, orderBy: { id: 'asc' }, skip, take: limit }),
    prisma.produit.count({ where: { armoireId } }),
  ]);

  const taux   = await getTauxArmoire(armoireId);
  const result = produits.map((p) => ({ ...p, conformite: calculerConformiteProduit(p, taux) }));
  return res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
}));

// POST /api/armoires/:armoireId/produits
router.post('/armoires/:armoireId/produits', requireAuth, ah(async (req: Request, res: Response) => {
  const armoireId = parseId(req.params.armoireId, res); if (armoireId === null) return;
  const armoire   = await prisma.armoire.findUnique({ where: { id: armoireId } });
  if (!armoire) return res.status(404).json({ error: 'Armoire introuvable' });

  const parsed = produitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const produit = await prisma.produit.create({
    data: {
      armoireId,
      nom:                 parsed.data.nom,
      codeProduit:         parsed.data.codeProduit ?? null,
      quantitePresente:    parsed.data.quantitePresente ?? null,
      quantiteUtilisee:    parsed.data.quantiteUtilisee ?? null,
      volumeMax:           parsed.data.volumeMax ?? null,
      datePeremption:      parsed.data.datePeremption ? new Date(parsed.data.datePeremption) : null,
      urlFds:              parsed.data.urlFds || null,
      fdsDateVerification: parsed.data.fdsDateVerification ? new Date(parsed.data.fdsDateVerification) : null,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'produits', ligneId: produit.id, champModifie: 'création', nouvelleValeur: produit.nom });
  const taux = await getTauxArmoire(armoireId);
  return res.status(201).json({ ...produit, conformite: calculerConformiteProduit(produit, taux) });
}));

// PUT /api/produits/:id
router.put('/produits/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id    = parseId(req.params.id, res); if (id === null) return;
  const avant = await prisma.produit.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Produit introuvable' });

  const parsed = produitSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const produit = await prisma.produit.update({
    where: { id },
    data: {
      nom:                 parsed.data.nom,
      codeProduit:         parsed.data.codeProduit,
      quantitePresente:    parsed.data.quantitePresente,
      quantiteUtilisee:    parsed.data.quantiteUtilisee,
      volumeMax:           parsed.data.volumeMax,
      datePeremption:      parsed.data.datePeremption ? new Date(parsed.data.datePeremption) : undefined,
      urlFds:              parsed.data.urlFds === '' ? null : parsed.data.urlFds,
      fdsDateVerification: parsed.data.fdsDateVerification ? new Date(parsed.data.fdsDateVerification) : undefined,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'produits', ligneId: id, champModifie: 'mise à jour', ancienneValeur: JSON.stringify(avant), nouvelleValeur: JSON.stringify(produit) });
  const taux = await getTauxArmoire(produit.armoireId);
  return res.json({ ...produit, conformite: calculerConformiteProduit(produit, taux) });
}));

// DELETE /api/produits/:id
router.delete('/produits/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return res.status(404).json({ error: 'Produit introuvable' });
  await prisma.produit.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'produits', ligneId: id, champModifie: 'suppression', ancienneValeur: produit.nom });
  return res.status(204).send();
}));

export default router;
