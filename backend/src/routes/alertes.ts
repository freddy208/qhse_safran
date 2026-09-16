import { Router, Request, Response } from 'express';
import { requireAuth }  from '../middleware/auth';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';

const router = Router();
const SEUIL_DEFAUT_SEMAINES = 3;

// GET /api/projets/:projetId/alertes
router.get('/projets/:projetId/alertes', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId      = parseId(req.params.projetId, res); if (projetId === null) return;
  const seuilRaw      = parseInt(req.query.seuil as string, 10);
  const seuilSemaines = (!isNaN(seuilRaw) && seuilRaw > 0) ? seuilRaw : SEUIL_DEFAUT_SEMAINES;
  const seuilMs       = seuilSemaines * 7 * 24 * 60 * 60 * 1000;
  const limite        = new Date(Date.now() - seuilMs);

  const alertes: Array<{ type: string; id: number; libelle: string; contexte: string; dateMaj: Date; retardJ: number }> = [];

  const sousActions = await prisma.sousAction.findMany({
    where: { statut: { not: 'REALISE' }, dateDerniereMaj: { lt: limite }, axe: { projetId } },
    include: { axe: true },
  });
  for (const sa of sousActions) {
    alertes.push({ type: 'sous_action', id: sa.id, libelle: sa.libelle, contexte: sa.axe.intitule, dateMaj: sa.dateDerniereMaj, retardJ: Math.round((Date.now() - new Date(sa.dateDerniereMaj).getTime()) / 86_400_000) });
  }

  const actions = await prisma.actionCorrective.findMany({
    where: { projetId, statut: { not: 'REALISE' }, dateDerniereMaj: { lt: limite } },
  });
  for (const ac of actions) {
    alertes.push({ type: 'action_corrective', id: ac.id, libelle: ac.libelle, contexte: ac.estGenerique ? 'Action générique' : 'Action spécifique', dateMaj: ac.dateDerniereMaj, retardJ: Math.round((Date.now() - new Date(ac.dateDerniereMaj).getTime()) / 86_400_000) });
  }

  const zones      = await prisma.zone.findMany({ where: { projetId }, include: { armoires: { include: { produits: true } } } });
  const armoireIds = zones.flatMap((z) => z.armoires.map((a) => a.id));
  for (const armoireId of armoireIds) {
    const dernier = await prisma.resultatCritere.findFirst({
      where: { armoireId }, orderBy: { dateDerniereMaj: 'desc' },
      include: { armoire: { include: { zone: true } } },
    });
    if (dernier && new Date(dernier.dateDerniereMaj) < limite) {
      alertes.push({ type: 'armoire', id: armoireId, libelle: dernier.armoire.nom, contexte: `Zone ${dernier.armoire.zone.nom}`, dateMaj: dernier.dateDerniereMaj, retardJ: Math.round((Date.now() - new Date(dernier.dateDerniereMaj).getTime()) / 86_400_000) });
    }
  }

  // Produits périmés
  const now = new Date();
  for (const z of zones) {
    for (const a of z.armoires) {
      for (const p of a.produits) {
        if (p.datePeremption && new Date(p.datePeremption) < now) {
          alertes.push({
            type:    'produit_expire',
            id:      p.id,
            libelle: p.nom,
            contexte: `Périmé le ${new Date(p.datePeremption).toLocaleDateString('fr-FR')} · Armoire "${a.nom}"`,
            dateMaj: p.dateDerniereMaj,
            retardJ: Math.round((now.getTime() - new Date(p.datePeremption).getTime()) / 86_400_000),
          });
        }
      }
    }
  }

  // Exigences NON-conformes sans action corrective réalisée
  const exigencesNon = await prisma.exigenceAudit.findMany({
    where:   { projetId, conformite: 'NON' },
    include: { actions: { select: { statut: true } } },
  });
  for (const ex of exigencesNon) {
    const hasActionRealisee = ex.actions.some((a) => a.statut === 'REALISE');
    if (!hasActionRealisee) {
      alertes.push({
        type:    'exigence_non',
        id:      ex.id,
        libelle: ex.exigence.substring(0, 100),
        contexte: `Audit · Domaine : ${ex.domaine}`,
        dateMaj: ex.dateDerniereMaj,
        retardJ: ex.dateAudit
          ? Math.round((now.getTime() - new Date(ex.dateAudit).getTime()) / 86_400_000)
          : 0,
      });
    }
  }

  alertes.sort((a, b) => b.retardJ - a.retardJ);
  return res.json({ total: alertes.length, seuil: seuilSemaines, alertes });
}));

// ── Alertes manuelles CRUD ────────────────────────────────────────────────

// GET /api/projets/:projetId/alertes-manuelles
router.get('/projets/:projetId/alertes-manuelles', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const list = await prisma.alerte.findMany({
    where: { projetId },
    orderBy: [{ statut: 'asc' }, { priorite: 'desc' }, { dateCreation: 'desc' }],
  });
  return res.json(list);
}));

// POST /api/projets/:projetId/alertes-manuelles
router.post('/projets/:projetId/alertes-manuelles', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const { titre, description, priorite } = req.body;
  if (!titre?.trim()) return res.status(400).json({ error: 'Le titre est requis.' });
  const alerte = await prisma.alerte.create({
    data: { projetId, titre: titre.trim(), description: description?.trim() || null, priorite: priorite || 'MOYENNE' },
  });
  return res.status(201).json(alerte);
}));

// PATCH /api/alertes-manuelles/:id/statut
router.patch('/alertes-manuelles/:id/statut', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const { statut } = req.body;
  if (!['OUVERTE', 'EN_COURS', 'RESOLUE'].includes(statut)) return res.status(400).json({ error: 'Statut invalide.' });
  const alerte = await prisma.alerte.update({ where: { id }, data: { statut } });
  return res.json(alerte);
}));

// PUT /api/alertes-manuelles/:id
router.put('/alertes-manuelles/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  const { titre, description, priorite, statut } = req.body;
  if (!titre?.trim()) return res.status(400).json({ error: 'Le titre est requis.' });
  const alerte = await prisma.alerte.update({
    where: { id },
    data: { titre: titre.trim(), description: description?.trim() || null, priorite, statut },
  });
  return res.json(alerte);
}));

// DELETE /api/alertes-manuelles/:id
router.delete('/alertes-manuelles/:id', requireAuth, ah(async (req: Request, res: Response) => {
  const id = parseId(req.params.id, res); if (id === null) return;
  await prisma.alerte.delete({ where: { id } });
  return res.status(204).send();
}));

export default router;
