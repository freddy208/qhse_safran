import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { exigencesApi, ExigenceAudit, ConformiteAudit } from '../api/client';

const CONF_LABEL: Record<string, string>  = { OUI: 'Conforme', NON: 'Non conforme' };
const CONF_CLS:   Record<string, string>  = { OUI: 'badge-conforme', NON: 'badge-majeur' };

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

export default function Exigences() {
  const { projetActif } = useProject();
  const [exigences, setExigences] = useState<ExigenceAudit[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [editForm,  setEditForm]  = useState<Partial<ExigenceAudit>>({});
  const [err,       setErr]       = useState<string | null>(null);

  const charger = async () => {
    if (!projetActif) return;
    setLoading(true);
    try { setExigences(await exigencesApi.list(projetActif.id)); }
    finally { setLoading(false); }
  };

  useEffect(() => { charger(); }, [projetActif?.id]);

  const ouvrir = (ex: ExigenceAudit) => {
    setEditId(ex.id);
    setEditForm({ conformite: ex.conformite, preuves: ex.preuves ?? '', actionAMener: ex.actionAMener ?? '', responsable: ex.responsable ?? '' });
    setErr(null);
  };

  const sauvegarder = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    try { await exigencesApi.update(editId, editForm); setEditId(null); await charger(); }
    catch (ex: unknown) { setErr((ex as Error).message); }
  };

  const parDomaine = exigences.reduce<Record<string, ExigenceAudit[]>>((acc, ex) => {
    (acc[ex.domaine] = acc[ex.domaine] ?? []).push(ex);
    return acc;
  }, {});

  const nbOui  = exigences.filter((e) => e.conformite === 'OUI').length;
  const nbNon  = exigences.filter((e) => e.conformite === 'NON').length;
  const nbNR   = exigences.filter((e) => !e.conformite).length;
  const pctConf = exigences.length > 0 ? Math.round((nbOui / exigences.length) * 100) : 0;

  if (loading) return (
    <Layout title="Audit PRO0239" subtitle={projetActif?.nom}>
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
      title="Audit référentiel PRO0239"
      subtitle={projetActif?.nom ?? ''}
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

      {/* Modal édition exigence */}
      {editId !== null && (
        <div className="modal-overlay" onClick={() => { setEditId(null); setErr(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Renseigner l'exigence</div>
              <button className="btn-icon" onClick={() => { setEditId(null); setErr(null); }}>✕</button>
            </div>
            <form onSubmit={sauvegarder}>
              <div className="modal-body">
                {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}
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
                  <label>Action à mener</label>
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setEditId(null); setErr(null); }}>Annuler</button>
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
                    <th style={{ paddingLeft: 20, width: '22%' }}>Exigence</th>
                    <th style={{ width: '28%' }}>Question de contrôle</th>
                    <th style={{ width: 120 }}>Conformité</th>
                    <th>Preuves / Observations</th>
                    <th>Action à mener</th>
                    <th style={{ width: 110 }}>Responsable</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {exList.map((ex) => (
                    <tr key={ex.id} style={{ background: ex.conformite === 'NON' ? 'var(--red-50)' : undefined }}>
                      <td style={{ paddingLeft: 20, fontWeight: 600, fontSize: 13.5 }}>{ex.exigence}</td>
                      <td style={{ color: 'var(--gray-600)', fontSize: 13 }}>{ex.questionControle ?? <span className="text-muted">—</span>}</td>
                      <td>
                        {ex.conformite
                          ? <span className={`badge ${CONF_CLS[ex.conformite]}`}>{CONF_LABEL[ex.conformite]}</span>
                          : <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>À saisir</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>{ex.preuves ?? <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 13 }}>{ex.actionAMener ?? <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 13 }}>{ex.responsable ?? <span className="text-muted">—</span>}</td>
                      <td>
                        <button className="btn-icon" title="Renseigner" onClick={() => ouvrir(ex)}><IconEdit /></button>
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
