import { StatutAction, ResultatEnum } from '../api/client';

/* ── Badges statut ──────────────────────────────────────────────────────── */
const STATUT_CFG: Record<StatutAction, { label: string; cls: string }> = {
  NON_DEMARRE: { label: 'Non démarré', cls: 'badge-non-demarre' },
  EN_COURS:    { label: 'En cours',    cls: 'badge-en-cours' },
  REALISE:     { label: 'Réalisé',     cls: 'badge-realise' },
};

const RESULTAT_CFG: Record<ResultatEnum, { label: string; cls: string }> = {
  CONFORME:     { label: 'Conforme',     cls: 'badge-conforme' },
  ECART_MINEUR: { label: 'Écart mineur', cls: 'badge-mineur' },
  ECART_MAJEUR: { label: 'Écart majeur', cls: 'badge-majeur' },
};

export function StatutBadge({ statut }: { statut: StatutAction }) {
  const cfg = STATUT_CFG[statut] ?? STATUT_CFG.NON_DEMARRE;
  return <span className={`badge badge-dot ${cfg.cls}`}>{cfg.label}</span>;
}

export function ResultatBadge({ resultat }: { resultat: ResultatEnum }) {
  const cfg = RESULTAT_CFG[resultat] ?? RESULTAT_CFG.CONFORME;
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}

export function ConformiteBadge({ statut }: { statut: 'CONFORME' | 'ECART_MINEUR' | 'ECART_MAJEUR' }) {
  return <ResultatBadge resultat={statut as ResultatEnum} />;
}

/* ── Select statut inline ───────────────────────────────────────────────── */
export function StatutSelect({
  value, onChange, disabled,
}: {
  value: StatutAction; onChange: (v: StatutAction) => void; disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as StatutAction)}
      style={{ width: 'auto', height: 30, fontSize: 13, padding: '0 28px 0 8px' }}
    >
      <option value="NON_DEMARRE">Non démarré</option>
      <option value="EN_COURS">En cours</option>
      <option value="REALISE">Réalisé</option>
    </select>
  );
}

/* ── Score pill coloré ──────────────────────────────────────────────────── */
export function ScorePill({ score }: { score: number }) {
  const cls = score >= 75 ? 'score-pill-high' : score >= 40 ? 'score-pill-mid' : 'score-pill-low';
  return <span className={`score-pill ${cls}`}>{score.toFixed(1)} %</span>;
}

/* ── Barre de progression ─────────────────────────────────────────────────── */
export function ProgressBar({ value, height = 8 }: { value: number; height?: number }) {
  const colorCls =
    value >= 75 ? 'progress-fill-green' :
    value >= 40 ? 'progress-fill-amber' :
                  'progress-fill-red';
  return (
    <div className="progress-track" style={{ height }}>
      <div
        className={`progress-fill ${colorCls}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}
