import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { ah }           from '../lib/asyncHandler';

const router = Router();

// GET /api/type-checklists
router.get('/type-checklists', requireAuth, ah(async (_req: Request, res: Response) => {
  const tcs = await prisma.typeChecklist.findMany({
    include: { criteres: { orderBy: { ordre: 'asc' } } },
  });
  return res.json(tcs);
}));

// POST /api/type-checklists
router.post('/type-checklists', requireAuth, ah(async (req: Request, res: Response) => {
  const schema = z.object({ nom: z.string().min(1).max(200) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const tc = await prisma.typeChecklist.create({ data: parsed.data });
  return res.status(201).json(tc);
}));

// POST /api/type-checklists/:typeId/criteres
router.post('/type-checklists/:typeId/criteres', requireAuth, ah(async (req: Request, res: Response) => {
  const typeChecklistId = parseInt(req.params.typeId, 10);
  const schema = z.object({ libelle: z.string().min(1).max(300), ordre: z.number().int().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const critere = await prisma.critere.create({ data: { ...parsed.data, typeChecklistId } });
  return res.status(201).json(critere);
}));

// PUT /api/criteres/:id
router.put('/criteres/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const schema = z.object({ libelle: z.string().min(1).max(300).optional(), ordre: z.number().int().min(1).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const critere = await prisma.critere.update({ where: { id }, data: parsed.data });
  return res.json(critere);
}));

// DELETE /api/criteres/:id
router.delete('/criteres/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  await prisma.critere.delete({ where: { id } });
  return res.status(204).send();
}));

// GET /api/armoires/:armoireId/resultats?typeChecklistId=X
router.get('/armoires/:armoireId/resultats', requireAuth, ah(async (req: Request, res: Response) => {
  const armoireId       = parseInt(req.params.armoireId, 10);
  const typeChecklistId = req.query.typeChecklistId ? parseInt(req.query.typeChecklistId as string, 10) : undefined;

  const where: Record<string, unknown> = { armoireId };
  if (typeChecklistId) {
    where.critere = { typeChecklistId };
  }

  const resultats = await prisma.resultatCritere.findMany({
    where,
    include: { critere: { include: { typeChecklist: true } } },
    orderBy: { critere: { ordre: 'asc' } },
  });
  return res.json(resultats);
}));

// POST /api/armoires/:armoireId/resultats  (upsert)
router.post('/armoires/:armoireId/resultats', requireAuth, ah(async (req: Request, res: Response) => {
  const armoireId = parseInt(req.params.armoireId, 10);
  const resultatValues = ['CONFORME', 'ECART_MINEUR', 'ECART_MAJEUR'] as const;
  const schema = z.object({
    critereId: z.number().int(),
    resultat:  z.enum(resultatValues),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.resultatCritere.findUnique({
    where: { armoireId_critereId: { armoireId, critereId: parsed.data.critereId } },
  });

  const resultat = await prisma.resultatCritere.upsert({
    where: { armoireId_critereId: { armoireId, critereId: parsed.data.critereId } },
    update: { resultat: parsed.data.resultat },
    create: { armoireId, critereId: parsed.data.critereId, resultat: parsed.data.resultat },
  });

  await logAudit({
    utilisateurId:  req.user!.id,
    tableConcernee: 'resultats_criteres',
    ligneId:        resultat.id,
    champModifie:   'resultat',
    ancienneValeur: existing?.resultat ?? null,
    nouvelleValeur: resultat.resultat,
  });

  // Auto-create alert when a major deviation is detected for the first time
  if (parsed.data.resultat === 'ECART_MAJEUR' && (!existing || existing.resultat !== 'ECART_MAJEUR')) {
    const armoire = await prisma.armoire.findUnique({
      where: { id: armoireId },
      include: { zone: true },
    });
    const critere = await prisma.critere.findUnique({
      where: { id: parsed.data.critereId },
      include: { typeChecklist: true },
    });
    if (armoire && critere) {
      await prisma.alerte.create({
        data: {
          projetId:    armoire.zone.projetId,
          titre:       `Écart majeur : ${critere.libelle}`,
          description: `Checklist "${critere.typeChecklist.nom}" · Armoire "${armoire.nom}" (Zone "${armoire.zone.nom}")`,
          priorite:    'HAUTE',
        },
      });
    }
  }

  return res.json(resultat);
}));

export default router;
