import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { axesApi, sousActionsApi, commentairesApi, Axe, SousAction, StatutAction, Commentaire } from '../api/client';
import { StatutSelect, ScorePill, ProgressBar, StatutBadge } from '../components/StatusBadge';

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
  >
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

export default function Axes() {
  const { projetActif } = useProject();
  const [axes,     setAxes]     = useState<Axe[]>([]);
  const [ouverts,  setOuverts]  = useState<Set<number>>(new Set());
  const [loading,  setLoading]  = useState(true);
  const [modifSA,  setModifSA]  = useState<number | null>(null);
  const [commentaires, setCommentaires] = useState<Record<number, Commentaire[]>>({});
  const [nouveauComm,  setNouveauComm]  = useState<Record<number, string>>({});

  const charger = async () => {
    if (!projetActif) return;
    setLoading(true);
    try {
      const list = await axesApi.list(projetActif.id);
      setAxes(list);
    } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [projetActif?.id]);

  const toggleAxe = (id: number) => {
    setOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); chargerCommentaires(id); }
      return next;
    });
  };

  const chargerCommentaires = async (axeId: number) => {
    const comms = await commentairesApi.list({ axeId });
    setCommentaires((prev) => ({ ...prev, [axeId]: comms }));
  };

  const changerStatut = async (sa: SousAction, statut: StatutAction) => {
    setModifSA(sa.id);
    try {
      await sousActionsApi.patchStatut(sa.id, statut);
      await charger();
    } finally { setModifSA(null); }
  };

  const envoyerCommentaire = async (axeId: number) => {
    const texte = nouveauComm[axeId]?.trim();
    if (!texte) return;
    await commentairesApi.create({ texte, axeId });
    setNouveauComm((prev) => ({ ...prev, [axeId]: '' }));
    await chargerCommentaires(axeId);
  };

  const supprimerCommentaire = async (commId: number, axeId: number) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    await commentairesApi.delete(commId);
    await chargerCommentaires(axeId);
  };

  if (loading) return (
    <Layout title="Suivi des axes" subtitle={projetActif?.nom}>
      <div className="card mb-12" style={{ padding: 16 }}>
        <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 8, width: '100%' }} />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card mb-12" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 16, width: '45%', marginBottom: 10 }} />
          {[...Array(3)].map((_, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="skeleton" style={{ height: 12, flex: 1 }} />
              <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ))}
    </Layout>
  );

  const nbRealise = axes.reduce(
    (acc, ax) => acc + (ax.sousActions ?? []).filter((s) => s.statut === 'REALISE').length, 0
  );
  const nbTotal = axes.reduce((acc, ax) => acc + (ax.sousActions ?? []).length, 0);

  return (
    <Layout
      title="Suivi des axes"
      subtitle={projetActif?.nom ?? ''}
      actions={
        <div className="flex items-center gap-8">
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            <strong style={{ color: 'var(--gray-800)' }}>{nbRealise}</strong> / {nbTotal} actions réalisées
          </span>
        </div>
      }
    >
      {/* Résumé global */}
      <div className="card mb-16" style={{ padding: '16px 22px' }}>
        <div className="flex items-center gap-16">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
              Progression globale du projet
            </div>
            <ProgressBar value={nbTotal > 0 ? (nbRealise / nbTotal) * 100 : 0} height={10} />
          </div>
          <div className="flex gap-16" style={{ flexShrink: 0 }}>
            {[
              { label: 'Réalisé',     color: '#2E7D32', count: axes.reduce((a, ax) => a + (ax.sousActions ?? []).filter(s => s.statut === 'REALISE').length, 0) },
              { label: 'En cours',    color: '#B7950B', count: axes.reduce((a, ax) => a + (ax.sousActions ?? []).filter(s => s.statut === 'EN_COURS').length, 0) },
              { label: 'Non démarré', color: '#9CA3AF', count: axes.reduce((a, ax) => a + (ax.sousActions ?? []).filter(s => s.statut === 'NON_DEMARRE').length, 0) },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-6" style={{ fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--gray-600)' }}>{s.label}</span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Axes */}
      {axes.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-title">Aucun axe défini</div>
          <div className="empty-state-sub">Ce projet ne contient pas encore d'axe de suivi.</div>
        </div>
      )}

      {axes.map((axe) => {
        const estOuvert = ouverts.has(axe.id);
        const labelColor = axe.score >= 75 ? '#2E7D32' : axe.score >= 40 ? '#B7950B' : '#C0392B';

        return (
          <div key={axe.id} className="axe-block">
            {/* En-tête */}
            <div className="axe-header" onClick={() => toggleAxe(axe.id)} role="button" aria-expanded={estOuvert}>
              <div className="axe-header-left">
                <span className="axe-code-chip">{axe.code}</span>
                <div className="axe-title-block">
                  <div className="axe-intitule">{axe.intitule}</div>
                  <div className="axe-meta">
                    Pondération : {axe.ponderation}%
                    &nbsp;·&nbsp;
                    {(axe.sousActions ?? []).filter((s) => s.statut === 'REALISE').length}
                    /{(axe.sousActions ?? []).length} actions
                  </div>
                </div>
              </div>
              <div className="axe-header-right">
                <div className="axe-progress-mini">
                  <div className="axe-progress-label" style={{ color: labelColor }}>{axe.score.toFixed(1)}%</div>
                  <ProgressBar value={axe.score} height={5} />
                </div>
                <div className="axe-chevron" style={{ color: 'var(--gray-400)' }}>
                  <IconChevron open={estOuvert} />
                </div>
              </div>
            </div>

            {/* Corps accordéon */}
            {estOuvert && (
              <div className="axe-body">
                {/* Tableau sous-actions */}
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '38%', paddingLeft: 22 }}>Sous-action</th>
                        <th style={{ width: 90 }}>Poids</th>
                        <th style={{ width: 160 }}>Statut</th>
                        <th>Responsable</th>
                        <th>Échéance</th>
                        <th style={{ width: 100 }}>Dernière MAJ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(axe.sousActions ?? []).map((sa) => (
                        <tr key={sa.id}>
                          <td style={{ paddingLeft: 22 }}>
                            <span style={{ fontWeight: 500 }}>{sa.libelle}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: 13, color: 'var(--gray-600)', fontWeight: 600 }}>
                              {sa.ponderationDansAxe}%
                            </span>
                          </td>
                          <td>
                            {modifSA === sa.id ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-400)' }}>
                                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                Mise à jour…
                              </span>
                            ) : (
                              <StatutSelect
                                value={sa.statut}
                                disabled={modifSA === sa.id}
                                onChange={(v) => changerStatut(sa, v)}
                              />
                            )}
                          </td>
                          <td>
                            {sa.responsable
                              ? <span style={{ fontWeight: 500 }}>{sa.responsable}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            {sa.echeance ? (
                              <span style={{
                                color: new Date(sa.echeance) < new Date() ? '#C0392B' : 'inherit',
                                fontWeight: new Date(sa.echeance) < new Date() ? 600 : 400,
                              }}>
                                {new Date(sa.echeance).toLocaleDateString('fr-FR')}
                              </span>
                            ) : <span className="text-muted">—</span>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                            {new Date(sa.dateDerniereMaj).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Commentaires */}
                <div style={{ padding: '18px 22px', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
                    Commentaires
                  </div>

                  {(commentaires[axe.id] ?? []).length > 0 && (
                    <div className="comment-list">
                      {(commentaires[axe.id] ?? []).map((c) => (
                        <div key={c.id} className="comment-item" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div className="comment-meta">
                              <span className="comment-author">{c.auteur.nom}</span>
                              <span className="comment-date">{new Date(c.date).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <div className="comment-text">{c.texte}</div>
                          </div>
                          <button
                            className="btn-icon"
                            title="Supprimer ce commentaire"
                            onClick={() => supprimerCommentaire(c.id, axe.id)}
                            style={{ color: '#C0392B', borderColor: '#fca5a5', flexShrink: 0, marginTop: 2 }}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Ajouter un commentaire…"
                      value={nouveauComm[axe.id] ?? ''}
                      onChange={(e) => setNouveauComm((p) => ({ ...p, [axe.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') envoyerCommentaire(axe.id); }}
                      style={{ flex: 1, height: 36 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => envoyerCommentaire(axe.id)}
                      style={{ flexShrink: 0 }}
                    >
                      <IconSend /> Envoyer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Layout>
  );
}
