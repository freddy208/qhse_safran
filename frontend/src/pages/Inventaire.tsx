import { useEffect, useState, FormEvent } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { zonesApi, armoiresApi, produitsApi, exportApi, Zone, ProduitAvecConformite, ProduitPage } from '../api/client';
import { ConformiteBadge } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';

interface ProduitForm {
  nom: string; codeProduit: string; quantitePresente: string;
  quantiteUtilisee: string; volumeMax: string;
  datePeremption: string; urlFds: string; fdsDateVerification: string;
  raison: string;
}
const FORM_VIDE: ProduitForm = {
  nom: '', codeProduit: '', quantitePresente: '', quantiteUtilisee: '',
  volumeMax: '', datePeremption: '', urlFds: '', fdsDateVerification: '',
  raison: '',
};
function toISO(s: string) { return s ? new Date(s).toISOString() : undefined; }
function isExpired(d: string | null | undefined) {
  return d && new Date(d) < new Date();
}

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

export default function Inventaire() {
  const { projetActif } = useProject();
  const toast = useToast();
  const [zones,     setZones]     = useState<Zone[]>([]);
  const [zoneId,    setZoneId]    = useState<number | null>(null);
  const [armoireId, setArmoireId] = useState<number | null>(null);
  const [produits,  setProduits]  = useState<ProduitAvecConformite[]>([]);
  const [pagination, setPagination] = useState<Omit<ProduitPage, 'data'> | null>(null);
  const [page,      setPage]      = useState(1);
  const [modal,     setModal]     = useState<'create' | 'edit' | null>(null);
  const [form,      setForm]      = useState<ProduitForm>(FORM_VIDE);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [err,       setErr]       = useState<string | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [modalZoneId,    setModalZoneId]    = useState<number | null>(null);
  const [modalArmoireId, setModalArmoireId] = useState<number | null>(null);

  useEffect(() => {
    if (!projetActif) return;
    setLoading(true);
    zonesApi.list(projetActif.id).then((z) => {
      setZones(z);
      if (z[0]) setZoneId(z[0].id);
    }).finally(() => setLoading(false));
  }, [projetActif?.id]);

  useEffect(() => {
    const zone = zones.find((z) => z.id === zoneId);
    const arm  = zone?.armoires?.[0];
    setPage(1);
    setArmoireId(arm ? arm.id : null);
  }, [zoneId, zones]);

  useEffect(() => {
    if (!armoireId) { setProduits([]); setPagination(null); return; }
    produitsApi.list(armoireId, page).then(({ data, ...meta }) => {
      setProduits(data);
      setPagination(meta);
    });
  }, [armoireId, page]);

  const refresh = () => {
    if (!armoireId) return;
    produitsApi.list(armoireId, page).then(({ data, ...meta }) => {
      setProduits(data);
      setPagination(meta);
    });
  };

  const ouvrirCreation = () => {
    setForm(FORM_VIDE); setEditId(null); setErr(null);
    const mz = zoneId ?? (zones[0]?.id ?? null);
    const zone = zones.find((z) => z.id === mz);
    const ma = armoireId ?? (zone?.armoires?.[0]?.id ?? null);
    setModalZoneId(mz); setModalArmoireId(ma);
    setModal('create');
  };
  const ouvrirEdition  = (p: ProduitAvecConformite) => {
    setForm({
      nom:                 p.nom,
      codeProduit:         p.codeProduit ?? '',
      quantitePresente:    p.quantitePresente != null ? String(p.quantitePresente) : '',
      quantiteUtilisee:    p.quantiteUtilisee != null ? String(p.quantiteUtilisee) : '',
      volumeMax:           p.volumeMax != null ? String(p.volumeMax) : '',
      datePeremption:      p.datePeremption ? p.datePeremption.slice(0, 10) : '',
      urlFds:              p.urlFds ?? '',
      fdsDateVerification: p.fdsDateVerification ? p.fdsDateVerification.slice(0, 10) : '',
      raison:              p.raison ?? '',
    });
    setEditId(p.id); setErr(null); setModal('edit');
  };

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    const cibleArmoireId = editId ? armoireId : modalArmoireId;
    if (!cibleArmoireId) { setErr('Sélectionnez une armoire.'); return; }
    setBusy(true); setErr(null);
    try {
      const payload = {
        nom:                 form.nom,
        codeProduit:         form.codeProduit || null,
        quantitePresente:    form.quantitePresente ? parseFloat(form.quantitePresente) : null,
        quantiteUtilisee:    form.quantiteUtilisee ? parseFloat(form.quantiteUtilisee) : null,
        volumeMax:           form.volumeMax ? parseFloat(form.volumeMax) : null,
        datePeremption:      toISO(form.datePeremption),
        urlFds:              form.urlFds || null,
        fdsDateVerification: toISO(form.fdsDateVerification),
        raison:              form.raison || null,
      };
      if (editId) await produitsApi.update(editId, payload);
      else        await produitsApi.create(cibleArmoireId, payload);
      setModal(null); refresh();
    } catch (ex: unknown) {
      setErr((ex as Error).message);
    } finally { setBusy(false); }
  };

  const supprimer = async (id: number) => {
    if (!confirm('Supprimer ce produit définitivement ?')) return;
    try { await produitsApi.delete(id); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const zoneActive = zones.find((z) => z.id === zoneId);
  const armoires   = zoneActive?.armoires ?? [];

  if (loading) return (
    <Layout title="Inventaire produits" subtitle={projetActif?.nom}>
      <div className="card mb-12" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 28, width: 90, borderRadius: 4 }} />)}
        </div>
        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 14, width: '30%' }} />
      </div>
      <div className="card">
        <div style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 13, width: '100%', marginBottom: 8 }} />
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <div className="skeleton" style={{ height: 12, flex: 2 }} />
              <div className="skeleton" style={{ height: 12, flex: 1 }} />
              <div className="skeleton" style={{ height: 12, width: 70 }} />
              <div className="skeleton" style={{ height: 12, width: 60 }} />
              <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );

  const nbConformes = produits.filter((p) => p.conformite.statut === 'CONFORME').length;
  const nbEcarts    = produits.filter((p) => p.conformite.statut !== 'CONFORME').length;

  const handleExportPdf = async () => {
    if (!projetActif) return;
    setExportBusy(true);
    try { await exportApi.inventaire(projetActif.id); toast.success('PDF inventaire téléchargé'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setExportBusy(false); }
  };

  return (
    <Layout
      title="Inventaire produits"
      subtitle={projetActif?.nom}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ background: '#16a34a', color: '#fff', border: 'none' }}
            onClick={handleExportPdf}
            disabled={!projetActif || exportBusy}
            title="Télécharger l'inventaire complet en PDF"
          >
            ↓ {exportBusy ? 'Génération…' : 'PDF inventaire'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={ouvrirCreation}
            disabled={!projetActif}
          >
            <IconPlus /> Ajouter un produit
          </button>
        </div>
      }
    >
      {/* ── Filtres ──────────────────────────────────────────────── */}
      <div className="card mb-16" style={{ padding: '16px 20px' }}>
        <div className="filter-bar">
          <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Zone</label>
            <select value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Armoire</label>
            <select value={armoireId ?? ''} onChange={(e) => { setPage(1); setArmoireId(Number(e.target.value)); }}>
              {armoires.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          {pagination && pagination.total > 0 && (
            <div className="flex items-center gap-12" style={{ paddingBottom: 0, paddingTop: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--gray-800)' }}>{pagination.total}</strong> produit{pagination.total > 1 ? 's' : ''} au total
              </span>
              <span className="badge badge-conforme">{nbConformes} conforme{nbConformes !== 1 ? 's' : ''}</span>
              {nbEcarts > 0 && (
                <span className="badge badge-majeur">{nbEcarts} écart{nbEcarts !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tableau produits ─────────────────────────────────────── */}
      <div className="card">
        {produits.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
            <div className="empty-state-title">Aucun produit inventorié</div>
            <div className="empty-state-sub">
              {!armoireId ? 'Sélectionnez une zone et une armoire.' : 'Cliquez sur "Ajouter un produit" pour commencer.'}
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Produit</th>
                  <th>Code</th>
                  <th>Qté présente</th>
                  <th>Péremption</th>
                  <th>FDS</th>
                  <th>Conformité</th>
                  <th style={{ width: 160 }}>Raisons</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {produits.map((p) => (
                  <tr key={p.id}>
                    <td style={{ paddingLeft: 20, fontWeight: 600 }}>{p.nom}</td>
                    <td>
                      {p.codeProduit
                        ? <span style={{ fontFamily: 'monospace', fontSize: 13, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{p.codeProduit}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>{p.quantitePresente != null ? p.quantitePresente : <span className="text-muted">—</span>}</td>
                    <td>
                      {p.datePeremption ? (
                        <span style={{ color: isExpired(p.datePeremption) ? '#C0392B' : 'inherit', fontWeight: isExpired(p.datePeremption) ? 600 : 400 }}>
                          {new Date(p.datePeremption).toLocaleDateString('fr-FR')}
                          {isExpired(p.datePeremption) && <span style={{ fontSize: 11, marginLeft: 4 }}>⚠</span>}
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {p.urlFds
                        ? <a href={p.urlFds} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--blue-700)' }}>Voir FDS ↗</a>
                        : <span style={{ color: '#C0392B', fontSize: 12, fontWeight: 600 }}>⚠ Manquante</span>}
                    </td>
                    <td><ConformiteBadge statut={p.conformite.statut} /></td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {p.conformite.raisons.length > 0
                        ? p.conformite.raisons.join(', ')
                        : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="flex gap-6">
                        <button className="btn-icon" title="Modifier" onClick={() => ouvrirEdition(p)}><IconEdit /></button>
                        <button className="btn-icon" title="Supprimer" onClick={() => supprimer(p.id)} style={{ color: '#C0392B', borderColor: '#fca5a5' }}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, marginBottom: 4 }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Précédent
          </button>
          <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
            Page <strong>{pagination.page}</strong> / {pagination.pages}
            &nbsp;·&nbsp;
            {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {modal === 'create' ? 'Ajouter un produit chimique' : 'Modifier le produit'}
              </div>
              <button className="btn-icon" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-error">{err}</div>}
              <form id="form-produit" onSubmit={soumettre}>
                {modal === 'create' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                    <div className="form-group">
                      <label>Zone <span style={{ color: '#C0392B' }}>*</span></label>
                      <select value={modalZoneId ?? ''} onChange={(e) => {
                        const zid = Number(e.target.value);
                        setModalZoneId(zid);
                        const z = zones.find((z) => z.id === zid);
                        setModalArmoireId(z?.armoires?.[0]?.id ?? null);
                      }}>
                        {zones.length === 0 && <option value="">Aucune zone</option>}
                        {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Armoire <span style={{ color: '#C0392B' }}>*</span></label>
                      <select value={modalArmoireId ?? ''} onChange={(e) => setModalArmoireId(Number(e.target.value))}>
                        {(zones.find((z) => z.id === modalZoneId)?.armoires ?? []).length === 0
                          ? <option value="">Aucune armoire — créer dans Référentiel</option>
                          : (zones.find((z) => z.id === modalZoneId)?.armoires ?? []).map((a) => (
                              <option key={a.id} value={a.id}>{a.nom}</option>
                            ))
                        }
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label>Nom du produit <span style={{ color: '#C0392B' }}>*</span></label>
                  <input type="text" required value={form.nom}
                    onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                    placeholder="Ex : Acétone, HF 40%, …"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  <div className="form-group">
                    <label>Code produit</label>
                    <input type="text" value={form.codeProduit}
                      onChange={(e) => setForm((p) => ({ ...p, codeProduit: e.target.value }))}
                      placeholder="REF-…"
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantité présente</label>
                    <input type="number" step="any" value={form.quantitePresente}
                      onChange={(e) => setForm((p) => ({ ...p, quantitePresente: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantité utilisée</label>
                    <input type="number" step="any" value={form.quantiteUtilisee}
                      onChange={(e) => setForm((p) => ({ ...p, quantiteUtilisee: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Volume max (L)</label>
                    <input type="number" step="any" value={form.volumeMax}
                      onChange={(e) => setForm((p) => ({ ...p, volumeMax: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date de péremption</label>
                    <input type="date" value={form.datePeremption}
                      onChange={(e) => setForm((p) => ({ ...p, datePeremption: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Date vérif. FDS</label>
                    <input type="date" value={form.fdsDateVerification}
                      onChange={(e) => setForm((p) => ({ ...p, fdsDateVerification: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>URL de la FDS</label>
                  <input type="url" value={form.urlFds} placeholder="https://…"
                    onChange={(e) => setForm((p) => ({ ...p, urlFds: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>Raison / Observation</label>
                  <input type="text" value={form.raison}
                    onChange={(e) => setForm((p) => ({ ...p, raison: e.target.value }))}
                    placeholder="Raison de présence, observation particulière…"
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Annuler</button>
              <button type="submit" form="form-produit" className="btn btn-primary" disabled={busy}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
