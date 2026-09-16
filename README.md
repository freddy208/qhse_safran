# Dashboard QHSE Safran

Application de pilotage QHSE pour le suivi des plans d'action **Produits Chimiques** et **Flux H25**.

Stack : Node.js/Express + Prisma · React/Vite + Recharts · PostgreSQL (Neon en pilote) · Docker Compose · Caddy (HTTPS automatique)

---

## 1. Prérequis

| Outil | Version minimum |
|---|---|
| Docker | 24+ |
| Docker Compose | v2+ (plugin intégré) |
| Node.js (dev local uniquement) | 20 LTS |

---

## 2. Configuration

### 2.1 Créer le fichier `.env`

```bash
cp .env.example .env
```

Renseigner impérativement :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string Neon (format `postgresql://…?sslmode=require`) |
| `JWT_SECRET` | Chaîne aléatoire ≥ 48 caractères — générer avec `openssl rand -base64 48` |
| `FRONTEND_ORIGIN` | URL publique du frontend (ex. `https://qhse.exemple.fr`) |

### 2.2 Obtenir la connexion Neon (base pilote gratuite, sans CB, sans expiration)

1. Créer un compte sur [neon.tech](https://neon.tech)
2. Créer un projet → copier la **Connection string** (onglet *Connection Details*)
3. Coller dans `DATABASE_URL` dans `.env`

---

## 3. Démarrage

### Phase pilote (Neon + HTTPS Caddy)

```bash
# 1. Éditer Caddyfile : remplacer "votre-domaine.exemple.fr" par votre vrai domaine
nano Caddyfile

# 2. Lancer
docker compose up -d --build

# 3. Appliquer les migrations et injecter les données de référence
docker compose exec backend sh -c "npx prisma migrate deploy && npm run seed"
```

L'application est disponible sur `https://votre-domaine.exemple.fr`.

> **Note Render/Fly.io** : si vous déployez sur une plateforme PaaS au lieu d'un VPS,
> vous n'avez pas besoin du service `proxy` — la plateforme gère le HTTPS.
> Utilisez simplement `docker-compose.local.yml` comme base de référence pour les variables.

### Développement local (HTTP, port 3000)

```bash
docker compose -f docker-compose.local.yml up --build

# Seed initial
docker compose -f docker-compose.local.yml exec backend sh -c \
  "npx prisma migrate deploy && npm run seed"
```

Accès : `http://localhost:3000`

---

## 4. Premier compte utilisateur

L'application n'a **aucun compte par défaut** (exigence §9).  
Créez le premier compte depuis l'interface de connexion en cliquant sur **"Créer un compte"**.

---

## 5. Passage en auto-hébergé (infrastructure interne)

Quand l'entreprise est prête à héberger en interne :

1. Dans `docker-compose.yml`, **décommenter le bloc `db`** (PostgreSQL local)
2. Modifier `DATABASE_URL` : `postgresql://qhse:SECRET@db:5432/qhse`
3. Ajouter `POSTGRES_PASSWORD` dans `.env`
4. Relancer avec `docker compose up -d --build`

Aucune réécriture du code applicatif n'est nécessaire.

---

## 6. Structure du projet

```
qhse_safran/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Modèle de données complet
│   │   └── seed.ts            # Données de référence (§6 CDC)
│   └── src/
│       ├── server.ts          # Point d'entrée Express
│       ├── lib/
│       │   ├── scores.ts      # Moteur de calcul (§5 CDC — exact)
│       │   └── auditLog.ts    # Audit automatique de toutes les écritures
│       ├── middleware/auth.ts  # JWT
│       └── routes/            # Un fichier par domaine métier
├── frontend/
│   └── src/
│       ├── pages/             # Dashboard, Axes, Checklists, Inventaire…
│       ├── components/        # Layout, StatusBadge, ScorePill…
│       ├── contexts/          # Auth, Project
│       └── api/client.ts      # Toutes les fonctions d'appel API
├── docker-compose.yml         # Production (Neon + Caddy HTTPS)
├── docker-compose.local.yml   # Développement local (HTTP)
├── Caddyfile                  # Proxy HTTPS
└── .env.example               # Variables à renseigner
```

---

## 7. Règles métier clés

Les calculs respectent **exactement** le §5 du cahier des charges :

- **Score d'un axe** = `Σ(poids_SA × %_SA) / Σ(poids_SA)` — normalisé par la somme réelle
- **Score global** = `Σ(poids_axe × score_axe) / Σ(poids_axe)` — fonctionne si Σ poids ≠ 100%
- **% d'une sous-action** = toujours dérivé du statut (0 / 50 / 100) — jamais saisi
- **Conformité d'un produit** = calculée, jamais stockée en base
- **Conformité (enum)** : CONFORME / ECART\_MINEUR / ECART\_MAJEUR — rejet backend de toute valeur hors enum

---

## 8. Sécurité

- HTTPS obligatoire via Caddy + Let's Encrypt
- Mots de passe hashés bcrypt (coût 12)
- Rate limiting sur `/api/auth/login` : 10 tentatives / 15 min
- Validation Zod stricte sur tous les champs enum et numériques
- JWT expiration 24 h
- Audit log sur toutes les mutations
- Aucune valeur de KPI codée en dur côté frontend

---

## 9. Données de référence chargées au démarrage (`npm run seed`)

- **7 axes** Produits Chimiques (Σ pondérations = 90%) avec **36 sous-actions** exactes
- **9 axes** Flux H25 (Σ = 100%) avec **38 sous-actions** exactes
- **5 actions correctives génériques** (indicateur de processus séparé)
- Référentiel **EN 14470-1** (20 critères) et **Checklist SSE armoire** (12 critères)
- **11 exigences** du référentiel PRO0239 (colonne Conformité vide à saisir en usage réel)
- Zones de départ : **ICLB**, **ICLK**
