import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { axesApi, sousActionsApi, zonesApi, armoiresApi, checklistsApi, Axe, SousAction, Zone, TypeChecklist, Critere } from '../api/client';
import { useToast } from '../contexts/ToastContext';

type Onglet = 'axes' | 'zones' | 'checklists';

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

export default function Referentiel() {
  const { projetActif, refreshProjets } = useProject();
  const toast = useToast();
  const [onglet,      setOnglet]      = useState<Onglet>('axes');
  const [axes,        setAxes]        = useState<Axe[]>([]);
  const [zones,       setZones]       = useState<Zone[]>([]);
  const [err,         setErr]         = useState<string | null>(null);
  const [busy,        setBusy]        = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [axeForm,     setAxeForm]     = useState({ code: '', intitule: '', ponderation: '' });
  const [saForm,      setSaForm]      = useState({ libelle: '', ponderationDansAxe: '', responsable: '', echeance: '' });
  const [saAxeId,     setSaAxeId]     = useState<number | null>(null);
  const [zoneForm,    setZoneForm]    = useState('');
  const [zoneIdA,     setZoneIdA]     = useState<number | null>(null);
  const [armoireForm, setArmoireForm] = useState('');

  // États d'édition inline
  const [editAxeId,      setEditAxeId]      = useState<number | null>(null);
  const [editAxeForm,    setEditAxeForm]    = useState({ code: '', intitule: '', ponderation: '' });
  const [editSaId,       setEditSaId]       = useState<number | null>(null);
  const [editSaForm,     setEditSaForm]     = useState({ libelle: '', ponderationDansAxe: '', responsable: '', echeance: '' });
  const [editZoneId,     setEditZoneId]     = useState<number | null>(null);
  const [editZoneNom,    setEditZoneNom]    = useState('');
  const [editArmoireId,  setEditArmoireId]  = useState<number | null>(null);
  const [editArmoireNom, setEditArmoireNom] = useState('');

  // Checklists
  const [typeChecklists,   setTypeChecklists]   = useState<TypeChecklist[]>([]);
  const [newTypeNom,       setNewTypeNom]       = useState('');
  const [newCritereTypeId, setNewCritereTypeId] = useState<number | null>(null);
  const [newCritereLibelle, setNewCritereLibelle] = useState('');
  const [editTypeId,       setEditTypeId]       = useState<number | null>(null);
  const [editTypeNom,      setEditTypeNom]      = useState('');
  const [editCritereId,    setEditCritereId]    = useState<number | null>(null);
  const [editCritereLibelle, setEditCritereLibelle] = useState('');

  const charger = async (init = false) => {
    if (!projetActif) return;
    if (init) setLoading(true);
    try {
      const [a, z, tc] = await Promise.all([axesApi.list(projetActif.id), zonesApi.list(projetActif.id), checklistsApi.listTypes()]);
      setAxes(a); setZones(z); setTypeChecklists(tc);
      if (a[0] && !saAxeId)  setSaAxeId(a[0].id);
      if (z[0] && !zoneIdA)  setZoneIdA(z[0].id);
      if (tc[0] && !newCritereTypeId) setNewCritereTypeId(tc[0].id);
    } finally { if (init) setLoading(false); }
  };

  useEffect(() => { charger(true); }, [projetActif?.id]);

  const soumettre = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await fn(); await charger(); await refreshProjets(); }
    catch (ex: unknown) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  const suppAxe     = async (id: number) => { if (!confirm('Supprimer cet axe et toutes ses sous-actions ?')) return; try { await axesApi.delete(id); await charger(); await refreshProjets(); } catch (e) { toast.error((e as Error).message); } };
  const suppSA      = async (id: number) => { if (!confirm('Supprimer cette sous-action ?')) return; try { await sousActionsApi.delete(id); await charger(); } catch (e) { toast.error((e as Error).message); } };
  const suppZone    = async (id: number) => { if (!confirm('Supprimer cette zone et ses armoires ?')) return; try { await zonesApi.delete(id); await charger(); } catch (e) { toast.error((e as Error).message); } };
  const suppArmoire = async (id: number) => { if (!confirm('Supprimer cette armoire ?')) return; try { await armoiresApi.delete(id); await charger(); } catch (e) { toast.error((e as Error).message); } };

  const ouvrirEditAxe = (axe: Axe) => { setEditAxeId(axe.id); setEditAxeForm({ code: axe.code, intitule: axe.intitule, ponderation: String(axe.ponderation) }); };
  const sauvegarderAxe = soumettre(() => axesApi.update(editAxeId!, { code: editAxeForm.code, intitule: editAxeForm.intitule, ponderation: parseFloat(editAxeForm.ponderation) }).then(() => setEditAxeId(null)));

  const ouvrirEditSA = (sa: SousAction) => { setEditSaId(sa.id); setEditSaForm({ libelle: sa.libelle, ponderationDansAxe: String(sa.ponderationDansAxe), responsable: sa.responsable ?? '', echeance: sa.echeance ? sa.echeance.slice(0, 10) : '' }); };
  const sauvegarderSA = soumettre(() => sousActionsApi.update(editSaId!, { libelle: editSaForm.libelle, ponderationDansAxe: parseFloat(editSaForm.ponderationDansAxe), responsable: editSaForm.responsable || null, echeance: editSaForm.echeance ? new Date(editSaForm.echeance).toISOString() : null }).then(() => setEditSaId(null)));

  const ouvrirEditZone = (zone: Zone) => { setEditZoneId(zone.id); setEditZoneNom(zone.nom); };
  const sauvegarderZone = soumettre(() => zonesApi.update(editZoneId!, editZoneNom).then(() => setEditZoneId(null)));

  const ouvrirEditArmoire = (a: { id: number; nom: string }) => { setEditArmoireId(a.id); setEditArmoireNom(a.nom); };
  const sauvegarderArmoire = soumettre(() => armoiresApi.update(editArmoireId!, editArmoireNom).then(() => setEditArmoireId(null)));

  if (loading) return (
    <Layout title="Référentiel" subtitle={projetActif?.nom}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[...Array(2)].map((_, i) => <div key={i} className="skeleton" style={{ height: 32, width: 120, borderRadius: 4 }} />)}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card mb-12" style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div className="skeleton" style={{ height: 14, width: 60 }} />
            <div className="skeleton" style={{ height: 14, flex: 1 }} />
            <div className="skeleton" style={{ height: 26, width: 60, borderRadius: 4 }} />
          </div>
          {[...Array(2)].map((_, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, marginLeft: 16, marginBottom: 6 }}>
              <div className="skeleton" style={{ height: 11, flex: 1 }} />
              <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ))}
    </Layout>
  );

  return (
    <Layout
      title="Référentiel"
      subtitle={projetActif?.nom ?? ''}
    >
      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="tabs">
        {(['axes', 'zones', 'checklists'] as Onglet[]).map((o) => (
          <button key={o} className={`tab${onglet === o ? ' active' : ''}`} onClick={() => setOnglet(o)}>
            {o === 'axes' ? 'Axes & Sous-actions' : o === 'zones' ? 'Zones & Armoires' : 'Types de checklist'}
          </button>
        ))}
      </div>

      {err && <div className="alert alert-error mb-16">{err}</div>}

      {/* ═══ AXES ════════════════════════════════════════════════════ */}
      {onglet === 'axes' && (
        <>
          {/* Créer axe */}
          <div className="card mb-14">
            <div className="card-header"><span className="card-title">Ajouter un axe</span></div>
            <div className="card-body">
              <form onSubmit={soumettre(() => axesApi.create(projetActif!.id, {
                code: axeForm.code, intitule: axeForm.intitule,
                ponderation: parseFloat(axeForm.ponderation),
              }).then(() => setAxeForm({ code: '', intitule: '', ponderation: '' })))}>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px auto', gap: '0 12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Code</label>
                    <input type="text" required value={axeForm.code} onChange={(e) => setAxeForm((p) => ({ ...p, code: e.target.value }))} placeholder="AXE8" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Intitulé</label>
                    <input type="text" required value={axeForm.intitule} onChange={(e) => setAxeForm((p) => ({ ...p, intitule: e.target.value }))} placeholder="Libellé de l'axe…" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Pondération (%)</label>
                    <input type="number" min="0" max="100" step="0.1" required value={axeForm.ponderation} onChange={(e) => setAxeForm((p) => ({ ...p, ponderation: e.target.value }))} placeholder="10" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ marginBottom: 1 }}>Ajouter</button>
                </div>
              </form>
            </div>
          </div>

          {/* Créer sous-action */}
          <div className="card mb-14">
            <div className="card-header"><span className="card-title">Ajouter une sous-action</span></div>
            <div className="card-body">
              <form onSubmit={soumettre(() => sousActionsApi.create(saAxeId!, {
                libelle:            saForm.libelle,
                ponderationDansAxe: parseFloat(saForm.ponderationDansAxe),
                responsable:        saForm.responsable || null,
                echeance:           saForm.echeance ? new Date(saForm.echeance).toISOString() : null,
              }).then(() => setSaForm({ libelle: '', ponderationDansAxe: '', responsable: '', echeance: '' })))}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 130px auto', gap: '0 12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Axe parent</label>
                    <select value={saAxeId ?? ''} onChange={(e) => setSaAxeId(Number(e.target.value))}>
                      {axes.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.intitule.slice(0, 28)}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Libellé de la sous-action</label>
                    <input type="text" required value={saForm.libelle} onChange={(e) => setSaForm((p) => ({ ...p, libelle: e.target.value }))} placeholder="Libellé…" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Poids dans axe (%)</label>
                    <input type="number" min="0" max="100" step="0.1" required value={saForm.ponderationDansAxe} onChange={(e) => setSaForm((p) => ({ ...p, ponderationDansAxe: e.target.value }))} placeholder="20" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !saAxeId} style={{ marginBottom: 1 }}>Ajouter</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginTop: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Responsable <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="text" value={saForm.responsable} onChange={(e) => setSaForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Nom du responsable…" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Échéance <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="date" value={saForm.echeance} onChange={(e) => setSaForm((p) => ({ ...p, echeance: e.target.value }))} />
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Liste axes */}
          {axes.map((axe) => (
            <div key={axe.id} className="card mb-12">
              <div className="card-header">
                <div className="flex items-center gap-10">
                  <span className="axe-code-chip">{axe.code}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{axe.intitule}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 400 }}>({axe.ponderation}%)</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditAxe(axe)} style={{ color: '#0055A4', borderColor: '#bfdbfe' }}><IconEdit /></button>
                  <button className="btn btn-danger btn-xs" onClick={() => suppAxe(axe.id)}><IconTrash /> Supprimer</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>Libellé sous-action</th>
                      <th style={{ width: 90 }}>Poids</th>
                      <th style={{ width: 140 }}>Responsable</th>
                      <th style={{ width: 110 }}>Échéance</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(axe.sousActions ?? []).map((sa: SousAction) => (
                      <tr key={sa.id}>
                        <td style={{ paddingLeft: 20 }}>{sa.libelle}</td>
                        <td><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>{sa.ponderationDansAxe}%</span></td>
                        <td style={{ fontSize: 13 }}>{sa.responsable ?? <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>—</span>}</td>
                        <td style={{ fontSize: 13 }}>
                          {sa.echeance
                            ? <span style={{ color: new Date(sa.echeance) < new Date() ? '#C0392B' : 'inherit', fontWeight: new Date(sa.echeance) < new Date() ? 600 : 400 }}>{new Date(sa.echeance).toLocaleDateString('fr-FR')}</span>
                            : <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditSA(sa)} style={{ color: '#0055A4', borderColor: '#bfdbfe' }}><IconEdit /></button>
                          <button className="btn-icon" title="Supprimer" onClick={() => suppSA(sa.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                        </td>
                      </tr>
                    ))}
                    {(!axe.sousActions || axe.sousActions.length === 0) && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-400)', fontStyle: 'italic', paddingLeft: 20 }}>Aucune sous-action</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══ ZONES ═══════════════════════════════════════════════════ */}
      {onglet === 'zones' && (
        <>
          {/* Créer zone */}
          <div className="card mb-14">
            <div className="card-header"><span className="card-title">Ajouter une zone</span></div>
            <div className="card-body">
              <form onSubmit={soumettre(() => zonesApi.create(projetActif!.id, zoneForm).then(() => setZoneForm('')))}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nom de la zone</label>
                    <input type="text" required value={zoneForm} onChange={(e) => setZoneForm(e.target.value)} placeholder="Ex : ICLC, Atelier Est…" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ marginBottom: 1 }}>Ajouter</button>
                </div>
              </form>
            </div>
          </div>

          {/* Créer armoire */}
          <div className="card mb-14">
            <div className="card-header"><span className="card-title">Ajouter une armoire</span></div>
            <div className="card-body">
              <form onSubmit={soumettre(() => armoiresApi.create(zoneIdA!, armoireForm).then(() => setArmoireForm('')))}>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: '0 12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Zone</label>
                    <select value={zoneIdA ?? ''} onChange={(e) => setZoneIdA(Number(e.target.value))}>
                      {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nom de l'armoire</label>
                    <input type="text" required value={armoireForm} onChange={(e) => setArmoireForm(e.target.value)} placeholder="Ex : Armoire 1, Casier Sud…" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !zoneIdA} style={{ marginBottom: 1 }}>Ajouter</button>
                </div>
              </form>
            </div>
          </div>

          {/* Liste zones */}
          {zones.map((zone) => (
            <div key={zone.id} className="card mb-12">
              <div className="card-header">
                <span style={{ fontWeight: 700, fontSize: 14 }}>Zone : {zone.nom}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditZone(zone)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                  <button className="btn btn-danger btn-xs" onClick={() => suppZone(zone.id)}><IconTrash /> Supprimer</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 20 }}>Armoire</th>
                      <th style={{ width: 110 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(zone.armoires ?? []).map((a) => (
                      <tr key={a.id}>
                        <td style={{ paddingLeft: 20, fontWeight: 500 }}>{a.nom}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditArmoire(a)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                            <button className="btn-icon" title="Supprimer" onClick={() => suppArmoire(a.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!zone.armoires || zone.armoires.length === 0) && (
                      <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--gray-400)', fontStyle: 'italic', paddingLeft: 20 }}>Aucune armoire dans cette zone</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ═══ CHECKLISTS ══════════════════════════════════════════════ */}
      {onglet === 'checklists' && (
        <>
          {/* Créer type de checklist */}
          <div className="card mb-14">
            <div className="card-header"><span className="card-title">Ajouter un type de checklist</span></div>
            <div className="card-body">
              <form onSubmit={soumettre(() => checklistsApi.createType(newTypeNom).then((tc) => { setTypeChecklists((p) => [...p, { ...tc, criteres: [] }]); setNewTypeNom(''); if (!newCritereTypeId) setNewCritereTypeId(tc.id); }))}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 12px', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nom du type</label>
                    <input type="text" required value={newTypeNom} onChange={(e) => setNewTypeNom(e.target.value)} placeholder="Ex : Conformité EN 14470-1…" />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy} style={{ marginBottom: 1 }}>Ajouter</button>
                </div>
              </form>
            </div>
          </div>

          {/* Ajouter un critère */}
          {typeChecklists.length > 0 && (
            <div className="card mb-14">
              <div className="card-header"><span className="card-title">Ajouter un critère</span></div>
              <div className="card-body">
                <form onSubmit={soumettre(async () => {
                  const tc = typeChecklists.find((t) => t.id === newCritereTypeId);
                  const ordre = tc ? tc.criteres.length + 1 : 1;
                  const c = await checklistsApi.createCritere(newCritereTypeId!, newCritereLibelle, ordre);
                  setTypeChecklists((p) => p.map((t) => t.id === newCritereTypeId ? { ...t, criteres: [...t.criteres, c] } : t));
                  setNewCritereLibelle('');
                })}>
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '0 12px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Type parent</label>
                      <select value={newCritereTypeId ?? ''} onChange={(e) => setNewCritereTypeId(Number(e.target.value))}>
                        {typeChecklists.map((t) => <option key={t.id} value={t.id}>{t.nom.slice(0, 40)}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Libellé du critère</label>
                      <input type="text" required value={newCritereLibelle} onChange={(e) => setNewCritereLibelle(e.target.value)} placeholder="Ex : Marquage EN 14470-1…" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !newCritereTypeId} style={{ marginBottom: 1 }}>Ajouter</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Liste types avec critères */}
          {typeChecklists.map((tc) => (
            <div key={tc.id} className="card mb-12">
              <div className="card-header">
                <span style={{ fontWeight: 700, fontSize: 14 }}>{tc.nom}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-icon" title="Renommer" onClick={() => { setEditTypeId(tc.id); setEditTypeNom(tc.nom); }} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                  <button className="btn btn-danger btn-xs" onClick={async () => { if (!confirm(`Supprimer "${tc.nom}" et tous ses critères ?`)) return; try { await checklistsApi.deleteType(tc.id); setTypeChecklists((p) => p.filter((t) => t.id !== tc.id)); } catch (e) { toast.error((e as Error).message); } }}><IconTrash /> Supprimer</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 50, paddingLeft: 20 }}>#</th>
                      <th>Libellé du critère</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tc.criteres.map((c) => (
                      <tr key={c.id}>
                        <td style={{ paddingLeft: 20, color: 'var(--gray-400)', fontSize: 13 }}>{c.ordre}</td>
                        <td style={{ paddingLeft: 4 }}>{c.libelle}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="btn-icon" title="Modifier" onClick={() => { setEditCritereId(c.id); setEditCritereLibelle(c.libelle); }} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                            <button className="btn-icon" title="Supprimer" onClick={async () => { if (!confirm('Supprimer ce critère ?')) return; try { await checklistsApi.deleteCritere(c.id); setTypeChecklists((p) => p.map((t) => t.id === tc.id ? { ...t, criteres: t.criteres.filter((cr) => cr.id !== c.id) } : t)); } catch (e) { toast.error((e as Error).message); } }} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tc.criteres.length === 0 && (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--gray-400)', fontStyle: 'italic', paddingLeft: 20 }}>Aucun critère</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Modal renommer type */}
          {editTypeId !== null && (
            <div className="modal-overlay" onClick={() => setEditTypeId(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title">Renommer le type de checklist</div>
                  <button className="btn-icon" onClick={() => setEditTypeId(null)}>✕</button>
                </div>
                <form onSubmit={soumettre(() => checklistsApi.updateType(editTypeId!, editTypeNom).then((updated) => { setTypeChecklists((p) => p.map((t) => t.id === editTypeId ? { ...t, nom: updated.nom } : t)); setEditTypeId(null); }))}>
                  <div className="modal-body">
                    {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                    <div className="form-group">
                      <label>Nom *</label>
                      <input type="text" required value={editTypeNom} onChange={(e) => setEditTypeNom(e.target.value)} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditTypeId(null)}>Annuler</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal modifier critère */}
          {editCritereId !== null && (
            <div className="modal-overlay" onClick={() => setEditCritereId(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title">Modifier le critère</div>
                  <button className="btn-icon" onClick={() => setEditCritereId(null)}>✕</button>
                </div>
                <form onSubmit={soumettre(() => checklistsApi.updateCritere(editCritereId!, { libelle: editCritereLibelle }).then((updated: Critere) => { setTypeChecklists((p) => p.map((t) => ({ ...t, criteres: t.criteres.map((c) => c.id === editCritereId ? { ...c, libelle: updated.libelle } : c) }))); setEditCritereId(null); }))}>
                  <div className="modal-body">
                    {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                    <div className="form-group">
                      <label>Libellé *</label>
                      <input type="text" required value={editCritereLibelle} onChange={(e) => setEditCritereLibelle(e.target.value)} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditCritereId(null)}>Annuler</button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal édition axe */}
      {editAxeId !== null && (
        <div className="modal-overlay" onClick={() => setEditAxeId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Modifier l'axe</div>
              <button className="btn-icon" onClick={() => setEditAxeId(null)}>✕</button>
            </div>
            <form onSubmit={sauvegarderAxe}>
              <div className="modal-body">
                {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0 16px' }}>
                  <div className="form-group">
                    <label>Code *</label>
                    <input type="text" required value={editAxeForm.code} onChange={(e) => setEditAxeForm((p) => ({ ...p, code: e.target.value }))} placeholder="AXE1" />
                  </div>
                  <div className="form-group">
                    <label>Intitulé *</label>
                    <input type="text" required value={editAxeForm.intitule} onChange={(e) => setEditAxeForm((p) => ({ ...p, intitule: e.target.value }))} placeholder="Intitulé de l'axe…" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Pondération (%)</label>
                  <input type="number" min="0" max="100" step="0.1" required value={editAxeForm.ponderation} onChange={(e) => setEditAxeForm((p) => ({ ...p, ponderation: e.target.value }))} placeholder="10" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditAxeId(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition sous-action */}
      {editSaId !== null && (
        <div className="modal-overlay" onClick={() => setEditSaId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Modifier la sous-action</div>
              <button className="btn-icon" onClick={() => setEditSaId(null)}>✕</button>
            </div>
            <form onSubmit={sauvegarderSA}>
              <div className="modal-body">
                {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                <div className="form-group">
                  <label>Libellé *</label>
                  <input type="text" required value={editSaForm.libelle} onChange={(e) => setEditSaForm((p) => ({ ...p, libelle: e.target.value }))} placeholder="Libellé de la sous-action…" />
                </div>
                <div className="form-group">
                  <label>Poids dans l'axe (%)</label>
                  <input type="number" min="0" max="100" step="0.1" required value={editSaForm.ponderationDansAxe} onChange={(e) => setEditSaForm((p) => ({ ...p, ponderationDansAxe: e.target.value }))} placeholder="20" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div className="form-group">
                    <label>Responsable <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="text" value={editSaForm.responsable} onChange={(e) => setEditSaForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Nom du responsable…" />
                  </div>
                  <div className="form-group">
                    <label>Échéance <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="date" value={editSaForm.echeance} onChange={(e) => setEditSaForm((p) => ({ ...p, echeance: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditSaId(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition zone */}
      {editZoneId !== null && (
        <div className="modal-overlay" onClick={() => setEditZoneId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Modifier la zone</div>
              <button className="btn-icon" onClick={() => setEditZoneId(null)}>✕</button>
            </div>
            <form onSubmit={sauvegarderZone}>
              <div className="modal-body">
                {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                <div className="form-group">
                  <label>Nom de la zone *</label>
                  <input type="text" required value={editZoneNom} onChange={(e) => setEditZoneNom(e.target.value)} placeholder="Ex : ICLC, Atelier Est…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditZoneId(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition armoire */}
      {editArmoireId !== null && (
        <div className="modal-overlay" onClick={() => setEditArmoireId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Modifier l'armoire</div>
              <button className="btn-icon" onClick={() => setEditArmoireId(null)}>✕</button>
            </div>
            <form onSubmit={sauvegarderArmoire}>
              <div className="modal-body">
                {err && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{err}</div>}
                <div className="form-group">
                  <label>Nom de l'armoire *</label>
                  <input type="text" required value={editArmoireNom} onChange={(e) => setEditArmoireNom(e.target.value)} placeholder="Ex : Armoire 1, Casier Sud…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditArmoireId(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
