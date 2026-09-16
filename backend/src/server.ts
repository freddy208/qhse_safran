import express      from 'express';
import helmet       from 'helmet';
import cors         from 'cors';
import compression  from 'compression';
import rateLimit    from 'express-rate-limit';
import path         from 'path';

import authRoutes         from './routes/auth';
import projetsRoutes      from './routes/projets';
import axesRoutes         from './routes/axes';
import sousActionsRoutes  from './routes/sousActions';
import zonesRoutes        from './routes/zones';
import armoiresRoutes     from './routes/armoires';
import produitsRoutes     from './routes/produits';
import checklistsRoutes   from './routes/checklists';
import exigencesRoutes    from './routes/exigences';
import actionsRoutes      from './routes/actions';
import dashboardRoutes    from './routes/dashboard';
import alertesRoutes      from './routes/alertes';
import commentairesRoutes from './routes/commentaires';
import exportRoutes       from './routes/export';

const app  = express();
const PORT = process.env.PORT || 4000;

// Faire confiance au proxy Caddy pour X-Forwarded-For (nécessaire pour express-rate-limit)
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  console.error('FATAL : JWT_SECRET non défini');
  process.exit(1);
}

// ── Rate limiting global ──────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,  // 15 minutes
  max:            300,              // 300 req / 15 min par IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
  skip: (req) => req.path === '/health',
});

// ── Middlewares de base ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_ORIGIN || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api',               projetsRoutes);
app.use('/api',               axesRoutes);
app.use('/api',               sousActionsRoutes);
app.use('/api',               zonesRoutes);
app.use('/api',               armoiresRoutes);
app.use('/api',               produitsRoutes);
app.use('/api',               checklistsRoutes);
app.use('/api',               exigencesRoutes);
app.use('/api',               actionsRoutes);
app.use('/api',               dashboardRoutes);
app.use('/api',               alertesRoutes);
app.use('/api/commentaires',  commentairesRoutes);
app.use('/api',               exportRoutes);

// ── Healthcheck ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Frontend statique (SPA) ───────────────────────────────────────────────
const FRONTEND = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(FRONTEND));
app.get(/^(?!\/api)/, (_req, res) =>
  res.sendFile(path.join(FRONTEND, 'index.html'))
);

// ── 404 API ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Erreurs globales ──────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('P1001') || msg.includes("Can't reach database")) {
    console.error('[DB] Neon autosuspend:', msg);
    return res.status(503).json({ error: 'Base de données temporairement indisponible. Réessayez dans quelques secondes.' });
  }
  console.error('[ERR]', msg);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Protections process-level
process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });
process.on('uncaughtException',  (err)    => { console.error('[uncaughtException]',  err);    });

app.listen(PORT, () => {
  console.log(`Backend QHSE démarré sur le port ${PORT}`);
});

export default app;
