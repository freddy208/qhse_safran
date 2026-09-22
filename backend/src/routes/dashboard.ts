import { Router, Request, Response } from 'express';
import { requireAuth }  from '../middleware/auth';
import { ah }           from '../lib/asyncHandler';
import { parseId }      from '../lib/validateId';
import prisma           from '../lib/prisma';
import {
  calculerScoreAxe,
  calculerScoreProjet,
  calculerTauxConformiteArmoire,
  calculerTauxConformiteZone,
  calculerConformiteProduit,
} from '../lib/scores';

const router = Router();

// GET /api/projets/:projetId/dashboard
router.get('/projets/:projetId/dashboard', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;

  const projet = await prisma.projet.findUnique({
    where: { id: projetId },
    include: {
      axes: {
        include: { sousActions: true },
        orderBy: { id: 'asc' },
      },
      zones: {
        include: {
          armoires: {
            include: { resultats: true, produits: true },
          },
        },
      },
    },
  });
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  // ── Scores ─────────────────────────────────────────────────────────────
  const scoreGlobal = calculerScoreProjet(projet.axes);
  const scoresAxes  = projet.axes.map((ax) => ({
    id:          ax.id,
    code:        ax.code,
    intitule:    ax.intitule,
    ponderation: ax.ponderation,
    score:       calculerScoreAxe(ax.sousActions),
  }));

  // ── Statuts sous-actions ───────────────────────────────────────────────
  const toutesLesSA = projet.axes.flatMap((ax) => ax.sousActions);
  const nbTotal      = toutesLesSA.length;
  const nbRealise    = toutesLesSA.filter((sa) => sa.statut === 'REALISE').length;
  const nbEnCours    = toutesLesSA.filter((sa) => sa.statut === 'EN_COURS').length;
  const nbNonDemarre = toutesLesSA.filter((sa) => sa.statut === 'NON_DEMARRE').length;

  // ── Conformité par zone ────────────────────────────────────────────────
  const conformiteZones = projet.zones.map((z) => {
    const tauxArmoires = z.armoires.map((a) => calculerTauxConformiteArmoire(a.resultats));
    return {
      id:             z.id,
      nom:            z.nom,
      tauxConformite: calculerTauxConformiteZone(tauxArmoires),
      nbArmoires:     z.armoires.length,
      armoiresAuditees: z.armoires.filter((a) => a.resultats.length > 0).length,
    };
  });

  // ── Produits – FDS et conformité ───────────────────────────────────────
  const tousLesProduits = projet.zones.flatMap((z) =>
    z.armoires.flatMap((a) => {
      const taux = calculerTauxConformiteArmoire(a.resultats);
      return a.produits.map((p) => ({
        ...p,
        conformite: calculerConformiteProduit(p, taux),
        armoireNom: a.nom,
        zoneNom:    z.nom,
      }));
    })
  );

  const nbFdsAJour      = tousLesProduits.filter((p) => p.statutFds === 'A_JOUR').length;
  const nbFdsObsoletes  = tousLesProduits.filter((p) => p.statutFds === 'OBSOLETE').length;
  const nbFdsManquantes = tousLesProduits.filter((p) => p.statutFds === 'MANQUANTE').length;
  const totalQuantitePresente = tousLesProduits.reduce((s, p) => s + (p.quantitePresente ?? 0), 0);
  const totalQuantiteUtilisee = tousLesProduits
    .filter((p) => (p.quantiteUtilisee ?? 0) < 1_000_000)
    .reduce((s, p) => s + (p.quantiteUtilisee ?? 0), 0);

  const repartitionEcarts = {
    majeur: tousLesProduits.filter((p) => p.conformite.statut === 'ECART_MAJEUR').length,
    mineur: tousLesProduits.filter((p) => p.conformite.statut === 'ECART_MINEUR').length,
    conforme: tousLesProduits.filter((p) => p.conformite.statut === 'CONFORME').length,
  };

  // ── KPIs produits chimiques (données Excel) ────────────────────────────
  const now2 = new Date();
  const in6Months = new Date(now2); in6Months.setMonth(in6Months.getMonth() + 6);

  const nbExpires           = tousLesProduits.filter((p) => p.datePeremption && new Date(p.datePeremption) < now2).length;
  const nbExpiresProchains  = tousLesProduits.filter((p) => {
    if (!p.datePeremption) return false;
    const d = new Date(p.datePeremption);
    return d >= now2 && d <= in6Months;
  }).length;
  const nbSansCode          = tousLesProduits.filter((p) => !p.codeProduit).length;
  const totalP              = tousLesProduits.length;
  const statsExpiration = {
    nbExpires,
    nbExpiresProchains,
    nbSansCode,
    pctExpires:          totalP > 0 ? Math.round((nbExpires          / totalP) * 100) : 0,
    pctExpiresProchains: totalP > 0 ? Math.round((nbExpiresProchains / totalP) * 100) : 0,
    pctSansCode:         totalP > 0 ? Math.round((nbSansCode         / totalP) * 100) : 0,
  };

  // ── Couverture ─────────────────────────────────────────────────────────
  const totalArmoires    = projet.zones.flatMap((z) => z.armoires).length;
  const armoiresAuditees = projet.zones.flatMap((z) =>
    z.armoires.filter((a) => a.resultats.length > 0)
  ).length;
  const totalProduits    = tousLesProduits.length;

  // ── Ancienneté moyenne par axe ────────────────────────────────────────
  const now = Date.now();
  const ancienneteParAxe = projet.axes.map((ax) => {
    const ages = ax.sousActions.map((sa) => now - new Date(sa.dateDerniereMaj).getTime());
    const moy  = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    return {
      axeId:         ax.id,
      code:          ax.code,
      ancienneteMoyJ: Math.round(moy / 86_400_000),
    };
  });

  return res.json({
    scoreGlobal,
    scoresAxes,
    statuts: { nbTotal, nbRealise, nbEnCours, nbNonDemarre },
    conformiteZones,
    nbFdsAJour,
    nbFdsObsoletes,
    nbFdsManquantes,
    totalQuantitePresente,
    totalQuantiteUtilisee,
    repartitionEcarts,
    statsExpiration,
    couverture: {
      totalArmoires,
      armoiresAuditees,
      totalProduits,
    },
    ancienneteParAxe,
  });
}));

// GET /api/projets/:projetId/historique
router.get('/projets/:projetId/historique', requireAuth, ah(async (req: Request, res: Response) => {
  const projetId = parseId(req.params.projetId, res); if (projetId === null) return;
  const axeIdRaw = req.query.axeId ? parseInt(req.query.axeId as string, 10) : NaN;
  const axeId    = !isNaN(axeIdRaw) && axeIdRaw > 0 ? axeIdRaw : undefined;

  const historique = await prisma.historiqueScore.findMany({
    where: { projetId, axeId: axeId ?? null },
    orderBy: { date: 'asc' },
    take: 90,
  });
  return res.json(historique);
}));

export default router;
