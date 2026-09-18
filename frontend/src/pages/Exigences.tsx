import { useEffect, useState, FormEvent, MouseEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { exigencesApi, ExigenceAudit, ActionLinked, ConformiteAudit } from '../api/client';
import { useToast } from '../contexts/ToastContext';

const CONF_LABEL: Record<string, string>  = { OUI: 'Conforme', NON: 'Non conforme' };
const CONF_CLS:   Record<string, string>  = { OUI: 'badge-conforme', NON: 'badge-majeur' };

const STATUT_LABEL: Record<string, string> = {
  NON_DEMARRE: 'Non démarré', EN_COURS: 'En cours', REALISE: 'Réalisé',
};
const STATUT_COLOR: Record<string, string> = {
  NON_DEMARRE: '#6B7280', EN_COURS: '#D97706', REALISE: '#2E7D32',
};

const IconEdit  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconTrash = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IconPlus  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconLink  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;

function ActionsBadge({ actions }: { actions: ActionLinked[] }) {
  if (!actions || actions.length === 0) return null;
  const nbRealise = actions.filter((a) => a.statut === 'REALISE').length;
  const allDone   = nbRealise === actions.length;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      {actions.map((a) => (
        <span key={a.id} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 11, padding: '1px 6px', borderRadius: 4,
          background: a.statut === 'REALISE' ? '#DCFCE7' : a.statut === 'EN_COURS' ? '#FEF3C7' : '#F3F4F6',
          color: STATUT_COLOR[a.statut], fontWeight: 500, border: '1px solid',
          borderColor: a.statut === 'REALISE' ? '#BBF7D0' : a.statut === 'EN_COURS' ? '#FDE68A' : '#E5E7EB',
        }}>
          <IconLink />
          {STATUT_LABEL[a.statut]}
        </span>
      ))}
      {allDone && actions.length > 0 && (
        <span style={{ fontSize: 11, color: '#2E7D32', fontWeight: 600 }}>✓ Action(s) réalisée(s)</span>
      )}
    </div>
  );
}

export default function Exigences() {
  const { projetActif } = useProject();
  const toast = useToast();
  const [exigences,  setExigences]  = useState<ExigenceAudit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<ExigenceAudit>>({});
  const [err,        setErr]        = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [creerForm,  setCreerForm]  = useState({ domaine: '', exigence: '', questionControle: '' });

  // State for creating linked action inside the edit modal
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState({ libelle: '', responsable: '', echeance: '' });
  const [actionBusy, setActionBusy] = useState(false);

  const charger = async () => {
    if (!projetActif) return;
    setLoading(true);
    try { setExigences(await exigencesApi.list(projetActif.id)); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [projetActif?.id]);

  const ouvrir = (ex: ExigenceAudit) => {
    setEditId(ex.id);
    setEditForm({ domaine: ex.domaine, exigence: ex.exigence, questionControle: ex.questionControle ?? '', conformite: ex.conformite, preuves: ex.preuves ?? '', actionAMener: ex.actionAMener ?? '', responsable: ex.responsable ?? '' });
    setErr(null);
    setShowActionForm(false);
    setActionForm({ libelle: ex.exigence ?? '', responsable: '', echeance: '' });
  };

  const fermerModal = () => { setEditId(null); setErr(null); setShowActionForm(false); };

  const sauvegarder = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try {
      await exigencesApi.update(editId, editForm);
      setEditId(null);
      toast.success('Exigence mise à jour');
      setShowActionForm(false);
      await charger();
    }
    catch (ex: unknown) { setErr((ex as Error).message); }
  };

  const creerActionLiee = async (e: FormEvent | MouseEvent) => {
    e.preventDefault();
    if (!editId) return;
    setActionBusy(true);
    try {
      await exigencesApi.createAction(editId, {
        libelle:     actionForm.libelle.trim(),
        responsable: actionForm.responsable.trim() || null,
        echeance:    actionForm.echeance ? new Date(actionForm.echeance).toISOString() : null,
      });
      toast.success('Action corrective créée et liée à cette exigence');
      setShowActionForm(false);
      setActionForm({ libelle: '', responsable: '', echeance: '' });
      await charger();
    } catch (ex: unknown) { toast.error((ex as Error).message); }
    finally { setActionBusy(false); }
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await exigencesApi.create(projetActif!.id, {
        domaine:          creerForm.domaine.trim(),
        exigence:         creerForm.exigence.trim(),
        questionControle: creerForm.questionControle.trim() || null,
      });
      setCreerForm({ domaine: '', exigence: '', questionControle: '' });
      setShowForm(false);
      toast.success('Exigence ajoutée');
      await charger();
    } catch (ex: unknown) { toast.error((ex as Error).message); }
    finally { setBusy(false); }
  };

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer cette exigence ?')) return;
    try { await exigencesApi.delete(id); toast.success('Exigence supprimée'); await charger(); }
    catch (ex: unknown) { toast.error((ex as Error).message); }
  };

  const parDomaine = exigences.reduce<Record<string, ExigenceAudit[]>>((acc, ex) => {
    (acc[ex.domaine] = acc[ex.domaine] ?? []).push(ex);
    return acc;
  }, {});

  const nbOui  = exigences.filter((e) => e.conformite === 'OUI').length;
  const nbNon  = exigences.filter((e) => e.conformite === 'NON').length;
  const nbNR   = exigences.filter((e) => !e.conformite).length;
  const pctConf = exigences.length > 0 ? Math.round((nbOui / exigences.length) * 100) : 0;

  // Current exigence being edited (for modal context)
  const exigenceEditee = editId !== null ? exigences.find((e) => e.id === editId) : null;
  const actionsLiees   = exigenceEditee?.actions ?? [];
  const hasUnresolvedWhenOUI = editForm.conformite === 'OUI' && actionsLiees.some((a) => a.statut !== 'REALISE');

  if (loading) return (
    <Layout title="Audit" subtitle={projetActif?.nom}>
      <div className="card mb-16">
        <div style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 14, width: '20%', marginBottom: 12 }} />
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div className="skeleton" style={{ height: 12, width: 80 }} />
              <div className="skeleton" style={{ height: 12, flex: 1 }} />
              <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 12, flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout
      title="Audit"
      subtitle={projetActif?.nom ?? ''}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
          <IconPlus /> Ajouter une exigence
        </button>
      }
    >
      {/* ── KPI ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className={`kpi-card ${pctConf >= 75 ? 'kpi-success' : pctConf >= 40 ? 'kpi-warning' : 'kpi-danger'}`}>
          <div className="kpi-label">Taux de conformité</div>
          <div className="kpi-value" style={{ fontSize: 28 }}>
            {pctConf}<span className="kpi-unit" style={{ fontSize: 14 }}>%</span>
          </div>
          <div className="kpi-sub">{exigences.length} exigences au total</div>
        </div>
        <div className="kpi-card kpi-success">
          <div className="kpi-label">Conformes</div>
          <div className="kpi-value" style={{ fontSize: 28, color: '#2E7D32' }}>{nbOui}</div>
        </div>
        <div className="kpi-card kpi-danger">
          <div className="kpi-label">Non conformes</div>
          <div className="kpi-value" style={{ fontSize: 28, color: '#C0392B' }}>{nbNon}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Non renseignées</div>
          <div className="kpi-value" style={{ fontSize: 28, color: 'var(--gray-500)' }}>{nbNR}</div>
        </div>
      </div>

      {/* Formulaire ajout exigence */}
      {showForm && (
        <div className="card mb-16">
          <div className="modal-header" style={{ borderRadius: '8px 8px 0 0' }}>
            <div className="modal-title" style={{ fontSize: 15 }}>Ajouter une exigence d'audit</div>
            <button className="btn-icon" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={creer}>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label>Domaine *</label>
                  <input type="text" required value={creerForm.domaine} onChange={(e) => setCreerForm((f) => ({ ...f, domaine: e.target.value }))} placeholder="Ex : Stockage, Formation…" />
                </div>
                <div className="form-group">
                  <label>Exigence *</label>
                  <input type="text" required value={creerForm.exigence} onChange={(e) => setCreerForm((f) => ({ ...f, exigence: e.target.value }))} placeholder="Texte de l'exigence réglementaire…" />
                </div>
              </div>
              <div className="form-group">
                <label>Question de contrôle <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                <input type="text" value={creerForm.questionControle} onChange={(e) => setCreerForm((f) => ({ ...f, questionControle: e.target.value }))} placeholder="Comment vérifier la conformité ?" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Ajout…' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal édition exigence ──────────────────────────────────────── */}
      {editId !== null && (
        <div className="modal-overlay" onClick={fermerModal}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Renseigner l'exigence</div>
              <button className="btn-icon" onClick={fermerModal}>✕</button>
            </div>
            <form onSubmit={sauvegarder}>
              <div className="modal-body">
                {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}

                {exigenceEditee?.dateAudit && (
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 12 }}>
                    Dernière évaluation : {new Date(exigenceEditee.dateAudit).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0 14px' }}>
                  <div className="form-group">
                    <label>Domaine *</label>
                    <input type="text" required value={editForm.domaine ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, domaine: e.target.value }))} placeholder="Stockage, Formation…" />
                  </div>
                  <div className="form-group">
                    <label>Exigence *</label>
                    <input type="text" required value={editForm.exigence ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, exigence: e.target.value }))} placeholder="Texte de l'exigence…" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Question de contrôle <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                  <input type="text" value={editForm.questionControle ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, questionControle: e.target.value }))} placeholder="Comment vérifier la conformité ?" />
                </div>

                <div className="form-group">
                  <label>Conformité</label>
                  <select
                    value={editForm.conformite ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, conformite: (e.target.value as ConformiteAudit) || null as never }))}
                  >
                    <option value="">Non renseigné</option>
                    <option value="OUI">Conforme (Oui)</option>
                    <option value="NON">Non conforme (Non)</option>
                  </select>
                </div>

                {/* Avertissement : OUI avec actions non résolues */}
                {hasUnresolvedWhenOUI && (
                  <div className="alert alert-warning" style={{ marginBottom: 14, fontSize: 13 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>Cette exigence a des actions correctives non réalisées. Vérifiez qu'elles sont bien clôturées avant de passer en Conforme.</span>
                  </div>
                )}

                <div className="form-group">
                  <label>Preuves / Observations</label>
                  <input
                    type="text"
                    value={editForm.preuves ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, preuves: e.target.value }))}
                    placeholder="Document, référence, observation…"
                  />
                </div>
                <div className="form-group">
                  <label>Action à mener <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(note libre)</span></label>
                  <input
                    type="text"
                    value={editForm.actionAMener ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, actionAMener: e.target.value }))}
                    placeholder="Action corrective à engager…"
                  />
                </div>
                <div className="form-group">
                  <label>Responsable <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                  <input
                    type="text"
                    value={editForm.responsable ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, responsable: e.target.value }))}
                    placeholder="Nom du responsable…"
                  />
                </div>

                {/* ── Actions correctives liées ─────────────────────────────── */}
                {editForm.conformite === 'NON' && (
                  <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconLink />
                        Actions correctives liées
                        {actionsLiees.length > 0 && (
                          <span style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: 10, padding: '0 7px', fontSize: 11, fontWeight: 700 }}>
                            {actionsLiees.length}
                          </span>
                        )}
                      </div>
                      {!showActionForm && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: 12, padding: '4px 10px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                          onClick={() => { setShowActionForm(true); setActionForm((f) => ({ ...f, libelle: exigenceEditee?.exigence ?? '' })); }}
                        >
                          <IconPlus /> Créer une action corrective
                        </button>
                      )}
                    </div>

                    {/* Actions existantes */}
                    {actionsLiees.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {actionsLiees.map((a) => (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '7px 10px', borderRadius: 6, fontSize: 13,
                            background: a.statut === 'REALISE' ? '#F0FDF4' : '#FAFAFA',
                            border: `1px solid ${a.statut === 'REALISE' ? '#BBF7D0' : 'var(--gray-100)'}`,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.libelle}</div>
                              {a.responsable && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{a.responsable}</div>}
                            </div>
                            <span style={{
                              marginLeft: 8, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                              color: STATUT_COLOR[a.statut],
                            }}>
                              {STATUT_LABEL[a.statut]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {actionsLiees.length === 0 && !showActionForm && (
                      <div style={{ fontSize: 13, color: 'var(--gray-400)', fontStyle: 'italic', marginBottom: 8 }}>
                        Aucune action corrective liée. Créez-en une pour tracer la résolution.
                      </div>
                    )}

                    {/* Formulaire création action liée */}
                    {showActionForm && (
                      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.4px', color: '#0369A1', marginBottom: 10 }}>
                          Nouvelle action corrective
                        </div>
                        <div className="form-group" style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 12 }}>Libellé de l'action *</label>
                          <input
                            type="text"
                            required
                            value={actionForm.libelle}
                            onChange={(e) => setActionForm((f) => ({ ...f, libelle: e.target.value }))}
                            placeholder="Décrire l'action à mener…"
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 12 }}>Responsable</label>
                            <input type="text" value={actionForm.responsable} onChange={(e) => setActionForm((f) => ({ ...f, responsable: e.target.value }))} placeholder="Nom…" />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 12 }}>Échéance</label>
                            <input type="date" value={actionForm.echeance} onChange={(e) => setActionForm((f) => ({ ...f, echeance: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowActionForm(false)}>Annuler</button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={actionBusy || !actionForm.libelle.trim()}
                            onClick={creerActionLiee}
                          >
                            {actionBusy ? 'Création…' : 'Créer l\'action'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={fermerModal}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Exigences par domaine ─────────────────────────────────── */}
      {Object.entries(parDomaine).map(([domaine, exList]) => {
        const confDomaine = exList.filter((e) => e.conformite === 'OUI').length;
        const nonDomaine  = exList.filter((e) => e.conformite === 'NON').length;
        return (
          <div key={domaine} className="card mb-14">
            <div className="card-header">
              <div>
                <span className="card-title">{domaine}</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {confDomaine > 0 && <span className="badge badge-conforme">{confDomaine} conforme{confDomaine > 1 ? 's' : ''}</span>}
                  {nonDomaine > 0  && <span className="badge badge-majeur">{nonDomaine} non conforme{nonDomaine > 1 ? 's' : ''}</span>}
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--gray-400)' }}>
                {exList.length} exigence{exList.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20, width: '25%' }}>Exigence</th>
                    <th style={{ width: '22%' }}>Question de contrôle</th>
                    <th style={{ width: 120 }}>Conformité</th>
                    <th>Preuves / Observations</th>
                    <th style={{ width: '20%' }}>Action à mener / Liées</th>
                    <th style={{ width: 110 }}>Responsable</th>
                    <th style={{ width: 72 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {exList.map((ex) => (
                    <tr key={ex.id} style={{ background: ex.conformite === 'NON' ? 'var(--red-50)' : undefined }}>
                      <td style={{ paddingLeft: 20, fontWeight: 600, fontSize: 13.5 }}>
                        {ex.exigence}
                        {ex.dateAudit && (
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400, marginTop: 2 }}>
                            Évalué {new Date(ex.dateAudit).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--gray-600)', fontSize: 13 }}>{ex.questionControle ?? <span className="text-muted">—</span>}</td>
                      <td>
                        {ex.conformite
                          ? <span className={`badge ${CONF_CLS[ex.conformite]}`}>{CONF_LABEL[ex.conformite]}</span>
                          : <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>À saisir</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{ex.preuves ?? <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 13 }}>
                        {ex.actionAMener && <div>{ex.actionAMener}</div>}
                        <ActionsBadge actions={ex.actions ?? []} />
                        {!ex.actionAMener && (!ex.actions || ex.actions.length === 0) && <span className="text-muted">—</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{ex.responsable ?? <span className="text-muted">—</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Renseigner" onClick={() => ouvrir(ex)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                          <button className="btn-icon" title="Supprimer" onClick={() => supprimer(ex.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </Layout>
  );
}
