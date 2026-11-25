// ─────────────────────────────────────────────────────────────────────────────
// /api/public/widget — Embeddable Multi-Tenant Website Chat Widget & SDK
// Allows client brokerages to embed an Agentic AI advisor on their own site
// using a single <script> tag with strict Origin allowlist & visitor JWTs.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { resolveOrgByWidgetKey } from '../../services/channelRegistry.service.js';
import { getOrCreateLeadThread } from '../../services/conversation.service.js';
import { runSalesAgentLoop } from '../../services/agent/agentRuntime.js';
import { normalizePhone, normalizeEmail } from '../../services/lead.service.js';
import { rateLimit } from '../../utils/rateLimit.js';

const router = Router();
const widgetLimiter = rateLimit({ name: 'public-widget', windowMs: 60_000, max: 60 });

interface VisitorJwtPayload {
  type: 'widget_visitor';
  organizationId: string;
  visitorId: string;
  leadId: string;
  threadId: string;
}

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < 16) {
    throw createError('Widget authentication unavailable: JWT_SECRET not configured', 503);
  }
  return secret;
}

function extractRequestOrigin(req: Request): string | null {
  const origin = req.header('origin');
  if (origin) return origin.replace(/\/$/, '').toLowerCase();
  const referer = req.header('referer');
  if (referer) {
    try {
      return new URL(referer).origin.toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

function isOriginAllowed(req: Request, allowedOrigins: string[]): boolean {
  // Server-to-server / test requests without Origin are permitted only outside strict browser checks
  const reqOrigin = extractRequestOrigin(req);
  if (!reqOrigin) return true;
  if (allowedOrigins.includes('*')) return true;

  const normalizedAllowed = allowedOrigins.map((o) => o.replace(/\/$/, '').toLowerCase());
  if (normalizedAllowed.includes(reqOrigin)) return true;

  // Allow localhost in non-production for developer testing
  if (
    process.env['NODE_ENV'] !== 'production' &&
    (reqOrigin.startsWith('http://localhost') || reqOrigin.startsWith('http://127.0.0.1'))
  ) {
    return true;
  }

  return false;
}

function verifyVisitorToken(req: Request): VisitorJwtPayload {
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) {
    throw createError('Missing widget visitor session token', 401);
  }
  const token = auth.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, getJwtSecret()) as VisitorJwtPayload;
    if (payload.type !== 'widget_visitor' || !payload.organizationId || !payload.leadId || !payload.threadId) {
      throw new Error('Invalid visitor token claims');
    }
    return payload;
  } catch {
    throw createError('Invalid or expired widget session token', 401);
  }
}

const SessionInitSchema = z.object({
  widgetKey: z.string().min(4),
  visitorId: z.string().max(120).optional(),
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
  pageUrl: z.string().max(500).optional(),
});

const IdentifySchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.string().trim().email().max(200).optional(),
});

const WidgetMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

// ── GET /api/public/widget/config?key=... ─────────────────────────────────────
router.get(
  '/config',
  widgetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const key = String(req.query['key'] || '').trim();
    if (!key) throw createError('Widget public key is required', 400);

    const channel = await resolveOrgByWidgetKey(key);
    if (!channel) throw createError('Invalid widget key', 404);

    if (!isOriginAllowed(req, channel.widgetAllowedOrigins)) {
      throw createError('Origin not authorized for this widget key', 403);
    }

    res.json({
      organizationName: channel.organization.name,
      widgetTitle: channel.widgetTitle,
      widgetGreeting: channel.widgetGreeting,
      widgetThemeColor: channel.widgetThemeColor,
      currency: channel.defaultCurrency,
    });
  }),
);

// ── POST /api/public/widget/session ──────────────────────────────────────────
router.post(
  '/session',
  widgetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = SessionInitSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const channel = await resolveOrgByWidgetKey(parsed.data.widgetKey);
    if (!channel) throw createError('Invalid widget key', 404);

    if (!isOriginAllowed(req, channel.widgetAllowedOrigins)) {
      throw createError('Origin not authorized for this widget key', 403);
    }

    const orgId = channel.organizationId;
    const visitorId = parsed.data.visitorId?.trim() || `vis_${crypto.randomBytes(12).toString('hex')}`;
    const externalId = `widget:${visitorId}`;
    const normPhone = normalizePhone(parsed.data.phone);
    const normEmail = normalizeEmail(parsed.data.email);

    let lead = await prisma.lead.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { externalId },
          ...(normPhone ? [{ phone: normPhone }] : []),
          ...(normEmail ? [{ email: normEmail }] : []),
        ],
      },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          externalId,
          fullName: parsed.data.fullName || `Website Visitor ${visitorId.slice(-4)}`,
          phone: normPhone,
          email: normEmail,
          source: 'WEB_WIDGET',
          status: 'NEW',
          stage: 'NEW_INBOUND',
          priority: normPhone ? 'HIGH' : 'MEDIUM',
        },
      });
    }

    const thread = await getOrCreateLeadThread(lead.id, orgId, 'WEB_WIDGET');

    const tokenPayload: VisitorJwtPayload = {
      type: 'widget_visitor',
      organizationId: orgId,
      visitorId,
      leadId: lead.id,
      threadId: thread.id,
    };
    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '24h' });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'WIDGET_SESSION_CREATED',
        entityType: 'Lead',
        entityId: lead.id,
        actor: 'web_widget',
        note: `Website widget session initialized${parsed.data.pageUrl ? ` on ${parsed.data.pageUrl}` : ''}`,
      },
    }).catch(() => {});

    res.status(201).json({
      token,
      visitorId,
      leadId: lead.id,
      threadId: thread.id,
      greeting: channel.widgetGreeting,
      title: channel.widgetTitle,
      themeColor: channel.widgetThemeColor,
    });
  }),
);

// ── POST /api/public/widget/identify (Merge visitor contact into CRM Lead) ───
router.post(
  '/identify',
  widgetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const session = verifyVisitorToken(req);
    const parsed = IdentifySchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const normPhone = normalizePhone(parsed.data.phone);
    const normEmail = normalizeEmail(parsed.data.email);

    // Check if an existing lead with this phone/email already exists in the org
    const existingByContact =
      normPhone || normEmail
        ? await prisma.lead.findFirst({
            where: {
              organizationId: session.organizationId,
              id: { not: session.leadId },
              OR: [
                ...(normPhone ? [{ phone: normPhone }] : []),
                ...(normEmail ? [{ email: normEmail }] : []),
              ],
            },
          })
        : null;

    let activeLeadId = session.leadId;
    let activeThreadId = session.threadId;

    if (existingByContact) {
      // Merge anonymous widget thread messages onto the existing lead
      const targetThread = await getOrCreateLeadThread(existingByContact.id, session.organizationId, 'WEB_WIDGET');
      await prisma.conversationMessage.updateMany({
        where: { threadId: session.threadId, organizationId: session.organizationId },
        data: { threadId: targetThread.id },
      });
      await prisma.lead.update({
        where: { id: existingByContact.id },
        data: {
          fullName: parsed.data.fullName || existingByContact.fullName,
          phone: normPhone ?? existingByContact.phone,
          email: normEmail ?? existingByContact.email,
        },
      });
      activeLeadId = existingByContact.id;
      activeThreadId = targetThread.id;
    } else {
      await prisma.lead.update({
        where: { id: session.leadId },
        data: {
          ...(parsed.data.fullName ? { fullName: parsed.data.fullName } : {}),
          ...(normPhone ? { phone: normPhone, priority: 'HIGH' } : {}),
          ...(normEmail ? { email: normEmail } : {}),
        },
      });
    }

    const updatedToken = jwt.sign(
      {
        type: 'widget_visitor',
        organizationId: session.organizationId,
        visitorId: session.visitorId,
        leadId: activeLeadId,
        threadId: activeThreadId,
      } satisfies VisitorJwtPayload,
      getJwtSecret(),
      { expiresIn: '24h' },
    );

    res.json({
      identified: true,
      token: updatedToken,
      leadId: activeLeadId,
    });
  }),
);

// ── GET /api/public/widget/messages ──────────────────────────────────────────
router.get(
  '/messages',
  widgetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const session = verifyVisitorToken(req);
    const messages = await prisma.conversationMessage.findMany({
      where: {
        threadId: session.threadId,
        organizationId: session.organizationId,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: {
        id: true,
        senderType: true,
        content: true,
        suggestedAction: true,
        createdAt: true,
      },
    });
    res.json({ messages });
  }),
);

// ── POST /api/public/widget/messages ─────────────────────────────────────────
router.post(
  '/messages',
  widgetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const session = verifyVisitorToken(req);
    const parsed = WidgetMessageSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const customerMsg = await prisma.conversationMessage.create({
      data: {
        threadId: session.threadId,
        organizationId: session.organizationId,
        senderType: 'CUSTOMER',
        content: parsed.data.content,
        approvalStatus: 'APPROVED',
        deliveryStatus: 'DELIVERED',
      },
    });

    const recent = await prisma.conversationMessage.findMany({
      where: { threadId: session.threadId, organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const agentResult = await runSalesAgentLoop({
      leadId: session.leadId,
      organizationId: session.organizationId,
      threadId: session.threadId,
      customerMessage: parsed.data.content,
      recentMessages: recent.reverse().map((m) => ({ senderType: m.senderType, content: m.content })),
      channel: 'WEB_WIDGET',
    });

    let aiMessage = null;
    if (!agentResult.suppressed && agentResult.response) {
      aiMessage = await prisma.conversationMessage.create({
        data: {
          threadId: session.threadId,
          organizationId: session.organizationId,
          senderType: 'AI',
          content: agentResult.response,
          suggestedAction: {
            specialist: agentResult.specialist,
            stage: agentResult.stage,
            followUps: agentResult.suggestedFollowUps,
            matchedProperties: agentResult.matchedProperties ?? [],
            collateralSent: agentResult.collateralSent ?? null,
          } as object,
          approvalStatus: 'APPROVED',
          deliveryStatus: 'DELIVERED',
        },
      });
    }

    res.status(201).json({
      customerMessage: customerMsg,
      reply: aiMessage?.content || (agentResult.suppressed ? 'A senior property advisor has joined this chat and will reply shortly.' : ''),
      suggestedFollowUps: agentResult.suggestedFollowUps,
      matchedProperties: agentResult.matchedProperties ?? [],
      collateralSent: agentResult.collateralSent ?? null,
      specialist: agentResult.specialist,
      stage: agentResult.stage,
      suppressed: Boolean(agentResult.suppressed),
    });
  }),
);

// ── GET /api/public/widget.js — Self-Contained Shadow-DOM Embed Script ───────
router.get('/widget.js', (req: Request, res: Response) => {
  const protocol = req.header('x-forwarded-proto') || req.protocol || 'http';
  const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
  const apiBase = `${protocol}://${host}/api/public/widget`;

  const script = `(function(){
  if (window.__eigenEstateWidgetLoaded) return;
  window.__eigenEstateWidgetLoaded = true;
  var scriptEl = document.currentScript || document.querySelector('script[data-org-key],script[data-org]');
  var orgKey = scriptEl ? (scriptEl.getAttribute('data-org-key') || scriptEl.getAttribute('data-org') || '') : '';
  if (!orgKey) { console.warn('[EigenEstate Widget] Missing data-org-key attribute'); return; }
  var API = ${JSON.stringify(apiBase)};
  var STORAGE_KEY = 'eigen_widget_token_' + orgKey;

  var host = document.createElement('div');
  host.id = 'eigen-estate-widget-root';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  var state = { open: false, token: sessionStorage.getItem(STORAGE_KEY) || '', config: { widgetTitle: 'AI Property Advisor', widgetGreeting: 'Hi! Tell me your preferred location, budget, or BHK.', widgetThemeColor: '#0F172A' }, messages: [], identified: false, loading: false };

  function render() {
    var theme = state.config.widgetThemeColor || '#0F172A';
    var msgsHtml = state.messages.map(function(m) {
      var isUser = m.role === 'user';
      var cardsHtml = '';
      if (m.properties && m.properties.length) {
        cardsHtml = m.properties.map(function(p) {
          return '<div style="margin-top:6px;padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;">' +
            '<div style="font-weight:600;color:#0f172a;">' + escapeHtml(p.title) + '</div>' +
            '<div style="color:#475569;">' + escapeHtml(p.city) + ' • ' + p.bedrooms + ' BHK</div>' +
            (p.brochureUrl ? '<a href="' + escapeHtml(p.brochureUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:4px;color:' + theme + ';font-weight:600;text-decoration:none;">Download Brochure ↗</a>' : '') +
          '</div>';
        }).join('');
      }
      return '<div style="display:flex;flex-direction:column;align-items:' + (isUser ? 'flex-end' : 'flex-start') + ';margin-bottom:10px;">' +
        '<div style="max-width:85%;padding:9px 12px;border-radius:12px;font-size:13px;line-height:1.45;' +
        (isUser ? 'background:' + theme + ';color:#fff;' : 'background:#f1f5f9;color:#0f172a;') + '">' +
        escapeHtml(m.text) + cardsHtml + '</div></div>';
    }).join('');

    shadow.innerHTML =
      '<style>*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}</style>' +
      '<div style="position:fixed;bottom:20px;right:20px;z-index:2147483000;">' +
      (state.open ? (
        '<div style="width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 90px);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,0.22);border:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;margin-bottom:12px;">' +
          '<div style="background:' + theme + ';color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">' +
            '<div><div style="font-weight:700;font-size:14px;">' + escapeHtml(state.config.widgetTitle) + '</div><div style="font-size:11px;opacity:0.85;">Online • Instant Property & Visit Help</div></div>' +
            '<button id="ee-close" style="background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;">×</button>' +
          '</div>' +
          (!state.identified ? (
            '<div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;gap:6px;">' +
              '<input id="ee-name" placeholder="Name" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />' +
              '<input id="ee-phone" placeholder="WhatsApp / Phone" style="flex:1.2;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />' +
              '<button id="ee-save-id" style="padding:6px 10px;background:' + theme + ';color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">Save</button>' +
            '</div>'
          ) : '') +
          '<div id="ee-scroll" style="flex:1;padding:14px;overflow-y:auto;background:#fff;">' + msgsHtml + (state.loading ? '<div style="font-size:12px;color:#64748b;">Typing...</div>' : '') + '</div>' +
          '<form id="ee-form" style="padding:10px;border-top:1px solid #e2e8f0;display:flex;gap:8px;background:#fff;">' +
            '<input id="ee-input" placeholder="Ask about location, budget, or site visit..." style="flex:1;padding:9px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13px;outline:none;" />' +
            '<button type="submit" style="padding:0 14px;background:' + theme + ';color:#fff;border:none;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;">Send</button>' +
          '</form>' +
        '</div>'
      ) : '') +
      '<button id="ee-toggle" style="width:56px;height:56px;border-radius:9999px;background:' + theme + ';color:#fff;border:none;box-shadow:0 10px 25px rgba(15,23,42,0.28);cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;margin-left:auto;">💬</button>' +
      '</div>';

    var toggleBtn = shadow.getElementById('ee-toggle');
    if (toggleBtn) toggleBtn.onclick = function() { state.open = !state.open; if (state.open && !state.token) initSession(); render(); };
    var closeBtn = shadow.getElementById('ee-close');
    if (closeBtn) closeBtn.onclick = function() { state.open = false; render(); };
    var saveBtn = shadow.getElementById('ee-save-id');
    if (saveBtn) saveBtn.onclick = function() {
      var n = shadow.getElementById('ee-name').value;
      var p = shadow.getElementById('ee-phone').value;
      if (!p && !n) return;
      fetch(API + '/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ fullName: n || undefined, phone: p || undefined })
      }).then(function(r){ return r.json(); }).then(function(d){
        if (d.token) { state.token = d.token; sessionStorage.setItem(STORAGE_KEY, d.token); state.identified = true; render(); }
      });
    };
    var form = shadow.getElementById('ee-form');
    if (form) form.onsubmit = function(e) {
      e.preventDefault();
      var inp = shadow.getElementById('ee-input');
      var text = (inp.value || '').trim();
      if (!text || state.loading) return;
      inp.value = '';
      state.messages.push({ role: 'user', text: text });
      state.loading = true;
      render();
      sendMessage(text);
    };
    var sc = shadow.getElementById('ee-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function initSession() {
    fetch(API + '/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: orgKey, pageUrl: window.location.href })
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d.token) {
        state.token = d.token;
        sessionStorage.setItem(STORAGE_KEY, d.token);
        if (state.messages.length === 0 && d.greeting) {
          state.messages.push({ role: 'ai', text: d.greeting });
        }
        render();
      }
    });
  }

  function sendMessage(text) {
    var doSend = function() {
      fetch(API + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token },
        body: JSON.stringify({ content: text })
      }).then(function(r){ return r.json(); }).then(function(d){
        state.loading = false;
        if (d.reply) state.messages.push({ role: 'ai', text: d.reply, properties: d.matchedProperties });
        render();
      }).catch(function(){ state.loading = false; render(); });
    };
    if (!state.token) { initSession(); setTimeout(doSend, 500); } else { doSend(); }
  }

  fetch(API + '/config?key=' + encodeURIComponent(orgKey)).then(function(r){ return r.json(); }).then(function(cfg){
    if (cfg && cfg.widgetTitle) state.config = cfg;
    if (state.messages.length === 0) state.messages.push({ role: 'ai', text: state.config.widgetGreeting });
    render();
  }).catch(function(){ render(); });
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(script);
});

export default router;
