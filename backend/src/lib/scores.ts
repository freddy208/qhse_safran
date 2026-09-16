import { StatutAction, ResultatEnum } from '@prisma/client';

// ── Conversions statut → % (§5 cahier des charges) ────────────────────────
export function pctFromStatut(statut: StatutAction): number {
  switch (statut) {
    case 'NON_DEMARRE': return 0;
    case 'EN_COURS':    return 50;
    case 'REALISE':     return 100;
  }
}

// ── Conversion résultat checklist → score ─────────────────────────────────
export function scoreFromResultat(resultat: ResultatEnum): number {
  switch (resultat) {
    case 'CONFORME':     return 100;
    case 'ECART_MINEUR': return 50;
    case 'ECART_MAJEUR': return 0;
  }
}

// ── Score d'un Axe (§5 règle 2) ───────────────────────────────────────────
export function calculerScoreAxe(
  sousActions: { ponderationDansAxe: number; statut: StatutAction }[]
): number {
  if (sousActions.length === 0) return 0;
  const sumPoids = sousActions.reduce((acc, sa) => acc + sa.ponderationDansAxe, 0);
  if (sumPoids === 0) return 0;
  const sumScore = sousActions.reduce(
    (acc, sa) => acc + sa.ponderationDansAxe * pctFromStatut(sa.statut),
    0
  );
  return Math.round((sumScore / sumPoids) * 10) / 10;
}

// ── Score global d'un Projet (§5 règle 3) ────────────────────────────────
// Division par la somme réelle des pondérations (peut être ≠ 100, ex. 90%)
export function calculerScoreProjet(
  axes: { ponderation: number; sousActions: { ponderationDansAxe: number; statut: StatutAction }[] }[]
): number {
  if (axes.length === 0) return 0;
  const sumPoids = axes.reduce((acc, ax) => acc + ax.ponderation, 0);
  if (sumPoids === 0) return 0;
  const sumScore = axes.reduce(
    (acc, ax) => acc + ax.ponderation * calculerScoreAxe(ax.sousActions),
    0
  );
  return Math.round((sumScore / sumPoids) * 10) / 10;
}

// ── Taux de conformité d'une Armoire (§5 règle 4) ────────────────────────
export function calculerTauxConformiteArmoire(
  resultats: { resultat: ResultatEnum }[]
): number | null {
  if (resultats.length === 0) return null;
  const sum = resultats.reduce((acc, r) => acc + scoreFromResultat(r.resultat), 0);
  return Math.round((sum / resultats.length) * 10) / 10;
}

// ── Taux de conformité d'une Zone ────────────────────────────────────────
export function calculerTauxConformiteZone(
  tauxArmoires: (number | null)[]
): number | null {
  const valides = tauxArmoires.filter((t): t is number => t !== null);
  if (valides.length === 0) return null;
  return Math.round((valides.reduce((a, b) => a + b, 0) / valides.length) * 10) / 10;
}

// ── Conformité calculée d'un Produit (§5 règle 5) ────────────────────────
export interface ConformiteProduit {
  statut: 'CONFORME' | 'ECART_MINEUR' | 'ECART_MAJEUR';
  raisons: string[];
}

interface ProduitInput {
  urlFds:              string | null;
  datePeremption:      Date   | null;
  fdsDateVerification: Date   | null;
  codeProduit:         string | null;
}

export function calculerConformiteProduit(
  produit: ProduitInput,
  tauxConformiteArmoire: number | null
): ConformiteProduit {
  const raisons: string[] = [];
  let pire: ConformiteProduit['statut'] = 'CONFORME';

  const setMajeur = () => { pire = 'ECART_MAJEUR'; };
  const setMineur = () => { if (pire !== 'ECART_MAJEUR') pire = 'ECART_MINEUR'; };

  if (!produit.urlFds) {
    raisons.push('FDS manquante');
    setMajeur();
  }

  if (produit.datePeremption && produit.datePeremption < new Date()) {
    raisons.push('Date de péremption dépassée');
    setMajeur();
  }

  if (produit.fdsDateVerification) {
    const limite = new Date();
    limite.setFullYear(limite.getFullYear() - 3);
    if (produit.fdsDateVerification < limite) {
      raisons.push('FDS obsolète (> 3 ans)');
      setMineur();
    }
  }

  if (!produit.codeProduit) {
    raisons.push('Code produit manquant');
    setMineur();
  }

  if (tauxConformiteArmoire !== null && tauxConformiteArmoire < 100) {
    raisons.push('Stockage non conforme (armoire)');
    setMineur();
  }

  return { statut: pire, raisons };
}
