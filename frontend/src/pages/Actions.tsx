import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { actionsApi, ActionCorrective, StatutAction } from '../api/client';
import { StatutSelect } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const STATUTS: StatutAction[] = ['NON_DEMARRE', 'EN_COURS', 'REALISE'];

export default function Actions() {
  const { projetActif } = useProject();
  const toast = useToast();
  const [actions,  setActions]  = useState<ActionCorrective[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modifId,  setModifId]  = useState<number | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ libelle: '', ponderation: '10', statut: 'NON_DEMARRE' as StatutAction, responsable: '', echeance: '', estGenerique: false });
  const [editId,   setEditId]   = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ libelle: '', ponderation: '', responsable: '', echeance: '' });

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
    catch (e) { toast.error((e as Error).message); }
    finally { setModifId(null); }
  };

  const creerAction = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await actionsApi.create(projetActif!.id, {
        libelle: form.libelle,
        ponderation: parseFloat(form.ponderation),
        statut: form.statut,
        responsable: form.responsable || undefined,
        echeance: form.echeance ? new Date(form.echeance).toISOString() : undefined,
        estGenerique: form.estGenerique,
      });
      setForm({ libelle: '', ponderation: '10', statut: 'NON_DEMARRE', responsable: '', echeance: '', estGenerique: false });
      setShowForm(false);
      await charger();
    } catch (ex: unknown) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  const supprimerAction = async (id: number) => {
    if (!confirm('Supprimer cette action spécifique ?')) return;
    try { await actionsApi.delete(id); await charger(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const ouvrirEdit = (a: ActionCorrective) => {
    setEditId(a.id);
    setEditForm({ libelle: a.libelle, ponderation: String(a.ponderation), responsable: a.responsable ?? '', echeance: a.echeance ? a.echeance.slice(0, 10) : '' });
    setErr(null);
  };

  const sauvegarderEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setBusy(true); setErr(null);
    try {
      await actionsApi.update(editId, {
        libelle:     editForm.libelle,
        ponderation: parseFloat(editForm.ponderation),
        responsable: editForm.responsable || null,
        echeance:    editForm.echeance ? new Date(editForm.echeance).toISOString() : null,
      });
      setEditId(null);
      await charger();
    } catch (ex: unknown) { setErr((ex as Error).message); }
    finally { setBusy(false); }
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

  const renderTable = (list: ActionCorrective[], titre: string, showScore: boolean, allowDelete: boolean) => (
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
                <th style={{ width: allowDelete ? 76 : 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) =>
                editId === a.id ? (
                  <tr key={a.id} style={{ background: 'var(--blue-50)' }}>
                    <td colSpan={7} style={{ padding: '10px 20px' }}>
                      {err && <div className="alert alert-danger" style={{ marginBottom: 8, fontSize: 12 }}>{err}</div>}
                      <form onSubmit={sauvegarderEdit} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          required
                          placeholder="Libellé *"
                          value={editForm.libelle}
                          onChange={(e) => setEditForm((f) => ({ ...f, libelle: e.target.value }))}
                          style={{ flex: 2, minWidth: 180, fontSize: 13 }}
                        />
                        <input
                          type="number" min="0" max="100" step="0.1"
                          required
                          placeholder="Poids %"
                          value={editForm.ponderation}
                          onChange={(e) => setEditForm((f) => ({ ...f, ponderation: e.target.value }))}
                          style={{ width: 80, fontSize: 13 }}
                        />
                        <input
                          placeholder="Responsable"
                          value={editForm.responsable}
                          onChange={(e) => setEditForm((f) => ({ ...f, responsable: e.target.value }))}
                          style={{ flex: 1, minWidth: 120, fontSize: 13 }}
                        />
                        <input
                          type="date"
                          value={editForm.echeance}
                          onChange={(e) => setEditForm((f) => ({ ...f, echeance: e.target.value }))}
                          style={{ fontSize: 13 }}
                        />
                        <button type="submit" className="btn-icon" title="Sauvegarder" disabled={busy} style={{ color: '#16a34a', borderColor: '#86efac' }}><IconCheck /></button>
                        <button type="button" className="btn-icon" title="Annuler" onClick={() => { setEditId(null); setErr(null); }} style={{ color: '#6b7280', borderColor: '#d1d5db' }}><IconX /></button>
                      </form>
                    </td>
                  </tr>
                ) : (
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
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" title="Modifier" onClick={() => ouvrirEdit(a)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                        {allowDelete && (
                          <button className="btn-icon" title="Supprimer" onClick={() => supprimerAction(a.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Layout
      title="Actions correctives"
      subtitle={projetActif?.nom}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          <IconPlus /> Nouvelle action
        </button>
      }
    >
      {/* Formulaire création */}
      {showForm && (
        <div className="card mb-16" style={{ padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Créer une action corrective</div>
          {err && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{err}</div>}
          <form onSubmit={creerAction}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
              <input
                placeholder="Libellé de l'action *"
                required
                value={form.libelle}
                onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))}
                style={{ fontSize: 13 }}
              />
              <input
                type="number" min="0" max="100" step="0.1"
                placeholder="Poids %"
                required
                value={form.ponderation}
                onChange={(e) => setForm((f) => ({ ...f, ponderation: e.target.value }))}
                style={{ width: 90, fontSize: 13 }}
              />
              <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as StatutAction }))} style={{ fontSize: 13 }}>
                {STATUTS.map((s) => <option key={s} value={s}>{s === 'NON_DEMARRE' ? 'Non démarré' : s === 'EN_COURS' ? 'En cours' : 'Réalisé'}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input
                placeholder="Responsable (optionnel)"
                value={form.responsable}
                onChange={(e) => setForm((f) => ({ ...f, responsable: e.target.value }))}
                style={{ fontSize: 13 }}
              />
              <input
                type="date"
                value={form.echeance}
                onChange={(e) => setForm((f) => ({ ...f, echeance: e.target.value }))}
                style={{ fontSize: 13 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={form.estGenerique} onChange={(e) => setForm((f) => ({ ...f, estGenerique: e.target.checked }))} />
                Action générique
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                {busy ? 'Création…' : 'Créer'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setErr(null); }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Les <strong>actions génériques</strong> constituent un indicateur de processus indépendant. Leur avancement n'est pas inclus dans le score global du projet.
      </div>
      {renderTable(generiques,  'Actions génériques — Processus de traitement des écarts', true, false)}
      {renderTable(specifiques, 'Actions spécifiques', false, true)}
    </Layout>
  );
}
