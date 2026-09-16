import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { alertesManuellesApi, dashboardApi, AlerteManuelle, PrioriteAlerte, StatutAlerte } from '../api/client';
import { useToast } from '../contexts/ToastContext';

const PRIORITE_CONFIG: Record<PrioriteAlerte, { label: string; cls: string; color: string }> = {
  CRITIQUE: { label: 'Critique',  cls: 'badge-majeur',     color: '#C0392B' },
  HAUTE:    { label: 'Haute',     cls: 'badge-majeur',     color: '#e67e22' },
  MOYENNE:  { label: 'Moyenne',   cls: 'badge-en-cours',   color: '#B7950B' },
  FAIBLE:   { label: 'Faible',    cls: 'badge-conforme',   color: '#2E7D32' },
};

const STATUT_CONFIG: Record<StatutAlerte, { label: string; cls: string }> = {
  OUVERTE:  { label: 'Ouverte',   cls: 'badge-majeur'     },
  EN_COURS: { label: 'En cours',  cls: 'badge-en-cours'   },
  RESOLUE:  { label: 'Résolue',   cls: 'badge-conforme'   },
};

const IconPlus  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IconEdit  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconAlert = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

const STATUTS: StatutAlerte[]  = ['OUVERTE', 'EN_COURS', 'RESOLUE'];
const PRIORITES: PrioriteAlerte[] = ['CRITIQUE', 'HAUTE', 'MOYENNE', 'FAIBLE'];

export default function Alertes() {
  const { projetActif } = useProject();
  const toast = useToast();

  const [alertes,    setAlertes]    = useState<AlerteManuelle[]>([]);
  const [calculees,  setCalculees]  = useState<{ type: string; id: number; libelle: string; contexte: string; retardJ: number }[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ titre: '', description: '', priorite: 'MOYENNE' as PrioriteAlerte });
  const [busy,       setBusy]       = useState(false);
  const [editAlerte, setEditAlerte] = useState<AlerteManuelle | null>(null);
  const [editForm,   setEditForm]   = useState({ titre: '', description: '', priorite: 'MOYENNE' as PrioriteAlerte, statut: 'OUVERTE' as StatutAlerte });
  const [filtreStatut, setFiltreStatut] = useState<StatutAlerte | 'TOUTES'>('TOUTES');

  const charger = async () => {
    if (!projetActif) return;
    setLoading(true);
    try {
      const [list, dash] = await Promise.all([
        alertesManuellesApi.list(projetActif.id),
        dashboardApi.alertes(projetActif.id),
      ]);
      setAlertes(list);
      setCalculees(dash.alertes);
    } finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [projetActif?.id]);

  const creer = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await alertesManuellesApi.create(projetActif!.id, { titre: form.titre, description: form.description || undefined, priorite: form.priorite });
      setForm({ titre: '', description: '', priorite: 'MOYENNE' });
      setShowForm(false);
      toast.success('Alerte créée');
      await charger();
    } catch (ex) { toast.error((ex as Error).message); }
    finally { setBusy(false); }
  };

  const changerStatut = async (id: number, statut: StatutAlerte) => {
    try { await alertesManuellesApi.patchStatut(id, statut); await charger(); }
    catch (ex) { toast.error((ex as Error).message); }
  };

  const ouvrirEdit = (a: AlerteManuelle) => {
    setEditAlerte(a);
    setEditForm({ titre: a.titre, description: a.description ?? '', priorite: a.priorite, statut: a.statut });
  };

  const sauvegarderEdit = async (e: FormEvent) => {
    e.preventDefault(); if (!editAlerte) return; setBusy(true);
    try {
      await alertesManuellesApi.update(editAlerte.id, { titre: editForm.titre, description: editForm.description || null, priorite: editForm.priorite, statut: editForm.statut });
      setEditAlerte(null); toast.success('Alerte mise à jour');
      await charger();
    } catch (ex) { toast.error((ex as Error).message); }
    finally { setBusy(false); }
  };

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cette alerte ?')) return;
    try { await alertesManuellesApi.delete(id); toast.success('Alerte supprimée'); await charger(); }
    catch (ex) { toast.error((ex as Error).message); }
  };

  const filtrees = filtreStatut === 'TOUTES' ? alertes : alertes.filter((a) => a.statut === filtreStatut);

  const nbOuvertes = alertes.filter((a) => a.statut !== 'RESOLUE').length;
  const nbCalculees = calculees.length;

  if (loading) return (
    <Layout title="Alertes" subtitle={projetActif?.nom}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card mb-12" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 10, width: '60%' }} />
        </div>
      ))}
    </Layout>
  );

  return (
    <Layout
      title="Alertes"
      subtitle={projetActif?.nom}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          <IconPlus /> Nouvelle alerte
        </button>
      }
    >
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className={`kpi-card ${nbOuvertes > 0 ? 'kpi-danger' : 'kpi-success'}`}>
          <div className="kpi-label">Alertes actives</div>
          <div className="kpi-value" style={{ fontSize: 28, color: nbOuvertes > 0 ? '#C0392B' : '#2E7D32' }}>{nbOuvertes}</div>
          <div className="kpi-sub">sur {alertes.length} au total</div>
        </div>
        <div className={`kpi-card ${nbCalculees > 0 ? 'kpi-warning' : 'kpi-success'}`}>
          <div className="kpi-label">Alertes système</div>
          <div className="kpi-value" style={{ fontSize: 28, color: nbCalculees > 0 ? '#B7950B' : '#2E7D32' }}>{nbCalculees}</div>
          <div className="kpi-sub">retards, périmés, non-conformités</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Critiques / Hautes</div>
          <div className="kpi-value" style={{ fontSize: 28, color: '#C0392B' }}>
            {alertes.filter((a) => a.statut !== 'RESOLUE' && (a.priorite === 'CRITIQUE' || a.priorite === 'HAUTE')).length}
          </div>
          <div className="kpi-sub">alertes à traiter en priorité</div>
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="card mb-16">
          <div className="modal-header" style={{ borderRadius: '8px 8px 0 0' }}>
            <div className="modal-title" style={{ fontSize: 15 }}>Créer une alerte</div>
            <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={creer}>
            <div className="modal-body">
              <div className="form-group">
                <label>Titre de l'alerte *</label>
                <input type="text" required value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Décrire le problème ou le risque…" />
              </div>
              <div className="form-group">
                <label>Description <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Contexte, impact attendu, actions suggérées…" rows={3} />
              </div>
              <div className="form-group">
                <label>Priorité</label>
                <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value as PrioriteAlerte }))}>
                  {PRIORITES.map((p) => <option key={p} value={p}>{PRIORITE_CONFIG[p].label}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Création…' : 'Créer l\'alerte'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Alertes calculées (retards + non-conformités + expirations) */}
      {nbCalculees > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <span className="card-title">Alertes détectées automatiquement</span>
            <span className="badge badge-majeur">{nbCalculees} alerte{nbCalculees > 1 ? 's' : ''}</span>
          </div>
          <div className="alert alert-warning" style={{ margin: '0 0 0 0', borderRadius: 0, borderLeft: 'none', borderTop: '1px solid var(--amber-200)' }}>
            <IconAlert />
            <span>Alertes générées automatiquement : actions/armoires en retard, produits périmés, exigences d'audit non conformes sans action réalisée.</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Élément</th>
                  <th>Contexte</th>
                  <th style={{ width: 150 }}>Catégorie</th>
                  <th style={{ width: 100 }}>Indicateur</th>
                </tr>
              </thead>
              <tbody>
                {calculees.map((a, i) => {
                  const typeConfig: Record<string, { label: string; cls: string }> = {
                    sous_action:    { label: 'Sous-action',    cls: 'badge-en-cours'   },
                    action_corrective: { label: 'Action corrective', cls: 'badge-en-cours' },
                    armoire:        { label: 'Checklist',      cls: 'badge-non-demarre'},
                    produit_expire: { label: 'Produit périmé', cls: 'badge-majeur'     },
                    exigence_non:   { label: 'Non-conformité', cls: 'badge-majeur'     },
                  };
                  const cfg = typeConfig[a.type] ?? { label: a.type, cls: 'badge-non-demarre' };
                  const isProduit = a.type === 'produit_expire';
                  const isExigence = a.type === 'exigence_non';
                  return (
                    <tr key={i} style={{ background: (isProduit || isExigence) ? 'var(--red-50)' : undefined }}>
                      <td style={{ paddingLeft: 20, fontWeight: 500 }}>{a.libelle}</td>
                      <td style={{ color: 'var(--gray-600)', fontSize: 13 }}>{a.contexte}</td>
                      <td><span className={`badge ${cfg.cls}`} style={{ fontSize: 11 }}>{cfg.label}</span></td>
                      <td>
                        {a.retardJ > 0
                          ? <span className="badge badge-majeur">{a.retardJ} j</span>
                          : <span className="badge badge-majeur" style={{ background: '#FEF2F2' }}>actif</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertes manuelles */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Alertes manuelles</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['TOUTES', ...STATUTS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFiltreStatut(s)}
                className={`btn btn-sm ${filtreStatut === s ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12 }}
              >
                {s === 'TOUTES' ? 'Toutes' : STATUT_CONFIG[s].label}
                {s !== 'TOUTES' && (
                  <span style={{ marginLeft: 4, fontWeight: 700 }}>
                    ({alertes.filter((a) => a.statut === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {filtrees.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <div className="empty-state-title">Aucune alerte{filtreStatut !== 'TOUTES' ? ` "${STATUT_CONFIG[filtreStatut].label}"` : ''}</div>
            <div className="empty-state-sub">Utilisez le bouton "Nouvelle alerte" pour signaler un problème.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Titre</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>Priorité</th>
                  <th style={{ width: 130 }}>Statut</th>
                  <th style={{ width: 100 }}>Date</th>
                  <th style={{ width: 72 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map((a) => (
                  <tr key={a.id} style={{ opacity: a.statut === 'RESOLUE' ? 0.6 : 1 }}>
                    <td style={{ paddingLeft: 20, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITE_CONFIG[a.priorite].color, flexShrink: 0 }} />
                        {a.titre}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>
                      {a.description ?? <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <span className={`badge ${PRIORITE_CONFIG[a.priorite].cls}`} style={{ fontSize: 11 }}>
                        {PRIORITE_CONFIG[a.priorite].label}
                      </span>
                    </td>
                    <td>
                      <select
                        value={a.statut}
                        onChange={(e) => changerStatut(a.id, e.target.value as StatutAlerte)}
                        style={{ fontSize: 12, height: 30, padding: '0 28px 0 8px' }}
                      >
                        {STATUTS.map((s) => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
                      </select>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                      {new Date(a.dateCreation).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" title="Modifier" onClick={() => ouvrirEdit(a)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                        <button className="btn-icon" title="Supprimer" onClick={() => supprimer(a.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal édition alerte */}
      {editAlerte && (
        <div className="modal-overlay" onClick={() => setEditAlerte(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Modifier l'alerte</div>
              <button className="btn-icon" onClick={() => setEditAlerte(null)}>✕</button>
            </div>
            <form onSubmit={sauvegarderEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Titre *</label>
                  <input type="text" required value={editForm.titre} onChange={(e) => setEditForm((f) => ({ ...f, titre: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Description <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div className="form-group">
                    <label>Priorité</label>
                    <select value={editForm.priorite} onChange={(e) => setEditForm((f) => ({ ...f, priorite: e.target.value as PrioriteAlerte }))}>
                      {PRIORITES.map((p) => <option key={p} value={p}>{PRIORITE_CONFIG[p].label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Statut</label>
                    <select value={editForm.statut} onChange={(e) => setEditForm((f) => ({ ...f, statut: e.target.value as StatutAlerte }))}>
                      {STATUTS.map((s) => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditAlerte(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
