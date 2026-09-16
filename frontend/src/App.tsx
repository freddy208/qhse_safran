import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Axes        from './pages/Axes';
import Checklists  from './pages/Checklists';
import Inventaire  from './pages/Inventaire';
import Actions     from './pages/Actions';
import Exigences   from './pages/Exigences';
import Referentiel from './pages/Referentiel';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ paddingTop: '40vh', textAlign: 'center' }}>Chargement…</div>;
  if (!user)   return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/axes"        element={<RequireAuth><Axes /></RequireAuth>} />
      <Route path="/checklists"  element={<RequireAuth><Checklists /></RequireAuth>} />
      <Route path="/inventaire"  element={<RequireAuth><Inventaire /></RequireAuth>} />
      <Route path="/actions"     element={<RequireAuth><Actions /></RequireAuth>} />
      <Route path="/exigences"   element={<RequireAuth><Exigences /></RequireAuth>} />
      <Route path="/referentiel" element={<RequireAuth><Referentiel /></RequireAuth>} />
      <Route path="*"            element={<Navigate to="/" replace />} />
    </Routes>
  );
}
