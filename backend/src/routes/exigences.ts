import { Router, Request, Response } from 'express';
import { ConformiteAudit } from '@prisma/client';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();
const conformiteValues = ['OUI', 'NON'] as const;

const exigenceSchema = z.object({
  domaine:          z.string().min(1).max(200),
  exigence:         z.string().min(1).max(300),
  questionControle: z.string().max(500).optional().nullable(),
  conformite:       z.enum(conformiteValues).optional().nullable(),
  preuves:          z.string().max(1000).optional().nullable(),
  actionAMener:     z.string().max(1000).optional().nullable(),
  responsable:      z.string().max(100).optional().nullable(),
});

// GET /api/projets/:projetId/exigences
router.get('/projets/:projetId/exigences', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const exigences = await prisma.exigenceAudit.findMany({
    where: { projetId },
    orderBy: [{ domaine: 'asc' }, { id: 'asc' }],
  });
  return res.json(exigences);
}));

// POST /api/projets/:projetId/exigences
router.post('/projets/:projetId/exigences', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const parsed   = exigenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ex = await prisma.exigenceAudit.create({
    data: {
      projetId,
      domaine:          parsed.data.domaine,
      exigence:         parsed.data.exigence,
      questionControle: parsed.data.questionControle ?? null,
      conformite:       (parsed.data.conformite as ConformiteAudit | null) ?? null,
      preuves:          parsed.data.preuves ?? null,
      actionAMener:     parsed.data.actionAMener ?? null,
      responsable:      parsed.data.responsable ?? null,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'exigences_audit', ligneId: ex.id, champModifie: 'création', nouvelleValeur: ex.exigence });
  return res.status(201).json(ex);
}));

// PUT /api/exigences/:id
router.put('/exigences/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id    = parseId(req.params.id, res); if (id === null) return;
  const avant = await prisma.exigenceAudit.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Exigence introuvable' });

  const parsed = exigenceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const ex = await prisma.exigenceAudit.update({
    where: { id },
    data: {
      domaine:          parsed.data.domaine,
      exigence:         parsed.data.exigence,
      questionControle: parsed.data.questionControle,
      conformite:       parsed.data.conformite as ConformiteAudit | null | undefined,
      preuves:          parsed.data.preuves,
      actionAMener:     parsed.data.actionAMener,
      responsable:      parsed.data.responsable,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'exigences_audit', ligneId: id, champModifie: 'conformite', ancienneValeur: avant.conformite ?? null, nouvelleValeur: ex.conformite ?? null });
  return res.json(ex);
}));

// DELETE /api/exigences/:id
router.delete('/exigences/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const ex = await prisma.exigenceAudit.findUnique({ where: { id } });
  if (!ex) return res.status(404).json({ error: 'Exigence introuvable' });
  await prisma.exigenceAudit.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'exigences_audit', ligneId: id, champModifie: 'suppression', ancienneValeur: ex.exigence });
  return res.status(204).send();
}));

export default router;
