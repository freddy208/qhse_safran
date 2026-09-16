import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { projetsApi, Projet } from '../api/client';
import { useAuth } from './AuthContext';

interface ProjectContextValue {
  projets:        Projet[];
  projetActif:    Projet | null;
  setProjetActif: (p: Projet) => void;
  refreshProjets: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user }                      = useAuth();
  const [projets,     setProjets]     = useState<Projet[]>([]);
  const [projetActif, setProjetActif] = useState<Projet | null>(null);

  const refreshProjets = async () => {
    try {
      const list = await projetsApi.list();
      setProjets(list);
      setProjetActif((prev) => {
        if (prev) return list.find((p) => p.id === prev.id) ?? list[0] ?? null;
        const stored = localStorage.getItem('qhse_projet_actif');
        if (stored) {
          const found = list.find((p) => p.id === parseInt(stored, 10));
          if (found) return found;
        }
        return list[0] ?? null;
      });
    } catch { /* ignore si non connecté */ }
  };

  useEffect(() => {
    if (user) refreshProjets();
  }, [user]);

  const handleSetProjetActif = (p: Projet) => {
    localStorage.setItem('qhse_projet_actif', String(p.id));
    setProjetActif(p);
  };

  return (
    <ProjectContext.Provider value={{ projets, projetActif, setProjetActif: handleSetProjetActif, refreshProjets }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be inside ProjectProvider');
  return ctx;
}
