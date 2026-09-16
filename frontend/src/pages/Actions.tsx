import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { actionsApi, ActionCorrective, StatutAction } from '../api/client';
import { StatutSelect } from '../components/StatusBadge';

export default function Actions() {
  const { projetActif } = useProject();
  const [actions,  setActions]  = useState<ActionCorrective[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modifId,  setModifId]  = useState<number | null>(null);

  const charger = async () => {
    if (!projetActif) return;
    setLoading(true);
    try { setActions(await actionsApi.list(projetActif.id)); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [projetActif?.id]);

  const changerStatut = async (id: number, statut: StatutAction) => {
    setModifId(id);
    try { await actionsApi.patchStatut(id, statut); await charger(); }
    finally { setModifId(null); }
  };

  const generiques  = actions.filter((a) => a.estGenerique);
  const specifiques = actions.filter((a) => !a.estGenerique);

  const avancement = (list: ActionCorrective[]) => {
    if (!list.length) return 0;
    const tot = list.reduce((s, a) => s + a.ponderation, 0);
    const sum = list.reduce((s, a) => s + a.ponderation * (a.statut === 'REALISE' ? 100 : a.statut === 'EN_COURS' ? 50 : 0), 0);
    return tot > 0 ? parseFloat((sum / tot).toFixed(1)) : 0;
  };

  if (loading) return (
    <Layout title="Actions correctives" subtitle={projetActif?.nom}>
      <div className="card mb-16" style={{ padding: 16 }}>
        <div className="skeleton" style={{ height: 14, width: '25%', marginBottom: 12 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div className="skeleton" style={{ height: 12, flex: 2 }} />
            <div className="skeleton" style={{ height: 12, flex: 1 }} />
            <div className="skeleton" style={{ height: 12, width: 70 }} />
            <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </Layout>
  );

  const renderTable = (list: ActionCorrective[], titre: string, showScore: boolean) => (
    <div className="card mb-16">
      <div className="card-header">
        <span className="card-title">{titre}</span>
        {showScore && (
          <span className="badge badge-info">Avancement : {avancement(list).toFixed(1)} %</span>
        )}
      </div>
      {list.length === 0 ? (
        <div className="empty-state" style={{ padding: '32px 0' }}>
          <div className="empty-state-title">Aucune action dans cette catégorie</div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Libellé de l'action</th>
                <th style={{ width: 90 }}>Poids</th>
                <th style={{ width: 165 }}>Statut</th>
                <th>Responsable</th>
                <th style={{ width: 110 }}>Échéance</th>
                <th style={{ width: 110 }}>Dernière MAJ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td style={{ paddingLeft: 20, fontWeight: 500 }}>{a.libelle}</td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>{a.ponderation}%</span>
                  </td>
                  <td>
                    {modifId === a.id ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-400)' }}>
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        Mise à jour…
                      </span>
                    ) : (
                      <StatutSelect
                        value={a.statut}
                        disabled={modifId === a.id}
                        onChange={(v) => changerStatut(a.id, v)}
                      />
                    )}
                  </td>
                  <td>
                    {a.responsable
                      ? <span style={{ fontWeight: 500 }}>{a.responsable}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {a.echeance ? (
                      <span style={{ color: new Date(a.echeance) < new Date() ? '#C0392B' : 'inherit' }}>
                        {new Date(a.echeance).toLocaleDateString('fr-FR')}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {new Date(a.dateDerniereMaj).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Layout title="Actions correctives" subtitle={projetActif?.nom}>
      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Les <strong>actions génériques</strong> constituent un indicateur de processus indépendant. Leur avancement n'est pas inclus dans le score global du projet.
      </div>
      {renderTable(generiques,  'Actions génériques — Processus de traitement des écarts', true)}
      {renderTable(specifiques, 'Actions spécifiques', false)}
    </Layout>
  );
}
