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
  volumeMax:           z.string().max(100).optional().nullable(),
  datePeremption:      z.string().datetime().optional().nullable(),
  urlFds:              z.string().url().optional().nullable().or(z.literal('')),
  fdsDateVerification: z.string().datetime().optional().nullable(),
  statutFds:           z.enum(['A_JOUR', 'OBSOLETE', 'MANQUANTE']).optional().nullable(),
  responsable:         z.string().max(200).optional().nullable(),
  raison:              z.string().max(500).optional().nullable(),
});

async function getTauxArmoire(armoireId: number): Promise<number | null> {
  const resultats = await prisma.resultatCritere.findMany({ where: { armoireId } });
  return calculerTauxConformiteArmoire(resultats);
}

// GET /api/projets/:projetId/produits?statutFds=&perime=&bientot=  (filtre global toutes armoires)
router.get('/projets/:projetId/produits', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId  = parseId(req.params.projetId, res); if (projetId === null) return;
  const statutFds = req.query.statutFds as string | undefined;
  const perime    = req.query.perime    === 'true';
  const bientot   = req.query.bientot   === 'true';

  const where: Record<string, unknown> = {
    armoire: { zone: { projetId } },
  };
  if (statutFds && ['A_JOUR', 'OBSOLETE', 'MANQUANTE'].includes(statutFds)) {
    where.statutFds = statutFds;
  }
  const now   = new Date();
  const in6m  = new Date(now); in6m.setMonth(in6m.getMonth() + 6);
  if (perime) {
    where.datePeremption = { lt: now };
  } else if (bientot) {
    where.datePeremption = { gte: now, lte: in6m };
  }

  const produits = await prisma.produit.findMany({
    where,
    include: { armoire: { include: { zone: true, resultats: true } } },
    orderBy: [{ armoire: { zone: { nom: 'asc' } } }, { armoire: { nom: 'asc' } }, { nom: 'asc' }],
  });

  const result = produits.map((p) => {
    const { armoire, ...prod } = p;
    const taux = calculerTauxConformiteArmoire(armoire.resultats);
    return {
      ...prod,
      conformite:  calculerConformiteProduit(prod, taux),
      armoireNom:  armoire.nom,
      zoneNom:     armoire.zone.nom,
    };
  });

  return res.json({ data: result, total: result.length });
}));

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
      statutFds:           parsed.data.statutFds ?? null,
      responsable:         parsed.data.responsable ?? null,
      raison:              parsed.data.raison ?? null,
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
      statutFds:           parsed.data.statutFds ?? undefined,
      responsable:         parsed.data.responsable ?? undefined,
      raison:              parsed.data.raison ?? undefined,
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
