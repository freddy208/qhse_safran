const BASE = '/api';

// ── Cache mémoire SWR (stale-while-revalidate) ────────────────────────────
// Les GET sont mis en cache 45 s. Les mutations vident le cache.
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 300_000; // 5 minutes

function cacheGet<T>(path: string): T | undefined {
  const hit = _cache.get(path);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data as T;
  return undefined;
}

function cacheSet(path: string, data: unknown) {
  _cache.set(path, { data, ts: Date.now() });
}

// Invalide les entrées dont la clé contient le préfixe (ex: '/projets/3/')
export function invalidateCache(prefix?: string) {
  if (!prefix) { _cache.clear(); return; }
  for (const key of _cache.keys()) {
    if (key.includes(prefix)) _cache.delete(key);
  }
}

function getToken(): string | null {
  return localStorage.getItem('qhse_token');
}

function headers(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // Retourner le cache immédiatement pour les GET valides
  if (method === 'GET') {
    const cached = cacheGet<T>(path);
    if (cached !== undefined) return cached;
  } else {
    // Toute mutation invalide le cache du projet concerné
    invalidateCache();
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-logout sur 401 (token expiré ou révoqué)
  if (res.status === 401) {
    localStorage.removeItem('qhse_token');
    window.dispatchEvent(new CustomEvent('qhse:session-expired'));
    throw new Error('Session expirée, veuillez vous reconnecter.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

  if (method === 'GET') cacheSet(path, data);
  return data as T;
}

// Téléchargement authentifié (pour CSV et JSON)
async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (res.status === 401) {
    localStorage.removeItem('qhse_token');
    window.dispatchEvent(new CustomEvent('qhse:session-expired'));
    throw new Error('Session expirée');
  }
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE',  path),
};

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, motDePasse: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { email, motDePasse }),
  register: (nom: string, email: string, motDePasse: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { nom, email, motDePasse }),
  me:       () => api.get<User>('/auth/me'),
};

// ── Projets ───────────────────────────────────────────────────────────────
export const projetsApi = {
  list:  () => api.get<Projet[]>('/projets'),
  get:   (id: number) => api.get<ProjetDetail>(`/projets/${id}`),
};

// ── Axes & Sous-actions ───────────────────────────────────────────────────
export const axesApi = {
  list:   (projetId: number) => api.get<Axe[]>(`/projets/${projetId}/axes`),
  create: (projetId: number, data: Partial<Axe>) => api.post<Axe>(`/projets/${projetId}/axes`, data),
  update: (id: number, data: Partial<Axe>) => api.put<Axe>(`/axes/${id}`, data),
  delete: (id: number) => api.delete<void>(`/axes/${id}`),
};

export const sousActionsApi = {
  list:         (axeId: number) => api.get<SousAction[]>(`/axes/${axeId}/sous-actions`),
  create:       (axeId: number, data: Partial<SousAction>) => api.post<SousAction>(`/axes/${axeId}/sous-actions`, data),
  update:       (id: number, data: Partial<SousAction>) => api.put<SousAction>(`/sous-actions/${id}`, data),
  patchStatut:  (id: number, statut: StatutAction) => api.patch<SousAction>(`/sous-actions/${id}/statut`, { statut }),
  delete:       (id: number) => api.delete<void>(`/sous-actions/${id}`),
};

// ── Zones & Armoires & Produits ───────────────────────────────────────────
export const zonesApi = {
  list:   (projetId: number) => api.get<Zone[]>(`/projets/${projetId}/zones`),
  create: (projetId: number, nom: string) => api.post<Zone>(`/projets/${projetId}/zones`, { nom }),
  update: (id: number, nom: string) => api.put<Zone>(`/zones/${id}`, { nom }),
  delete: (id: number) => api.delete<void>(`/zones/${id}`),
};

export const armoiresApi = {
  list:   (zoneId: number) => api.get<Armoire[]>(`/zones/${zoneId}/armoires`),
  create: (zoneId: number, nom: string) => api.post<Armoire>(`/zones/${zoneId}/armoires`, { nom }),
  update: (id: number, nom: string) => api.put<Armoire>(`/armoires/${id}`, { nom }),
  delete: (id: number) => api.delete<void>(`/armoires/${id}`),
};

export interface ProduitPage {
  data:  ProduitAvecConformite[];
  total: number;
  page:  number;
  pages: number;
  limit: number;
}

const PRODUITS_LIMIT = 50;

export const produitsApi = {
  list:   (armoireId: number, page = 1) =>
    api.get<ProduitPage>(`/armoires/${armoireId}/produits?page=${page}&limit=${PRODUITS_LIMIT}`),
  create: (armoireId: number, data: Partial<Produit>) => api.post<ProduitAvecConformite>(`/armoires/${armoireId}/produits`, data),
  update: (id: number, data: Partial<Produit>) => api.put<ProduitAvecConformite>(`/produits/${id}`, data),
  delete: (id: number) => api.delete<void>(`/produits/${id}`),
};

// ── Checklists ────────────────────────────────────────────────────────────
export const checklistsApi = {
  listTypes:       () => api.get<TypeChecklist[]>('/type-checklists'),
  createType:      (nom: string) => api.post<TypeChecklist>('/type-checklists', { nom }),
  updateType:      (id: number, nom: string) => api.put<TypeChecklist>(`/type-checklists/${id}`, { nom }),
  deleteType:      (id: number) => api.delete<void>(`/type-checklists/${id}`),
  createCritere:   (typeChecklistId: number, libelle: string, ordre: number) =>
    api.post<Critere>(`/type-checklists/${typeChecklistId}/criteres`, { libelle, ordre }),
  updateCritere:   (id: number, data: { libelle?: string; ordre?: number }) => api.put<Critere>(`/criteres/${id}`, data),
  deleteCritere:   (id: number) => api.delete<void>(`/criteres/${id}`),
  getResultats:    (armoireId: number, typeChecklistId?: number) =>
    api.get<ResultatCritere[]>(`/armoires/${armoireId}/resultats${typeChecklistId ? `?typeChecklistId=${typeChecklistId}` : ''}`),
  upsertResultat:  (armoireId: number, critereId: number, resultat: ResultatEnum) =>
    api.post<ResultatCritere>(`/armoires/${armoireId}/resultats`, { critereId, resultat }),
};

// ── Exigences ─────────────────────────────────────────────────────────────
export const exigencesApi = {
  list:         (projetId: number) => api.get<ExigenceAudit[]>(`/projets/${projetId}/exigences`),
  create:       (projetId: number, data: Partial<ExigenceAudit>) => api.post<ExigenceAudit>(`/projets/${projetId}/exigences`, data),
  update:       (id: number, data: Partial<ExigenceAudit>) => api.put<ExigenceAudit>(`/exigences/${id}`, data),
  delete:       (id: number) => api.delete<void>(`/exigences/${id}`),
  createAction: (exigenceId: number, data: { libelle: string; responsable?: string | null; echeance?: string | null }) =>
    api.post<ActionCorrective>(`/exigences/${exigenceId}/actions`, data),
};

// ── Actions correctives ───────────────────────────────────────────────────
export const actionsApi = {
  list:        (projetId: number) => api.get<ActionCorrective[]>(`/projets/${projetId}/actions`),
  create:      (projetId: number, data: Partial<ActionCorrective>) => api.post<ActionCorrective>(`/projets/${projetId}/actions`, data),
  update:      (id: number, data: Partial<ActionCorrective>) => api.put<ActionCorrective>(`/actions/${id}`, data),
  patchStatut: (id: number, statut: StatutAction) => api.patch<ActionCorrective>(`/actions/${id}/statut`, { statut }),
  delete:      (id: number) => api.delete<void>(`/actions/${id}`),
};

// ── Alertes manuelles ─────────────────────────────────────────────────────
export const alertesManuellesApi = {
  list:        (projetId: number) => api.get<AlerteManuelle[]>(`/projets/${projetId}/alertes-manuelles`),
  create:      (projetId: number, data: { titre: string; description?: string; priorite: PrioriteAlerte }) =>
    api.post<AlerteManuelle>(`/projets/${projetId}/alertes-manuelles`, data),
  update:      (id: number, data: Partial<AlerteManuelle>) => api.put<AlerteManuelle>(`/alertes-manuelles/${id}`, data),
  patchStatut: (id: number, statut: StatutAlerte) => api.patch<AlerteManuelle>(`/alertes-manuelles/${id}/statut`, { statut }),
  delete:      (id: number) => api.delete<void>(`/alertes-manuelles/${id}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  get:        (projetId: number) => api.get<DashboardData>(`/projets/${projetId}/dashboard`),
  historique: (projetId: number) => api.get<HistoriqueScore[]>(`/projets/${projetId}/historique`),
  alertes:    (projetId: number) => api.get<AlertesData>(`/projets/${projetId}/alertes`),
};

// ── Export ────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
export const exportApi = {
  inventaire: (projetId: number) => downloadFile(`/projets/${projetId}/export/inventaire.pdf`, `inventaire-${today()}.pdf`),
  rapport:    (projetId: number) => downloadFile(`/projets/${projetId}/export/rapport.pdf`,    `rapport-qhse-${today()}.pdf`),
};

// ── Commentaires ──────────────────────────────────────────────────────────
export const commentairesApi = {
  list:   (params: { zoneId?: number; axeId?: number }) => {
    const qs = new URLSearchParams();
    if (params.zoneId) qs.set('zoneId', String(params.zoneId));
    if (params.axeId)  qs.set('axeId',  String(params.axeId));
    return api.get<Commentaire[]>(`/commentaires?${qs}`);
  },
  create: (data: { texte: string; zoneId?: number; axeId?: number }) =>
    api.post<Commentaire>('/commentaires', data),
  delete: (id: number) => api.delete<void>(`/commentaires/${id}`),
};

// ── Types ─────────────────────────────────────────────────────────────────
export type StatutAction    = 'NON_DEMARRE' | 'EN_COURS' | 'REALISE';
export type ResultatEnum    = 'CONFORME' | 'ECART_MINEUR' | 'ECART_MAJEUR';
export type ConformiteAudit = 'OUI' | 'NON';
export type PrioriteAlerte  = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
export type StatutAlerte    = 'OUVERTE' | 'EN_COURS' | 'RESOLUE';

export interface User { id: number; nom: string; email: string; role: string; dateCreation?: string; }
export interface Projet { id: number; nom: string; description?: string; scoreGlobal: number; nbAxes: number; }
export interface ProjetDetail extends Projet { axes: Axe[]; }
export interface Axe { id: number; projetId: number; code: string; intitule: string; ponderation: number; score: number; sousActions: SousAction[]; }
export interface SousAction { id: number; axeId: number; libelle: string; ponderationDansAxe: number; statut: StatutAction; responsable?: string | null; echeance?: string | null; dateDerniereMaj: string; }
export interface Zone { id: number; projetId: number; nom: string; armoires: Armoire[]; }
export interface Armoire { id: number; zoneId: number; nom: string; tauxConformite?: number | null; nbProduits?: number; }
export interface TypeChecklist { id: number; nom: string; criteres: Critere[]; }
export interface Critere { id: number; typeChecklistId: number; libelle: string; ordre: number; }
export interface ResultatCritere { id: number; armoireId: number; critereId: number; resultat: ResultatEnum; dateDerniereMaj: string; critere?: Critere & { typeChecklist: TypeChecklist }; }
export interface Produit { id: number; armoireId: number; nom: string; codeProduit?: string | null; quantitePresente?: number | null; quantiteUtilisee?: number | null; volumeMax?: number | null; datePeremption?: string | null; urlFds?: string | null; fdsDateVerification?: string | null; raison?: string | null; dateDerniereMaj: string; }
export interface ConformiteProduit { statut: 'CONFORME' | 'ECART_MINEUR' | 'ECART_MAJEUR'; raisons: string[]; }
export interface ProduitAvecConformite extends Produit { conformite: ConformiteProduit; }
export interface ExigenceAudit { id: number; projetId: number; domaine: string; exigence: string; questionControle?: string | null; conformite?: ConformiteAudit | null; preuves?: string | null; actionAMener?: string | null; responsable?: string | null; dateAudit?: string | null; dateDerniereMaj: string; actions?: ActionLinked[]; }
export interface ActionLinked { id: number; libelle: string; statut: StatutAction; responsable?: string | null; echeance?: string | null; dateDerniereMaj: string; }
export interface ActionCorrective { id: number; projetId: number; exigenceId?: number | null; libelle: string; ponderation: number; statut: StatutAction; responsable?: string | null; echeance?: string | null; estGenerique: boolean; dateDerniereMaj: string; }
export interface Commentaire { id: number; texte: string; zoneId?: number | null; axeId?: number | null; auteurId: number; date: string; auteur: { id: number; nom: string }; }
export interface AlerteManuelle { id: number; projetId: number; titre: string; description?: string | null; priorite: PrioriteAlerte; statut: StatutAlerte; dateCreation: string; dateMaj: string; }
export interface HistoriqueScore { id: number; projetId: number; axeId?: number | null; score: number; date: string; }

export interface DashboardData {
  scoreGlobal: number;
  scoresAxes:  { id: number; code: string; intitule: string; ponderation: number; score: number }[];
  statuts:     { nbTotal: number; nbRealise: number; nbEnCours: number; nbNonDemarre: number };
  conformiteZones: { id: number; nom: string; tauxConformite: number | null; nbArmoires: number; armoiresAuditees: number }[];
  nbFdsManquantes: number;
  nbFdsObsoletes:  number;
  repartitionEcarts: { majeur: number; mineur: number; conforme: number };
  statsExpiration: {
    nbExpires: number; nbExpiresProchains: number; nbSansCode: number;
    pctExpires: number; pctExpiresProchains: number; pctSansCode: number;
  };
  couverture:      { totalArmoires: number; armoiresAuditees: number; totalProduits: number };
  ancienneteParAxe: { axeId: number; code: string; ancienneteMoyJ: number }[];
}
export interface AlertesData {
  total:   number;
  seuil:   number;
  alertes: { type: string; id: number; libelle: string; contexte: string; dateMaj: string; retardJ: number }[];
}
