import { Router, Request, Response } from 'express';
import { StatutAction } from '@prisma/client';
import { z }           from 'zod';
import { requireAuth } from '../middleware/auth';
import { logAudit }    from '../lib/auditLog';
import { sauvegarderHistoriqueProjet } from './axes';
import { ah }          from '../lib/asyncHandler';
import { parseId }     from '../lib/validateId';
import prisma          from '../lib/prisma';

const router = Router();
const statutValues = ['NON_DEMARRE', 'EN_COURS', 'REALISE'] as const;

const saSchema = z.object({
  libelle:           z.string().min(1).max(300),
  ponderationDansAxe: z.number().min(0).max(100),
  statut:            z.enum(statutValues).optional(),
  responsable:       z.string().max(100).optional().nullable(),
  echeance:          z.string().datetime().optional().nullable(),
});

// GET /api/axes/:axeId/sous-actions
router.get('/axes/:axeId/sous-actions', requireAuth, ah(async (req: Request, res: Response) => {
  const axeId = parseId(req.params.axeId, res); if (axeId === null) return;
  const sas = await prisma.sousAction.findMany({ where: { axeId }, orderBy: { id: 'asc' } });
  return res.json(sas);
}));

// POST /api/axes/:axeId/sous-actions
router.post('/axes/:axeId/sous-actions', requireAuth, ah(async (req: Request, res: Response) => {
  const axeId = parseId(req.params.axeId, res); if (axeId === null) return;
  const axe = await prisma.axe.findUnique({ where: { id: axeId } });
  if (!axe) return res.status(404).json({ error: 'Axe introuvable' });

  const parsed = saSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sa = await prisma.sousAction.create({
    data: {
      axeId,
      libelle:            parsed.data.libelle,
      ponderationDansAxe: parsed.data.ponderationDansAxe,
      statut:             (parsed.data.statut as StatutAction) ?? 'NON_DEMARRE',
      responsable:        parsed.data.responsable ?? null,
      echeance:           parsed.data.echeance ? new Date(parsed.data.echeance) : null,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'sous_actions', ligneId: sa.id, champModifie: 'création', nouvelleValeur: sa.libelle });
  await sauvegarderHistoriqueProjet(axe.projetId);
  return res.status(201).json(sa);
}));

// PUT /api/sous-actions/:id
router.put('/sous-actions/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const avant = await prisma.sousAction.findUnique({ where: { id }, include: { axe: true } });
  if (!avant) return res.status(404).json({ error: 'Sous-action introuvable' });

  const parsed = saSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const sa = await prisma.sousAction.update({
    where: { id },
    data: {
      libelle:            parsed.data.libelle,
      ponderationDansAxe: parsed.data.ponderationDansAxe,
      statut:             parsed.data.statut as StatutAction | undefined,
      responsable:        parsed.data.responsable,
      echeance:           parsed.data.echeance ? new Date(parsed.data.echeance) : undefined,
    },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'sous_actions', ligneId: id, champModifie: 'mise à jour', ancienneValeur: JSON.stringify(avant), nouvelleValeur: JSON.stringify(sa) });
  await sauvegarderHistoriqueProjet(avant.axe.projetId);
  return res.json(sa);
}));

// PATCH /api/sous-actions/:id/statut
router.patch('/sous-actions/:id/statut', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const parsed = z.object({ statut: z.enum(statutValues) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const avant = await prisma.sousAction.findUnique({ where: { id }, include: { axe: true } });
  if (!avant) return res.status(404).json({ error: 'Sous-action introuvable' });

  const sa = await prisma.sousAction.update({
    where: { id },
    data: { statut: parsed.data.statut as StatutAction },
  });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'sous_actions', ligneId: id, champModifie: 'statut', ancienneValeur: avant.statut, nouvelleValeur: sa.statut });
  await sauvegarderHistoriqueProjet(avant.axe.projetId);
  return res.json(sa);
}));

// DELETE /api/sous-actions/:id
router.delete('/sous-actions/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const sa = await prisma.sousAction.findUnique({ where: { id }, include: { axe: true } });
  if (!sa) return res.status(404).json({ error: 'Sous-action introuvable' });
  await prisma.sousAction.delete({ where: { id } });
  await logAudit({ utilisateurId: req.user!.id, tableConcernee: 'sous_actions', ligneId: id, champModifie: 'suppression', ancienneValeur: sa.libelle });
  await sauvegarderHistoriqueProjet(sa.axe.projetId);
  return res.status(204).send();
}));

export default router;
