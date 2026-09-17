import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

export default function Login() {
  const { login, register } = useAuth();
  const navigate            = useNavigate();
  const [mode,  setMode]    = useState<'login' | 'register'>('login');
  const [nom,   setNom]     = useState('');
  const [email, setEmail]   = useState('');
  const [mdp,   setMdp]     = useState('');
  const [err,   setErr]     = useState<string | null>(null);
  const [busy,  setBusy]    = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') await login(email, mdp);
      else                  await register(nom, email, mdp);
      navigate('/');
    } catch (ex: unknown) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Panneau gauche ─────────────────────────────────────────── */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-logo">
            <div className="login-brand-icon"><IconShield /></div>
            <div className="login-brand-name">Suivi SSE ICLB/ICLK</div>
          </div>
          <h1 className="login-headline">
            Pilotez votre<br />conformité QHSE<br />en temps réel
          </h1>
          <p className="login-sub">
            Suivi des produits chimiques et du flux H25 —
            conformité EN&nbsp;14470-1, gestion documentaire FDS,
            auditabilité PRO0239.
          </p>
        </div>

        <div className="login-stats">
          <div className="login-stat">
            <div className="login-stat-value">2</div>
            <div className="login-stat-label">Projets pilotes</div>
          </div>
          <div className="login-stat">
            <div className="login-stat-value">16</div>
            <div className="login-stat-label">Axes de suivi</div>
          </div>
          <div className="login-stat">
            <div className="login-stat-value">74</div>
            <div className="login-stat-label">Sous-actions</div>
          </div>
          <div className="login-stat">
            <div className="login-stat-value">43</div>
            <div className="login-stat-label">Critères audit</div>
          </div>
        </div>
      </div>

      {/* ── Panneau droit – formulaire ──────────────────────────────── */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-form-header">
            <h2 className="login-form-title">
              {mode === 'login' ? 'Connexion' : 'Créer un compte'}
            </h2>
            <p className="login-form-sub">
              {mode === 'login'
                ? 'Accédez à votre espace de pilotage QHSE.'
                : 'Renseignez vos informations pour démarrer.'}
            </p>
          </div>

          {err && (
            <div className="alert alert-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="nom">Nom complet</label>
                <input
                  id="nom" type="text" required autoComplete="name"
                  value={nom} onChange={(e) => setNom(e.target.value)}
                  placeholder="Prénom Nom"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Adresse e-mail</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@safran.fr"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label htmlFor="mdp">
                Mot de passe
                {mode === 'register' && (
                  <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 4 }}>(8 car. min.)</span>
                )}
              </label>
              <input
                id="mdp" type="password" required
                minLength={mode === 'register' ? 8 : 1}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={mdp} onChange={(e) => setMdp(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Chargement…
                </>
              ) : (
                mode === 'login' ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--gray-500)' }}>
            {mode === 'login' ? (
              <>Pas encore de compte ?{' '}
                <button className="login-link" onClick={() => { setMode('register'); setErr(null); }}>
                  Créer un compte
                </button>
              </>
            ) : (
              <>Déjà inscrit ?{' '}
                <button className="login-link" onClick={() => { setMode('login'); setErr(null); }}>
                  Se connecter
                </button>
              </>
            )}
          </p>

          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--gray-400)' }}>
            Suivi SSE ICLB/ICLK (2026–2029) · Accès restreint
          </p>
        </div>
      </div>
    </div>
  );
}
