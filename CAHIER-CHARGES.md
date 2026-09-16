# Cahier des charges technique — Dashboard QHSE Safran (Produits Chimiques + Flux H25)

> Document destiné à un agent de développement (Claude Code). Toutes les données de référence ci-dessous (axes, pondérations, critères) sont recopiées exactement depuis les documents fournis par la cliente — ne pas inventer ni arrondir de valeur. Là où une donnée est absente de la source, c'est noté explicitement "à saisir en usage réel" plutôt que comblé par une supposition.

## 1. Contexte

Application de pilotage QHSE pour suivre deux plans d'action pondérés d'une entreprise industrielle (probable filiale/sous-traitant Safran, référentiel interne cité : "Safran HSE – PRO0239 Standard Risque Chimique 4.06") :
- **Produits Chimiques** (7 axes)
- **Flux H25** (9 axes)

Les deux projets sont indépendants (structures d'axes différentes) mais partagent le même moteur applicatif. Le dashboard remplace un suivi Excel où tous les pourcentages sont aujourd'hui recalculés à la main (source de retards et d'erreurs constatées : un champ "Conformité" a été trouvé rempli avec la valeur `0.25` au lieu de Oui/Non dans le classeur fourni).

Version pilote à héberger en ligne pour test par la cliente ; conteneurisation obligatoire pour permettre un rapatriement ultérieur sur l'infrastructure interne de l'entreprise sans réécriture.

## 2. Architecture technique

**3 services, orchestrés par Docker Compose :**

| Service | Techno | Rôle |
|---|---|---|
| `db` | PostgreSQL 16 | Stockage — dès le départ, pas SQLite, pour l'écriture concurrente de plusieurs utilisateurs. En phase pilote, ce service est remplacé par une base Neon externe (voir ci-dessous) ; le conteneur `db` réel n'est utilisé qu'au moment de l'adoption par l'entreprise. |
| `backend` | Node.js + Express + Prisma ORM | API REST, moteur de calcul, authentification JWT |
| `frontend` | React + Vite + Recharts | Interface, appelle l'API, re-fetch après chaque mutation pour un effet "temps réel" |
| `proxy` | Caddy (ou Traefik) | HTTPS automatique (Let's Encrypt) devant le tout — non négociable, ce sont des données d'entreprise |

**Hébergement pilote (gratuit, phase de test)** :
- **Base de données** : Neon (PostgreSQL managé, palier gratuit permanent, sans carte bancaire, sans date d'expiration) — ne pas utiliser la base gratuite de Render, qui est automatiquement supprimée 30 jours après création.
- **Backend + frontend + proxy** : Render (offre gratuite) ou Fly.io, connectés à la base Neon via une variable d'environnement `DATABASE_URL` plutôt qu'à un conteneur Postgres local.
- Le backend doit donc être conçu pour pointer vers une base externe (variable d'environnement de connexion), et non supposer que Postgres tourne dans le même docker-compose — cela permet de garder exactement le même code le jour où l'entreprise héberge tout en interne avec un vrai conteneur Postgres.
- Limite connue de l'offre gratuite Render : le service s'endort après 15 minutes d'inactivité et met environ une minute à se réveiller au premier accès suivant (Render affiche une page de chargement le temps du réveil) — sans impact réel pour un usage de test ponctuel.
- **Si l'entreprise adopte** : migrer vers un VPS (Hetzner, OVH ou équivalent) ou l'infrastructure interne, avec cette fois un vrai conteneur PostgreSQL dans le docker-compose plutôt que Neon.

## 3. Design system

**⚠️ Important** : la charte graphique officielle Safran n'est pas publique (accès réservé en interne, sur demande auprès du groupe). La palette ci-dessous est **inspirée** du bleu identifiable publiquement sur le logo Safran — ce n'est pas une valeur officielle validée. Si la cliente peut obtenir les vraies valeurs auprès de son entreprise, les substituer avant la mise en production réelle.

- **Bleu principal** : `#0055A4` (boutons primaires, en-têtes, éléments actifs)
- **Bleu foncé** (texte, sidebar) : `#003D75`
- **Gris neutre** (fonds de carte, bordures) : `#F2F4F7` / `#D9DEE4`
- **Gris texte** : `#3C4552`
- **Blanc** : fonds de page
- **Couleurs sémantiques** (indépendantes de la charte, universelles pour la lisibilité QHSE) :
  - Conforme / Réalisé : vert `#2E7D32`
  - Écart mineur / En cours : ambre `#B7950B`
  - Écart majeur / Non réalisé / Alerte : rouge `#C0392B`
- **Typographie** : une police sans-serif système (Inter, Segoe UI, ou équivalent) — pas de police exotique, priorité à la lisibilité en environnement industriel.
- **Ton visuel général** : sobre, dense en information mais aéré, proche des dashboards de suivi industriel/aéronautique — pas d'esthétique "startup" ludique, un environnement QHSE inspire la rigueur.

## 4. Modèle de données

**Utilisateur** — id, nom, email, mot_de_passe_hash, date_creation. Tous les utilisateurs ont les mêmes droits pour l'instant (pas de rôle actif, mais prévoir la colonne pour plus tard).

**Projet** — id, nom, description. Deux lignes de départ : "Produits Chimiques", "Flux H25".

**Axe** (appartient à un Projet) — id, projet_id, code, intitulé, pondération (%).

**SousAction** (appartient à un Axe) — id, axe_id, libellé, pondération_dans_axe (%), statut (Non démarré / En cours / Réalisé), responsable, échéance, date_derniere_maj (auto, jamais saisie).

**Zone** (appartient à un Projet) — id, projet_id, nom. Ex. ICLB, ICLK.

**Armoire** (appartient à une Zone) — id, zone_id, nom.

**TypeChecklist** — id, nom. Deux types de départ : "Conformité EN 14470-1" et "Checklist SSE armoire".

**Critere** (appartient à un TypeChecklist) — id, type_checklist_id, libellé, ordre.

**ResultatCritere** (croisement Armoire × Critère) — id, armoire_id, critere_id, résultat (Conforme / Écart mineur / Écart majeur), date_derniere_maj (auto).

**Produit** (dans une Armoire) — id, armoire_id, nom, code_produit, quantité_présente, quantité_utilisée, volume_max, date_péremption, url_fds, fds_date_verification. Conformité = **champ calculé**, jamais saisi (règle §5.5).

**ExigenceAudit** (référentiel externe, ex. PRO0239) — id, projet_id, domaine, exigence, question_controle, conformité (Oui/Non), preuves, action_a_mener, responsable.

**ActionCorrective** (générique, suivi du traitement des écarts) — id, projet_id, libellé, pondération, statut, date_derniere_maj (auto). Voir §6 pour la structure exacte reprise de la source.

**Commentaire** (note libre) — id, zone_id (optionnel), axe_id (optionnel), auteur_id, texte, date.

**AuditLog** — id, utilisateur_id, table_concernée, ligne_id, champ_modifié, ancienne_valeur, nouvelle_valeur, date_heure. Une ligne à chaque écriture.

**HistoriqueScore** — id, projet_id, axe_id (nullable si score global), score, date. Un point à chaque recalcul significatif (ou au minimum un instantané quotidien), pour la courbe de tendance.

**Paramètres globaux (par Projet)** :
- Conversion statut : Non démarré = 0%, En cours = 50%, Réalisé = 100%
- Conversion conformité : Conforme = 100%, Écart mineur = 50%, Écart majeur = 0%
- Seuil d'alerte : 3 semaines par défaut, modifiable

## 5. Règles de calcul (cœur du système — implémenter exactement ainsi)

1. **Le % d'une SousAction n'est jamais une saisie.** Toujours dérivé du statut. Si le statut repasse de "Réalisé" à "En cours", le % retombe immédiatement à 50% partout où il est utilisé.
2. **Score d'un Axe** = `Σ(pondération_sous_action × %_sous_action) / Σ(pondération_sous_action)`.
3. **Score global d'un Projet** = `Σ(pondération_axe × score_axe) / Σ(pondération_axe)` — la division par la somme réelle des pondérations garde le score correct même si elles ne totalisent pas exactement 100% (cas réel : les 7 axes Produits Chimiques totalisent 90%, voir §6).
4. **Taux de conformité d'une Armoire** = moyenne des ResultatCritere (table de conversion conformité), pour un TypeChecklist donné. **Taux de conformité d'une Zone** = moyenne des taux de ses Armoires.
5. **Conformité d'un Produit** (règle composite fournie par la cliente) — un produit est en écart s'il échoue à au moins un des critères suivants :
   - FDS manquante (url_fds vide) → **Écart majeur**
   - Date de péremption dépassée → **Écart majeur**
   - FDS obsolète (fds_date_verification > 3 ans) → **Écart mineur**
   - Code produit manquant → **Écart mineur**
   - Stockage non conforme (référence au résultat de conformité de son armoire) → **Écart mineur**
   - Sévérité déjà validée par la cliente : majeur pour les deux risques directs (FDS absente, produit expiré), mineur pour les manquements administratifs/organisationnels.
6. **Toute mise à jour recalcule et rafraîchit immédiatement** l'axe concerné, le score global, la conformité de zone, tous les graphiques et cartes dépendants (le frontend refait un fetch après chaque mutation réussie — pas besoin de WebSocket pour 5 utilisateurs).
7. **date_derniere_maj est toujours renseignée par le backend**, jamais par l'utilisateur.
8. **Alerte de retard** : toute SousAction, Armoire (via son dernier ResultatCritere) ou ActionCorrective dont date_derniere_maj dépasse le seuil apparaît dans une liste d'alertes centralisée, tous types confondus, avec badge visuel.
9. **Chaque écriture génère une ligne AuditLog** (qui, quoi, avant/après, quand).
10. **Chaque recalcul de score significatif ajoute un point dans HistoriqueScore.**

## 6. Données de référence à charger au démarrage (seed data — exactement comme fourni par la cliente)

### 6.1 Projet "Produits Chimiques" — 7 axes (somme des poids = 90%, ne pas corriger arbitrairement, le calcul du score global normalise déjà par la somme réelle)

| Axe | Poids |
|---|---|
| AXE 1 : Gestion de l'inventaire des produits chimiques | 15% |
| AXE 2 : Gestion documentaire des FDS | 20% |
| AXE 3 : Gestion des produits expirés | 10% |
| AXE 4 : Conformité des armoires chimiques | 20% |
| AXE 5 : Maîtrise du stockage chimique | 10% |
| AXE 6 : Formation et sensibilisation | 10% |
| AXE 7 : Analyse terrain et culture SSE | 5% |

Sous-actions par axe (poids dans l'axe) :

- **AXE 1** : Réaliser l'inventaire ICLB (20%) · Réaliser l'inventaire ICLK (20%) · Identifier tous les produits (20%) · Vérifier les codes produits (20%) · Désigner les responsables de suivi (20%)
- **AXE 2** : Recenser les FDS manquantes (20%) · Télécharger les FDS absentes (20%) · Vérifier les FDS > 3 ans (20%) · Associer chaque produit à sa FDS (20%) · Mettre à jour la base documentaire (20%)
- **AXE 3** : Identifier les produits expirés (25%) · Mettre en quarantaine les produits (25%) · Organiser l'élimination (25%) · Mettre à jour l'inventaire (25%)
- **AXE 4** : Audit EN 14470-1 des armoires (15%) · Contrôle ventilation (15%) · Contrôle fermeture automatique (15%) · Vérification de la rétention (15%) · Vérification du marquage réglementaire (10%) · Vérification pictogrammes (10%) · Vérification rangement (10%) · Vérification compatibilité chimique (10%)
- **AXE 5** : Vérifier les incompatibilités chimiques (20%) · Vérifier les volumes stockés (20%) · Contrôler les contenants (20%) · Contrôler l'étiquetage CLP (20%) · Contrôler les bidons vides (20%)
- **AXE 6** : Identifier le personnel exposé (20%) · Vérifier les formations existantes (20%) · Former les opérateurs (20%) · Former les intérimaires (20%) · Réaliser les animations SSE (20%)
- **AXE 7** : Préparer le questionnaire (25%) · Réaliser les entretiens (25%) · Analyser les résultats (25%) · Définir les actions d'amélioration (25%)

**ActionCorrective générique** (présente dans la source, hors pondération des 7 axes ci-dessus — afficher comme un indicateur de processus séparé, pas dans le score global) : Prioriser les écarts (20%) · Définir les responsables (20%) · Définir les échéances (20%) · Suivre les actions (20%) · Clôturer les actions (20%)

### 6.2 Projet "Flux H25" — 9 axes (somme des poids = 100%)

| Axe | Poids |
|---|---|
| Pilotage du projet | 10% |
| Analyse du procédé | 10% |
| Recherche des produits candidats | 15% |
| Étude documentaire | 15% |
| Données techniques | 10% |
| Stockage du Flux H25 | 10% |
| Essais d'innocuité | 10% |
| Validation technique | 15% |
| Prestations laboratoire | 5% |

Sous-actions par axe (poids dans l'axe) :

- **Pilotage** : Désigner le pilote projet (25%) · Organiser le lancement projet (25%) · Définir les rôles des acteurs (25%) · Valider le planning (25%)
- **Analyse du procédé** : Identifier les étapes d'utilisation du Flux H25 (25%) · Identifier les contraintes techniques (25%) · Identifier les émissions de fumées (25%) · Formaliser les risques SSE (25%)
- **Recherche des produits candidats** : Rechercher des solutions existantes (20%) · Étudier le retour d'expérience Inde (20%) · Identifier les flux candidats (20%) · Vérifier la compatibilité technique (20%) · Valider la présélection (20%)
- **Étude documentaire** : Collecter les FDS des candidats (20%) · Identifier les substances actives (20%) · Analyser les dangers (20%) · Analyser les risques SSE (20%) · Rédiger la synthèse documentaire (20%)
- **Données techniques** : Identifier les pièces concernées (25%) · Récupérer les données DMR35 (25%) · Identifier les matériaux (25%) · Consolider le dossier technique (25%)
- **Stockage** : Définir le besoin (20%) · Choisir l'armoire adaptée (20%) · Installer l'armoire (30%) · Vérifier la conformité (30%)
- **Essais d'innocuité** : Identifier les interlocuteurs YQLL (20%) · Préparer les essais (20%) · Réaliser les essais (30%) · Analyser les résultats (30%)
- **Validation technique** : Réaliser les essais de brasage (25%) · Évaluer la qualité obtenue (25%) · Réaliser les essais DVI (25%) · Valider les performances (25%)
- **Prestations laboratoire** : Solliciter le laboratoire partenaire (25%) · Réaliser les analyses demandées (25%) · Consolider les résultats (25%) · Valider le rapport final (25%)

> Note dans la source : "Sous-actions proposées à titre indicatif — à valider/adapter avec le référent laboratoire." Charger quand même ces données par défaut, modifiables ensuite via le module Référentiel.

### 6.3 TypeChecklist "Conformité EN 14470-1" — 20 critères

Marquage EN 14470-1 · Type 30/60/90 · Pictogrammes · Capacité maximale · Sans corrosion · Sans déformation · Poignée · Serrure · Portes fermées hors utilisation · Fermeture automatique · Ventilation · Bac de rétention · Produit identifiable · Étiquetage CLP · Date de péremption · FDS disponible · Compatibilité chimique · Propreté / rangement · Produits expirés retirés · Bidons vides retirés

### 6.4 TypeChecklist "Checklist SSE armoire" — 12 critères

Procédure · Compatibilité · Liste de produits · Inventaire · Bac rétention · État (propreté) · Pictogrammes · Rangement · Compatibilité des produits · Produits mélangés · Plan d'urgence · Moyens disponibles

### 6.5 Référentiel ExigenceAudit "Safran HSE – PRO0239 Standard Risque Chimique 4.06" — structure (11 domaines constatés dans la source)

Gouvernance (Inventaire produits chimiques) · Documentation (FDS disponibles) · Évaluation des risques (Évaluation risques chimiques) · Substitution (Flux H25) · Prévention technique (Ventilation/captage) · EPI (EPI adaptés) · Formation (Formation opérateurs) · Stockage (Compatibilité produits) · Stockage (Étiquetage CLP) · Urgence (Gestion des déversements) · Urgence (Lave-œil/douche)

> Charger cette structure comme référentiel vide à auditer (colonnes Domaine/Exigence/Question de contrôle pré-remplies), la colonne Conformité reste "à saisir en usage réel" — ne pas préremplir avec les réponses de l'ancien classeur, ce sont des données d'audit datées à ressaisir/valider dans l'outil.

## 7. Modules fonctionnels

1. **Authentification** — email/mot de passe, JWT, droits identiques pour tous pour l'instant.
2. **Sélecteur de Projet** — bascule entre Produits Chimiques et Flux H25 (données et dashboards totalement séparés).
3. **Référentiel** — CRUD des Axes/SousActions/pondérations, des TypeChecklist/Critères, des paramètres (seuil d'alerte, tables de conversion).
4. **Suivi des actions** — liste des SousActions par Axe, changement de statut en un clic.
5. **Checklists de conformité** — grille Armoire × Critère, sélectionnable par TypeChecklist.
6. **Inventaire produits** — CRUD des Produits par Armoire, conformité calculée automatiquement (jamais saisie).
7. **Plan d'actions correctives** — suivi générique (§6.1) + liste d'actions correctives spécifiques si besoin d'en ajouter en usage réel.
8. **Grille d'exigences (audit externe)** — CRUD des ExigenceAudit liées au référentiel PRO0239.
9. **Dashboard** — cartes KPI, radar par axe, conformité par zone, répartition des statuts, courbe de tendance du score global, liste des alertes actives, commentaires par zone/axe.
10. **Export** — PDF ou Excel du dashboard pour les réunions.

## 8. Indicateurs à afficher (dashboard)

- Avancement global du projet (%) + tendance sur les dernières semaines
- Score par axe (radar)
- Nombre d'actions réalisées / en cours / non démarrées
- Nombre d'actions en alerte (retard), tous types confondus
- Ancienneté moyenne de mise à jour par axe
- Taux de conformité par zone
- Taux de couverture (armoires auditées / total du parc, produits contrôlés / total inventaire)
- Répartition des écarts par gravité (mineur/majeur) et par zone
- FDS manquantes / FDS > 3 ans
- Répartition des retards par responsable

## 9. Sécurité (à respecter dès le prototype)

- HTTPS obligatoire (Caddy/Traefik + Let's Encrypt)
- Mots de passe hashés (bcrypt/argon2), longueur minimale imposée
- Aucun compte par défaut laissé actif
- Rate limiting sur la route de connexion (anti brute-force)
- Sauvegardes automatiques quotidiennes de la base PostgreSQL
- Mises à jour régulières des dépendances et de l'image de base
- Validation stricte des champs "Conformité"/"Statut" côté backend (enum, jamais de texte libre ni de nombre) — c'est directement la faille constatée dans le classeur source (`0.25` au lieu de Oui/Non)

## 10. Contraintes générales

- Interface entièrement en français
- Code lisible et documenté — doit rester maintenable après la fin du stage
- Pas de dépendance à un compte Google/Microsoft pour les utilisateurs finaux
- Conteneurisation complète (docker-compose.yml à la racine, une commande pour tout lancer)
- Aucune valeur numérique de KPI ne doit être codée en dur dans le frontend — tout provient du calcul backend en direct