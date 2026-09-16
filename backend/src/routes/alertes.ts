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

  const zones      = await prisma.zone.findMany({ where: { projetId }, include: { armoires: true } });
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

  alertes.sort((a, b) => b.retardJ - a.retardJ);
  return res.json({ total: alertes.length, seuil: seuilSemaines, alertes });
}));

export default router;
