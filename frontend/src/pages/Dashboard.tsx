import { useEffect, useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell, Legend, PieChart, Pie,
} from 'recharts';
import Layout from '../components/Layout';
import { useProject } from '../contexts/ProjectContext';
import { dashboardApi, exportApi, DashboardData, HistoriqueScore, AlertesData } from '../api/client';
import { ScorePill, ProgressBar } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const TooltipStyle = {
  contentStyle: {
    background: '#fff',
    border: '1px solid #e2e5ea',
    borderRadius: 6,
    fontSize: 13,
    boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
  },
  labelStyle: { color: '#374151', fontWeight: 600 },
};

export default function Dashboard() {
  const { projetActif } = useProject();
  const toast = useToast();
  const [data,         setData]         = useState<DashboardData | null>(null);
  const [historique,   setHistorique]   = useState<HistoriqueScore[]>([]);
  const [alertes,      setAlertes]      = useState<AlertesData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [rapportBusy,  setRapportBusy]  = useState(false);

  const handleRapport = async () => {
    if (!projetActif) return;
    setRapportBusy(true);
    try { await exportApi.rapport(projetActif.id); toast.success('Rapport PDF téléchargé'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setRapportBusy(false); }
  };

  const load = async () => {
    if (!projetActif) return;
    setLoading(true);
    setData(null); setHistorique([]); setAlertes(null);
    try {
      const [d, h, a] = await Promise.all([
        dashboardApi.get(projetActif.id),
        dashboardApi.historique(projetActif.id),
        dashboardApi.alertes(projetActif.id),
      ]);
      setData(d); setHistorique(h); setAlertes(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projetActif?.id]);

  if (loading && !data) return (
    <Layout title="Suivi des Missions SSE sur les produits chimiques" subtitle={projetActif?.nom ?? ''}>
      <div className="kpi-grid mb-20">
        {[...Array(8)].map((_, i) => <div key={i} className="kpi-card skeleton-card"><div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 12 }} /><div className="skeleton" style={{ height: 36, width: '50%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 12, width: '80%' }} /></div>)}
      </div>
      <div className="charts-grid mb-16">
        <div className="card"><div className="card-body"><div className="skeleton" style={{ height: 270 }} /></div></div>
        <div className="card"><div className="card-body"><div className="skeleton" style={{ height: 270 }} /></div></div>
      </div>
    </Layout>
  );
  if (!data) return (
    <Layout title="Suivi des Missions SSE sur les produits chimiques">
      <div className="empty-state"><div className="empty-state-title">Aucun projet sélectionné</div></div>
    </Layout>
  );

  const scoreGlobal   = data.scoreGlobal;
  const nbAlertes     = alertes?.total ?? 0;
  const hasData       = data.statuts.nbTotal > 0;

  const radarData = data.scoresAxes.map((ax) => ({ axe: ax.code, score: ax.score, fullMark: 100 }));

  const statuts = [
    { name: 'Réalisé',     value: data.statuts.nbRealise,    fill: '#2E7D32' },
    { name: 'En cours',    value: data.statuts.nbEnCours,    fill: '#B7950B' },
    { name: 'Non démarré', value: data.statuts.nbNonDemarre, fill: '#D1D5DB' },
  ];
  const ecarts = [
    { name: 'Conforme',      value: data.repartitionEcarts.conforme, fill: '#2E7D32' },
    { name: 'Écart mineur',  value: data.repartitionEcarts.mineur,   fill: '#B7950B' },
    { name: 'Écart majeur',  value: data.repartitionEcarts.majeur,   fill: '#C0392B' },
  ].filter((e) => e.value > 0);

  const trendData = historique
    .filter((h) => !h.axeId)
    .map((h) => ({ date: fmtDate(h.date), score: h.score }));

  const pctRealise = hasData
    ? Math.round((data.statuts.nbRealise / data.statuts.nbTotal) * 100)
    : 0;

  return (
    <Layout
      title="Suivi des Missions SSE sur les produits chimiques"
      subtitle={projetActif?.nom ?? ''}
      actions={
        <button
          className="btn btn-primary btn-sm"
          onClick={handleRapport}
          disabled={!projetActif || rapportBusy}
          title="Télécharger le rapport complet en PDF"
        >
          ↓ {rapportBusy ? 'Génération…' : 'Rapport PDF'}
        </button>
      }
    >

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="kpi-grid mb-20">

        <div className={`kpi-card ${scoreGlobal >= 75 ? 'kpi-success' : scoreGlobal >= 40 ? 'kpi-warning' : 'kpi-danger'}`}>
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-6"/></svg>
          </div>
          <div className="kpi-label">Avancement global</div>
          <div className="kpi-value">{scoreGlobal.toFixed(1)}<span className="kpi-unit">%</span></div>
          <div className="kpi-sub">
            <ProgressBar value={scoreGlobal} height={5} />
            <span style={{ marginTop: 5, display: 'block' }}>Score pondéré par axe</span>
          </div>
        </div>

        <div className={`kpi-card ${pctRealise >= 75 ? 'kpi-success' : pctRealise >= 30 ? 'kpi-warning' : ''}`}>
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
          </div>
          <div className="kpi-label">Actions réalisées</div>
          <div className="kpi-value">{data.statuts.nbRealise}<span className="kpi-unit">/{data.statuts.nbTotal}</span></div>
          <div className="kpi-sub">
            <ProgressBar value={pctRealise} height={5} />
            <span style={{ marginTop: 5, display: 'block' }}>{data.statuts.nbEnCours} en cours · {data.statuts.nbNonDemarre} à démarrer</span>
          </div>
        </div>

        <div className={`kpi-card ${nbAlertes > 0 ? 'kpi-danger' : 'kpi-success'}`}>
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <div className="kpi-label">Alertes retard</div>
          <div className="kpi-value">{nbAlertes}</div>
          <div className="kpi-sub">Seuil : {alertes?.seuil ?? 3} semaines de retard</div>
        </div>

        <div className={`kpi-card ${data.nbFdsAJour > 0 ? 'kpi-success' : ''}`}>
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div className="kpi-label">FDS à jour</div>
          <div className="kpi-value">{data.nbFdsAJour}</div>
          <div className="kpi-sub">{data.nbFdsObsoletes} obsolètes · {data.nbFdsManquantes} manquantes</div>
        </div>

        <div className={`kpi-card ${data.couverture.armoiresAuditees === data.couverture.totalArmoires && data.couverture.totalArmoires > 0 ? 'kpi-success' : data.couverture.armoiresAuditees > 0 ? 'kpi-warning' : ''}`}>
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 17h7m-3.5-3.5v7"/></svg>
          </div>
          <div className="kpi-label">Armoires auditées</div>
          <div className="kpi-value">{data.couverture.armoiresAuditees}<span className="kpi-unit">/{data.couverture.totalArmoires}</span></div>
          <div className="kpi-sub">
            {data.couverture.totalArmoires > 0
              ? `${Math.round((data.couverture.armoiresAuditees / data.couverture.totalArmoires) * 100)}% de couverture`
              : 'Aucune armoire'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
          </div>
          <div className="kpi-label">Produits inventoriés</div>
          <div className="kpi-value">{data.couverture.totalProduits}</div>
          <div className="kpi-sub">Dans toutes les armoires</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
          </div>
          <div className="kpi-label">Quantité présente</div>
          <div className="kpi-value">{data.totalQuantitePresente}</div>
          <div className="kpi-sub">unités en stock (toutes armoires)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div className="kpi-label">Quantité utilisée</div>
          <div className="kpi-value">{data.totalQuantiteUtilisee}</div>
          <div className="kpi-sub">unités consommées (toutes armoires)</div>
        </div>

        {data.statsExpiration && data.couverture.totalProduits > 0 && (<>
          <div className={`kpi-card ${data.statsExpiration.pctExpires > 20 ? 'kpi-danger' : data.statsExpiration.pctExpires > 5 ? 'kpi-warning' : 'kpi-success'}`}>
            <div className="kpi-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div className="kpi-label">Produits expirés</div>
            <div className="kpi-value">{data.statsExpiration.pctExpires}<span className="kpi-unit">%</span></div>
            <div className="kpi-sub">{data.statsExpiration.nbExpires} produit{data.statsExpiration.nbExpires > 1 ? 's' : ''} périmé{data.statsExpiration.nbExpires > 1 ? 's' : ''}</div>
          </div>

          <div className={`kpi-card ${data.statsExpiration.pctExpiresProchains > 20 ? 'kpi-warning' : ''}`}>
            <div className="kpi-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <div className="kpi-label">Expirent &lt; 6 mois</div>
            <div className="kpi-value">{data.statsExpiration.pctExpiresProchains}<span className="kpi-unit">%</span></div>
            <div className="kpi-sub">{data.statsExpiration.nbExpiresProchains} produit{data.statsExpiration.nbExpiresProchains > 1 ? 's' : ''} à surveiller</div>
          </div>

          <div className={`kpi-card ${data.statsExpiration.pctSansCode > 10 ? 'kpi-warning' : data.statsExpiration.pctSansCode === 0 ? 'kpi-success' : ''}`}>
            <div className="kpi-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
            </div>
            <div className="kpi-label">Produits sans code</div>
            <div className="kpi-value">{data.statsExpiration.pctSansCode}<span className="kpi-unit">%</span></div>
            <div className="kpi-sub">{data.statsExpiration.nbSansCode} produit{data.statsExpiration.nbSansCode > 1 ? 's' : ''} non codifié{data.statsExpiration.nbSansCode > 1 ? 's' : ''}</div>
          </div>
        </>)}

      </div>

      {/* ── Ligne 1 : Radar + Tendance ─────────────────────────────── */}
      <div className="charts-grid mb-16">

        <div className="card">
          <div className="card-header">
            <span className="card-title">Score par axe</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={270}>
              <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <PolarGrid stroke="#e2e5ea" />
                <PolarAngleAxis dataKey="axe" tick={{ fontSize: 12, fill: '#4B5563', fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <Radar
                  name="Score" dataKey="score"
                  stroke="#0055A4" fill="#0055A4" fillOpacity={0.18}
                  strokeWidth={2} dot={{ fill: '#0055A4', r: 3 }}
                />
                <Tooltip
                  {...TooltipStyle}
                  formatter={(v: number) => [`${v.toFixed(1)} %`, 'Score']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Tendance globale</span>
          </div>
          <div className="card-body">
            {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height={270}>
                <LineChart data={trendData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip {...TooltipStyle} formatter={(v: number) => [`${v.toFixed(1)} %`, 'Avancement']} />
                  <Line
                    type="monotone" dataKey="score"
                    stroke="#0055A4" strokeWidth={2.5}
                    dot={{ fill: '#0055A4', r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-title">Pas assez de données</div>
                <div className="empty-state-sub">L'historique s'affiche après plusieurs sessions.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ligne 2 : Statuts + Conformité produits ──────────────── */}
      <div className="charts-grid mb-16">

        <div className="card">
          <div className="card-header">
            <span className="card-title">Répartition des statuts</span>
            <span className="chip">{data.statuts.nbTotal} actions</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={statuts} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} formatter={(v: number) => [v, 'Actions']} />
                <Bar dataKey="value" name="Actions" radius={[5, 5, 0, 0]} maxBarSize={60}>
                  {statuts.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Conformité produits</span>
          </div>
          <div className="card-body">
            {ecarts.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-title">Aucun produit inventorié</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={ecarts} dataKey="value" nameKey="name"
                    cx="45%" cy="50%" innerRadius={52} outerRadius={84}
                    paddingAngle={3}
                  >
                    {ecarts.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...TooltipStyle} formatter={(v: number) => [v, 'Produits']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Tableau détail scores axes ─────────────────────────────── */}
      <div className="card mb-16">
        <div className="card-header">
          <span className="card-title">Détail des scores par axe</span>
          <ScorePill score={scoreGlobal} />
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 72 }}>Code</th>
                <th>Intitulé de l'axe</th>
                <th style={{ width: 100 }}>Pondération</th>
                <th style={{ width: 100 }}>Score</th>
                <th style={{ width: 180 }}>Progression</th>
              </tr>
            </thead>
            <tbody>
              {data.scoresAxes.map((ax) => (
                <tr key={ax.id}>
                  <td><span className="axe-code-chip">{ax.code}</span></td>
                  <td style={{ fontWeight: 500 }}>{ax.intitule}</td>
                  <td>{ax.ponderation}&nbsp;%</td>
                  <td><ScorePill score={ax.score} /></td>
                  <td style={{ paddingRight: 24 }}>
                    <ProgressBar value={ax.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Conformité par zone ───────────────────────────────────── */}
      {data.conformiteZones.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <span className="card-title">Conformité par zone</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Taux de conformité</th>
                  <th>Armoires totales</th>
                  <th>Armoires auditées</th>
                </tr>
              </thead>
              <tbody>
                {data.conformiteZones.map((z) => (
                  <tr key={z.id}>
                    <td style={{ fontWeight: 600 }}>{z.nom}</td>
                    <td>
                      {z.tauxConformite !== null
                        ? <ScorePill score={z.tauxConformite} />
                        : <span className="text-muted">Non audité</span>}
                    </td>
                    <td>{z.nbArmoires}</td>
                    <td>{z.armoiresAuditees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alertes ───────────────────────────────────────────────── */}
      {alertes && alertes.total > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Alertes retard</span>
            <span className="badge badge-majeur">{alertes.total} alerte{alertes.total > 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Type</th>
                  <th>Libellé</th>
                  <th>Contexte</th>
                  <th style={{ width: 90 }}>Retard</th>
                </tr>
              </thead>
              <tbody>
                {alertes.alertes.slice(0, 20).map((a, i) => (
                  <tr key={i}>
                    <td>
                      <span className="badge badge-non-demarre" style={{ textTransform: 'capitalize', fontSize: 11 }}>
                        {a.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{a.libelle}</td>
                    <td style={{ color: 'var(--gray-600)' }}>{a.contexte}</td>
                    <td><span className="badge badge-majeur">{a.retardJ}&nbsp;j</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
