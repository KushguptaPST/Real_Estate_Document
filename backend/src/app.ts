import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import dealsRouter from './api/routes/deals.js';
import documentsRouter from './api/routes/documents.js';
import deadlinesRouter from './api/routes/deadlines.js';
import auditRouter from './api/routes/audit.js';
import assistantRouter from './api/routes/assistant.js';
import notificationsRouter from './api/routes/notifications.js';
import inboundRouter from './api/routes/inbound.js';
import authRouter from './api/routes/auth.js';
import organizationRouter from './api/routes/organization.js';
import leadsRouter from './api/routes/leads.js';
import conversationsRouter from './api/routes/conversations.js';
import propertiesRouter, { leadMatchesRouter } from './api/routes/properties.js';
import tasksRouter from './api/routes/tasks.js';
import leadTasksRouter from './api/routes/leadTasks.js';
import siteVisitsRouter from './api/routes/siteVisits.js';
import knowledgeRouter from './api/routes/knowledge.js';
import messagingWebhooksRouter from './api/routes/messagingWebhooks.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // ── Security & parsing middleware ────────────────────────────────────────
  app.disable('x-powered-by');
  app.use(helmet());
  // Explicit allowlist only. Local dev origins are added outside production;
  // no environment accepts arbitrary origins.
  const allowedOrigins = new Set(
    [
      ...(process.env['CORS_ORIGIN'] ?? '').split(','),
      ...(process.env['NODE_ENV'] === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']),
    ]
      .map((o) => o.trim())
      .filter(Boolean),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests without an Origin header (server-to-server, curl) are not subject to CORS.
        callback(null, !origin || allowedOrigins.has(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
    }),
  );
  // Keep the exact request bytes so webhook signatures are verified over what was signed.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API routes ────────────────────────────────────────────────────────────
  app.use('/api/auth', authRouter);
  app.use('/api/org', organizationRouter);
  app.use('/api/inbound', inboundRouter); // HMAC signature (JSON) or INBOUND_WEBHOOK_SECRET (multipart)
  app.use('/api/webhooks', messagingWebhooksRouter); // Resend (Svix HMAC) & SendGrid delivery/bounce webhooks
  app.use('/api/leads', leadsRouter);
  app.use('/api/leads/:id/conversations', conversationsRouter);
  app.use('/api/leads/:id/matches', leadMatchesRouter);
  app.use('/api/properties', propertiesRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/tasks', requireAuth, leadTasksRouter);
  app.use('/api/site-visits', requireAuth, siteVisitsRouter);
  app.use('/api/deals', requireAuth, dealsRouter);
  app.use('/api/deals/:id/documents', requireAuth, documentsRouter);
  app.use('/api/deals/:id/deadlines', requireAuth, deadlinesRouter);
  app.use('/api/deals/:id/tasks', requireAuth, tasksRouter);
  app.use('/api/deals/:id/audit', requireAuth, auditRouter);
  app.use('/api/deals/:id/assistant', requireAuth, assistantRouter);
  app.use('/api/deals/:id/notifications', requireAuth, notificationsRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Route not found' } });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
