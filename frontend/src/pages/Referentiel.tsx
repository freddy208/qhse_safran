import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { axesApi, sousActionsApi, zonesApi, armoiresApi, Axe, SousAction, Zone } from '../api/client';

type Onglet = 'axes' | 'zones';

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

export default function Referentiel() {
  const { projetActif, refreshProjets } = useProject();
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

  const charger = async (init = false) => {
    if (!projetActif) return;
    if (init) setLoading(true);
    try {
      const [a, z] = await Promise.all([axesApi.list(projetActif.id), zonesApi.list(projetActif.id)]);
      setAxes(a); setZones(z);
      if (a[0] && !saAxeId)  setSaAxeId(a[0].id);
      if (z[0] && !zoneIdA)  setZoneIdA(z[0].id);
    } finally { if (init) setLoading(false); }
  };

  useEffect(() => { charger(true); }, [projetActif?.id]);

  const soumettre = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { await fn(); await charger(); await refreshProjets(); }
    catch (ex: unknown) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  const suppAxe     = async (id: number) => { if (!confirm('Supprimer cet axe et toutes ses sous-actions ?')) return; await axesApi.delete(id); await charger(); await refreshProjets(); };
  const suppSA      = async (id: number) => { if (!confirm('Supprimer cette sous-action ?')) return; await sousActionsApi.delete(id); await charger(); };
  const suppZone    = async (id: number) => { if (!confirm('Supprimer cette zone et ses armoires ?')) return; await zonesApi.delete(id); await charger(); };
  const suppArmoire = async (id: number) => { if (!confirm('Supprimer cette armoire ?')) return; await armoiresApi.delete(id); await charger(); };

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
      subtitle={`Configuration des axes, zones et armoires — ${projetActif?.nom ?? ''}`}
    >
      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="tabs">
        {(['axes', 'zones'] as Onglet[]).map((o) => (
          <button key={o} className={`tab${onglet === o ? ' active' : ''}`} onClick={() => setOnglet(o)}>
            {o === 'axes' ? 'Axes & Sous-actions' : 'Zones & Armoires'}
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
                {editAxeId === axe.id ? (
                  <form onSubmit={sauvegarderAxe} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                    <input type="text" required value={editAxeForm.code} onChange={(e) => setEditAxeForm((p) => ({ ...p, code: e.target.value }))} placeholder="Code" style={{ width: 80, height: 30, fontSize: 13 }} />
                    <input type="text" required value={editAxeForm.intitule} onChange={(e) => setEditAxeForm((p) => ({ ...p, intitule: e.target.value }))} placeholder="Intitulé" style={{ flex: 1, height: 30, fontSize: 13 }} />
                    <input type="number" required min="0" max="100" step="0.1" value={editAxeForm.ponderation} onChange={(e) => setEditAxeForm((p) => ({ ...p, ponderation: e.target.value }))} placeholder="%" style={{ width: 70, height: 30, fontSize: 13 }} />
                    <button type="submit" className="btn-icon" disabled={busy} style={{ color: '#2E7D32', borderColor: '#bbf7d0' }}><IconCheck /></button>
                    <button type="button" className="btn-icon" onClick={() => setEditAxeId(null)} style={{ color: '#6B7280', borderColor: '#e5e7eb' }}><IconX /></button>
                  </form>
                ) : (
                  <div className="flex items-center gap-10">
                    <span className="axe-code-chip">{axe.code}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{axe.intitule}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 400 }}>— {axe.ponderation}%</span>
                  </div>
                )}
                {editAxeId !== axe.id && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditAxe(axe)} style={{ color: '#0055A4', borderColor: '#bfdbfe' }}><IconEdit /></button>
                    <button className="btn btn-danger btn-xs" onClick={() => suppAxe(axe.id)}><IconTrash /> Supprimer</button>
                  </div>
                )}
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
                      editSaId === sa.id ? (
                        <tr key={sa.id} style={{ background: 'var(--blue-50)' }}>
                          <td colSpan={5} style={{ padding: '10px 20px' }}>
                            <form onSubmit={sauvegarderSA} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <input type="text" required value={editSaForm.libelle} onChange={(e) => setEditSaForm((p) => ({ ...p, libelle: e.target.value }))} placeholder="Libellé" style={{ flex: 2, minWidth: 180, height: 30, fontSize: 13 }} />
                              <input type="number" required min="0" max="100" step="0.1" value={editSaForm.ponderationDansAxe} onChange={(e) => setEditSaForm((p) => ({ ...p, ponderationDansAxe: e.target.value }))} placeholder="Poids%" style={{ width: 80, height: 30, fontSize: 13 }} />
                              <input type="text" value={editSaForm.responsable} onChange={(e) => setEditSaForm((p) => ({ ...p, responsable: e.target.value }))} placeholder="Responsable" style={{ flex: 1, minWidth: 120, height: 30, fontSize: 13 }} />
                              <input type="date" value={editSaForm.echeance} onChange={(e) => setEditSaForm((p) => ({ ...p, echeance: e.target.value }))} style={{ width: 130, height: 30, fontSize: 13 }} />
                              <button type="submit" className="btn-icon" disabled={busy} style={{ color: '#2E7D32', borderColor: '#bbf7d0' }}><IconCheck /></button>
                              <button type="button" className="btn-icon" onClick={() => setEditSaId(null)} style={{ color: '#6B7280', borderColor: '#e5e7eb' }}><IconX /></button>
                            </form>
                          </td>
                        </tr>
                      ) : (
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
                      )
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
                {editZoneId === zone.id ? (
                  <form onSubmit={sauvegarderZone} style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                    <input value={editZoneNom} onChange={(e) => setEditZoneNom(e.target.value)} placeholder="Nom de la zone" required style={{ flex: 1, fontSize: 13 }} />
                    <button type="submit" className="btn-icon" title="Sauvegarder" disabled={busy} style={{ color: '#16a34a', borderColor: '#86efac' }}><IconCheck /></button>
                    <button type="button" className="btn-icon" title="Annuler" onClick={() => setEditZoneId(null)} style={{ color: '#6b7280', borderColor: '#d1d5db' }}><IconX /></button>
                  </form>
                ) : (
                  <>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Zone : {zone.nom}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditZone(zone)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                      <button className="btn btn-danger btn-xs" onClick={() => suppZone(zone.id)}><IconTrash /> Supprimer</button>
                    </div>
                  </>
                )}
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
                        {editArmoireId === a.id ? (
                          <td colSpan={2} style={{ paddingLeft: 20 }}>
                            <form onSubmit={sauvegarderArmoire} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input value={editArmoireNom} onChange={(e) => setEditArmoireNom(e.target.value)} placeholder="Nom de l'armoire" required style={{ flex: 1, fontSize: 13 }} />
                              <button type="submit" className="btn-icon" title="Sauvegarder" disabled={busy} style={{ color: '#16a34a', borderColor: '#86efac' }}><IconCheck /></button>
                              <button type="button" className="btn-icon" title="Annuler" onClick={() => setEditArmoireId(null)} style={{ color: '#6b7280', borderColor: '#d1d5db' }}><IconX /></button>
                            </form>
                          </td>
                        ) : (
                          <>
                            <td style={{ paddingLeft: 20, fontWeight: 500 }}>{a.nom}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button className="btn-icon" title="Modifier" onClick={() => ouvrirEditArmoire(a)} style={{ color: '#2563eb', borderColor: '#93c5fd' }}><IconEdit /></button>
                                <button className="btn-icon" title="Supprimer" onClick={() => suppArmoire(a.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                              </div>
                            </td>
                          </>
                        )}
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
    </Layout>
  );
}
