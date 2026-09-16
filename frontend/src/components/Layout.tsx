import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth }    from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { axesApi, zonesApi, actionsApi, exigencesApi, checklistsApi } from '../api/client';

/* ── SVG Icons ──────────────────────────────────────────────────────────── */
const IconDashboard = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconAxes = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const IconChecklists = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <path d="M9 12h6M9 16h4"/>
  </svg>
);
const IconInventaire = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
  </svg>
);
const IconActions = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
    <path d="M17.66 7.76a6 6 0 010 8.49M6.34 7.76a6 6 0 000 8.49"/>
  </svg>
);
const IconExigences = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <path d="M14 2v6h6M12 18v-6M9 15h6"/>
  </svg>
);
const IconReferentiel = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconQhse = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

const NAV: { to: string; label: string; Icon: () => JSX.Element; prefetch?: (id: number) => void }[] = [
  { to: '/',            label: 'Tableau de bord',    Icon: IconDashboard,  prefetch: (id) => { axesApi.list(id); zonesApi.list(id); actionsApi.list(id); } },
  { to: '/axes',        label: 'Suivi des axes',     Icon: IconAxes,       prefetch: (id) => { axesApi.list(id); } },
  { to: '/checklists',  label: 'Checklists',         Icon: IconChecklists, prefetch: (id) => { zonesApi.list(id); checklistsApi.listTypes(); } },
  { to: '/inventaire',  label: 'Inventaire',         Icon: IconInventaire, prefetch: (id) => { zonesApi.list(id); } },
  { to: '/actions',     label: 'Actions correctives',Icon: IconActions,    prefetch: (id) => { actionsApi.list(id); } },
  { to: '/exigences',   label: 'Audit PRO0239',      Icon: IconExigences,  prefetch: (id) => { exigencesApi.list(id); } },
  { to: '/referentiel', label: 'Référentiel',        Icon: IconReferentiel,prefetch: (id) => { axesApi.list(id); zonesApi.list(id); } },
];

interface LayoutProps {
  children:  ReactNode;
  title:     string;
  subtitle?: string;
  actions?:  ReactNode;
}

function initiales(nom: string): string {
  return nom.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function Layout({ children, title, subtitle, actions }: LayoutProps) {
  const { user, logout }                        = useAuth();
  const { projets, projetActif, setProjetActif } = useProject();
  const navigate                                 = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-layout">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">
            <div className="sidebar-brand-icon"><IconQhse /></div>
            <div>
              <div className="sidebar-brand-name">QHSE Safran</div>
              <div className="sidebar-brand-sub">Gestion pilote · v1.0</div>
            </div>
          </div>
        </div>

        {/* Sélecteur de projet */}
        <div className="sidebar-project">
          <label>Projet actif</label>
          <select
            value={projetActif?.id ?? ''}
            onChange={(e) => {
              const p = projets.find((x) => x.id === parseInt(e.target.value, 10));
              if (p) setProjetActif(p);
            }}
          >
            {projets.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">Menu principal</div>
          {NAV.map(({ to, label, Icon, prefetch }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onMouseEnter={() => { if (prefetch && projetActif) prefetch(projetActif.id); }}
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initiales(user?.nom ?? 'U')}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.nom}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <button className="sidebar-logout" onClick={handleLogout} title="Déconnexion">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ──────────────────────────────────────── */}
      <div className="main-content">
        <header className="page-topbar">
          <div className="page-topbar-left">
            <div className="page-heading">{title}</div>
            {subtitle && <div className="page-subheading">{subtitle}</div>}
          </div>
          {actions && (
            <div className="page-topbar-right">{actions}</div>
          )}
        </header>
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
