import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import {
  zonesApi, checklistsApi,
  Zone, TypeChecklist, ResultatCritere, ResultatEnum,
} from '../api/client';
import { ResultatBadge } from '../components/StatusBadge';

const RESULTATS: ResultatEnum[] = ['CONFORME', 'ECART_MINEUR', 'ECART_MAJEUR'];
const LABEL: Record<ResultatEnum, string> = {
  CONFORME:     'Conforme',
  ECART_MINEUR: 'Écart mineur',
  ECART_MAJEUR: 'Écart majeur',
};

export default function Checklists() {
  const { projetActif } = useProject();
  const [zones,          setZones]          = useState<Zone[]>([]);
  const [typeChecklists, setTypeChecklists] = useState<TypeChecklist[]>([]);
  const [zoneId,         setZoneId]         = useState<number | null>(null);
  const [armoireId,      setArmoireId]      = useState<number | null>(null);
  const [typeId,         setTypeId]         = useState<number | null>(null);
  const [resultats,      setResultats]      = useState<ResultatCritere[]>([]);
  const [saving,         setSaving]         = useState<number | null>(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!projetActif) return;
    setLoading(true);
    Promise.all([zonesApi.list(projetActif.id), checklistsApi.listTypes()]).then(([z, tc]) => {
      setZones(z);
      setTypeChecklists(tc);
      if (z[0])  setZoneId(z[0].id);
      if (tc[0]) setTypeId(tc[0].id);
    }).finally(() => setLoading(false));
  }, [projetActif?.id]);

  useEffect(() => {
    const zone = zones.find((z) => z.id === zoneId);
    if (zone?.armoires?.[0]) setArmoireId(zone.armoires[0].id);
    else setArmoireId(null);
  }, [zoneId, zones]);

  useEffect(() => {
    if (!armoireId || !typeId) return;
    checklistsApi.getResultats(armoireId, typeId).then(setResultats);
  }, [armoireId, typeId]);

  const handleResultat = async (critereId: number, resultat: ResultatEnum) => {
    if (!armoireId) return;
    setSaving(critereId);
    try {
      const r = await checklistsApi.upsertResultat(armoireId, critereId, resultat);
      setResultats((prev) => {
        const idx = prev.findIndex((x) => x.critereId === critereId);
        if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
        return [...prev, r];
      });
    } finally { setSaving(null); }
  };

  const zoneActive  = zones.find((z) => z.id === zoneId);
  const armoires    = zoneActive?.armoires ?? [];
  const typeActif   = typeChecklists.find((tc) => tc.id === typeId);
  const criteres    = typeActif?.criteres ?? [];
  const resultatMap = Object.fromEntries(resultats.map((r) => [r.critereId, r.resultat]));

  const conformes = resultats.filter((r) => r.resultat === 'CONFORME').length;
  const mineurs   = resultats.filter((r) => r.resultat === 'ECART_MINEUR').length;
  const majeurs   = resultats.filter((r) => r.resultat === 'ECART_MAJEUR').length;
  const taux      = criteres.length > 0 && resultats.length > 0
    ? ((conformes * 100 + mineurs * 50) / criteres.length).toFixed(1)
    : null;
  const pctRempli = criteres.length > 0 ? Math.round((resultats.length / criteres.length) * 100) : 0;

  if (loading) return (
    <Layout title="Checklists armoires" subtitle={projetActif?.nom}>
      <div className="card mb-12" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 28, width: 120, borderRadius: 4 }} />)}
        </div>
      </div>
      <div className="card">
        <div style={{ padding: 16 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div className="skeleton" style={{ height: 12, flex: 1 }} />
              <div className="skeleton" style={{ height: 28, width: 100, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 28, width: 100, borderRadius: 4 }} />
              <div className="skeleton" style={{ height: 28, width: 100, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout title="Checklists armoires" subtitle={projetActif?.nom}>

      {/* ── Filtres ──────────────────────────────────────────────── */}
      <div className="card mb-16" style={{ padding: '16px 20px' }}>
        <div className="filter-bar">
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label>Zone</label>
            <select value={zoneId ?? ''} onChange={(e) => setZoneId(Number(e.target.value))}>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.nom}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label>Armoire</label>
            <select value={armoireId ?? ''} onChange={(e) => setArmoireId(Number(e.target.value))}>
              {armoires.length > 0
                ? armoires.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)
                : <option value="">Aucune armoire</option>}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: 220, marginBottom: 0 }}>
            <label>Type de checklist</label>
            <select value={typeId ?? ''} onChange={(e) => setTypeId(Number(e.target.value))}>
              {typeChecklists.map((tc) => <option key={tc.id} value={tc.id}>{tc.nom}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI résumé ─────────────────────────────────────────── */}
      {criteres.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <div className={`kpi-card ${taux !== null ? (parseFloat(taux) >= 75 ? 'kpi-success' : parseFloat(taux) >= 40 ? 'kpi-warning' : 'kpi-danger') : ''}`}>
            <div className="kpi-label">Taux conformité</div>
            <div className="kpi-value" style={{ fontSize: 26 }}>
              {taux !== null ? `${taux}` : '—'}<span className="kpi-unit" style={{ fontSize: 14 }}>%</span>
            </div>
            <div className="kpi-sub">{pctRempli}% de critères renseignés</div>
          </div>
          <div className="kpi-card kpi-success">
            <div className="kpi-label">Conformes</div>
            <div className="kpi-value" style={{ fontSize: 26, color: '#2E7D32' }}>{conformes}</div>
            <div className="kpi-sub">sur {criteres.length}</div>
          </div>
          <div className="kpi-card kpi-warning">
            <div className="kpi-label">Écarts mineurs</div>
            <div className="kpi-value" style={{ fontSize: 26, color: '#B7950B' }}>{mineurs}</div>
          </div>
          <div className="kpi-card kpi-danger">
            <div className="kpi-label">Écarts majeurs</div>
            <div className="kpi-value" style={{ fontSize: 26, color: '#C0392B' }}>{majeurs}</div>
          </div>
        </div>
      )}

      {/* ── Grille critères ──────────────────────────────────────── */}
      {criteres.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">Sélectionnez une zone, une armoire et un type de checklist</div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {typeActif?.nom}
              {zoneActive && (
                <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: 8 }}>
                  — {zoneActive.nom} / {armoires.find((a) => a.id === armoireId)?.nom ?? '…'}
                </span>
              )}
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>
              {resultats.length} / {criteres.length} renseignés
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44, paddingLeft: 20 }}>#</th>
                  <th>Critère d'audit</th>
                  <th style={{ width: 130 }}>Résultat</th>
                  <th style={{ width: 190 }}>Saisir le résultat</th>
                  <th style={{ width: 110 }}>Dernière MAJ</th>
                </tr>
              </thead>
              <tbody>
                {criteres.map((crit, idx) => {
                  const res   = resultatMap[crit.id];
                  const ligne = resultats.find((r) => r.critereId === crit.id);
                  const isSaving = saving === crit.id;
                  return (
                    <tr key={crit.id} style={{ background: res === 'ECART_MAJEUR' ? '#fff5f5' : res === 'ECART_MINEUR' ? '#fffdf0' : undefined }}>
                      <td style={{ paddingLeft: 20, color: 'var(--gray-400)', fontWeight: 600, fontSize: 13 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{crit.libelle}</td>
                      <td>
                        {res
                          ? <ResultatBadge resultat={res} />
                          : <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>Non renseigné</span>}
                      </td>
                      <td>
                        {isSaving ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-400)' }}>
                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            Enregistrement…
                          </span>
                        ) : (
                          <select
                            value={res ?? ''}
                            disabled={isSaving}
                            onChange={(e) => e.target.value && handleResultat(crit.id, e.target.value as ResultatEnum)}
                            style={{ height: 30, fontSize: 13, padding: '0 28px 0 8px', width: '100%' }}
                          >
                            <option value="">— Choisir —</option>
                            {RESULTATS.map((r) => (
                              <option key={r} value={r}>{LABEL[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>
                        {ligne ? new Date(ligne.dateDerniereMaj).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
