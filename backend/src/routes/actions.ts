import { Router, Request, Response } from 'express';
import { StatutAction } from '@prisma/client';
import { z }            from 'zod';
import { requireAuth }  from '../middleware/auth';
import { logAudit }     from '../lib/auditLog';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();
const statutValues = ['NON_DEMARRE', 'EN_COURS', 'REALISE'] as const;

const actionSchema = z.object({
  libelle:     z.string().min(1).max(300),
  ponderation: z.number().min(0).max(100),
  statut:      z.enum(statutValues).optional(),
  responsable: z.string().max(100).optional().nullable(),
  echeance:    z.string().datetime().optional().nullable(),
  estGenerique: z.boolean().optional(),
  exigenceId:  z.number().int().optional().nullable(),
});

// GET /api/projets/:projetId/actions
router.get('/projets/:projetId/actions', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const actions  = await prisma.actionCorrective.findMany({
    where: { projetId },
    orderBy: [{ estGenerique: 'desc' }, { id: 'asc' }],
  });
  return res.json(actions);
}));

// POST /api/projets/:projetId/actions
router.post('/projets/:projetId/actions', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const parsed   = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const action = await prisma.actionCorrective.create({
    data: {
      projetId,
      libelle:     parsed.data.libelle,
      ponderation: parsed.data.ponderation,
      statut:      (parsed.data.statut as StatutAction) ?? 'NON_DEMARRE',
      responsable: parsed.data.responsable ?? null,
      echeance:    parsed.data.echeance ? new Date(parsed.data.echeance) : null,
      estGenerique: parsed.data.estGenerique ?? false,
      exigenceId:  parsed.data.exigenceId ?? null,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'actions_correctives', ligneId: action.id, champModifie: 'création', nouvelleValeur: action.libelle });
  return res.status(201).json(action);
}));

// PUT /api/actions/:id
router.put('/actions/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id    = parseId(req.params.id, res); if (id === null) return;
  const avant = await prisma.actionCorrective.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Action introuvable' });

  const parsed = actionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const action = await prisma.actionCorrective.update({
    where: { id },
    data: {
      libelle:     parsed.data.libelle,
      ponderation: parsed.data.ponderation,
      statut:      parsed.data.statut as StatutAction | undefined,
      responsable: parsed.data.responsable,
      echeance:    parsed.data.echeance ? new Date(parsed.data.echeance) : undefined,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'actions_correctives', ligneId: id, champModifie: 'mise à jour', ancienneValeur: avant.statut, nouvelleValeur: action.statut });
  return res.json(action);
}));

// PATCH /api/actions/:id/statut
router.patch('/actions/:id/statut', requireAuth, ah(async (req: Request, res: Response) => {
  const id     = parseId(req.params.id, res); if (id === null) return;
  const parsed = z.object({ statut: z.enum(statutValues) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const avant = await prisma.actionCorrective.findUnique({ where: { id } });
  if (!avant) return res.status(404).json({ error: 'Action introuvable' });

  const action = await prisma.actionCorrective.update({ where: { id }, data: { statut: parsed.data.statut as StatutAction } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'actions_correctives', ligneId: id, champModifie: 'statut', ancienneValeur: avant.statut, nouvelleValeur: action.statut });
  return res.json(action);
}));

// DELETE /api/actions/:id
router.delete('/actions/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id     = parseId(req.params.id, res); if (id === null) return;
  const action = await prisma.actionCorrective.findUnique({ where: { id } });
  if (!action) return res.status(404).json({ error: 'Action introuvable' });
  if (action.estGenerique) return res.status(403).json({ error: 'Impossible de supprimer une action générique' });
  await prisma.actionCorrective.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'actions_correctives', ligneId: id, champModifie: 'suppression', ancienneValeur: action.libelle });
  return res.status(204).send();
}));

export default router;
