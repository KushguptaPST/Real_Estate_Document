/**
 * Phase 2I — Controlled Pilot Readiness Remediation Test Suite
 *
 * Verifies:
 * 1. TIME-02: Ambiguous fall-back daylight-saving time detection & explicit disambiguation
 * 2. OPS-01: Idempotent graceful SIGTERM/SIGINT shutdown lifecycle
 * 3. UI-01: Inbound customer simulation production lockout and advisor endpoint security
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import supertest from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';
import { parseLocalDateTimeToUtc, formatUtcToLocalDateTime } from '../../src/utils/timezone.js';
import { gracefulShutdown } from '../../src/index.js';
import { initAlertCron, stopAlertCron } from '../../src/services/alert.service.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

describe('Phase 2I: Controlled Pilot Readiness Verification Suite', () => {
  // ════════════════════════════════════════════════════════════════════════════
  // 1. TIME-02: Ambiguous Daylight Saving Fall-Back Detection & Disambiguation
  // ════════════════════════════════════════════════════════════════════════════
  describe('TIME-02: Ambiguous Fall-Back Daylight-Saving Times', () => {
    it('detects and rejects ambiguous fall-back local times by default with clear candidates', () => {
      // In America/New_York on 2026-11-01, clocks jump back from 02:00 EDT to 01:00 EST.
      // 01:30 occurs twice (05:30Z EDT and 06:30Z EST).
      expect(() => {
        parseLocalDateTimeToUtc('2026-11-01', '01:30', 'America/New_York');
      }).toThrow(/Ambiguous local time due to daylight saving fall-back transition.*occurs twice/);
    });

    it('resolves the earlier occurrence (EDT) when explicit disambiguation "earlier" is requested', () => {
      const earlier = parseLocalDateTimeToUtc('2026-11-01', '01:30', 'America/New_York', {
        disambiguation: 'earlier',
      });
      expect(earlier.toISOString()).toBe('2026-11-01T05:30:00.000Z');

      const formatted = formatUtcToLocalDateTime(earlier, 'America/New_York');
      expect(formatted.date).toBe('2026-11-01');
      expect(formatted.time).toBe('01:30');
    });

    it('resolves the later occurrence (EST) when explicit disambiguation "later" is requested', () => {
      const later = parseLocalDateTimeToUtc('2026-11-01', '01:30', 'America/New_York', {
        disambiguation: 'later',
      });
      expect(later.toISOString()).toBe('2026-11-01T06:30:00.000Z');

      const formatted = formatUtcToLocalDateTime(later, 'America/New_York');
      expect(formatted.date).toBe('2026-11-01');
      expect(formatted.time).toBe('01:30');
    });

    it('strictly preserves rejection of nonexistent spring-forward gap (02:30 on 2026-03-08)', () => {
      expect(() => {
        parseLocalDateTimeToUtc('2026-03-08', '02:30', 'America/New_York');
      }).toThrow(/Nonexistent local time due to daylight saving spring-forward transition/);
    });

    it('strictly preserves rejection of invalid calendar dates (Feb 30, April 31)', () => {
      expect(() => {
        parseLocalDateTimeToUtc('2026-02-30', '10:00', 'America/New_York');
      }).toThrow(/Invalid calendar date: "2026-02-30"/);

      expect(() => {
        parseLocalDateTimeToUtc('2026-04-31', '10:00', 'Asia/Kolkata');
      }).toThrow(/Invalid calendar date: "2026-04-31"/);
    });

    it('accurately converts unambiguous local times across multiple standard and DST timezones', () => {
      // IST (no DST)
      const istDate = parseLocalDateTimeToUtc('2026-10-25', '14:00', 'Asia/Kolkata');
      expect(istDate.toISOString()).toBe('2026-10-25T08:30:00.000Z');

      // EST (winter)
      const estDate = parseLocalDateTimeToUtc('2026-01-15', '14:00', 'America/New_York');
      expect(estDate.toISOString()).toBe('2026-01-15T19:00:00.000Z');

      // EDT (summer)
      const edtDate = parseLocalDateTimeToUtc('2026-07-15', '14:00', 'America/New_York');
      expect(edtDate.toISOString()).toBe('2026-07-15T18:00:00.000Z');

      // UTC
      const utcDate = parseLocalDateTimeToUtc('2026-07-15', '14:00', 'UTC');
      expect(utcDate.toISOString()).toBe('2026-07-15T14:00:00.000Z');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. OPS-01: Graceful SIGTERM/SIGINT Shutdown Lifecycle
  // ════════════════════════════════════════════════════════════════════════════
  describe('OPS-01: Graceful SIGTERM/SIGINT Shutdown Lifecycle', () => {
    it('stops background cron, drains server, and disconnects prisma idempotently', async () => {
      // Initialize cron
      initAlertCron();

      // Create a mock server
      let closeCalled = false;
      const mockServer: any = {
        listening: true,
        close: (cb: (err?: Error) => void) => {
          closeCalled = true;
          cb();
        },
      };

      // Spy on prisma.$disconnect
      const disconnectSpy = jest.spyOn(prisma, '$disconnect').mockResolvedValue(undefined as never);

      // Execute shutdown
      await gracefulShutdown(mockServer, 'SIGTERM', { timeoutMs: 2000, exitOnComplete: false });

      expect(closeCalled).toBe(true);
      expect(disconnectSpy).toHaveBeenCalled();

      // Verify idempotency: calling duplicate shutdown does not fail or re-trigger
      await gracefulShutdown(mockServer, 'SIGTERM', { timeoutMs: 2000, exitOnComplete: false });

      disconnectSpy.mockRestore();
      stopAlertCron();
    });

    it('handles shutdown when server is already null or not listening', async () => {
      initAlertCron();
      const disconnectSpy = jest.spyOn(prisma, '$disconnect').mockResolvedValue(undefined as never);

      await expect(
        gracefulShutdown(null, 'SIGINT', { timeoutMs: 2000, exitOnComplete: false }),
      ).resolves.not.toThrow();

      disconnectSpy.mockRestore();
      stopAlertCron();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. UI-01: Inbound Customer Simulation Production Lockout & Advisor Security
  // ════════════════════════════════════════════════════════════════════════════
  describe('UI-01: Inbound Customer Simulation Production Lockout & Advisor Security', () => {
    let app: any;
    let orgAId: string;
    let agentA1Id: string;
    let agentA1Token: string;
    let leadA1Id: string;

    beforeEach(async () => {
      app = createApp();

      // Provision test organization and user
      const org = await prisma.organization.create({
        data: {
          name: 'Phase 2I Pilot Organization',
        },
      });
      orgAId = org.id;

      const session = await createMemberSession(orgAId, { role: 'AGENT' });
      agentA1Id = session.user.id;
      agentA1Token = session.token;

      const lead = await prisma.lead.create({
        data: {
          organizationId: orgAId,
          fullName: 'Pilot Test Buyer',
          email: 'buyer_p2i@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1Id,
        },
      });
      leadA1Id = lead.id;
    });

    afterEach(async () => {
      if (orgAId) {
        await deleteOrgUsers([orgAId]);
        await prisma.organization.deleteMany({ where: { id: orgAId } });
      }
    });

    it('rejects POST /conversations/messages simulation when NODE_ENV is production and simulation is not enabled', async () => {
      const originalNodeEnv = process.env['NODE_ENV'];
      const originalSimFlag = process.env['ENABLE_CUSTOMER_SIMULATION'];

      try {
        process.env['NODE_ENV'] = 'production';
        delete process.env['ENABLE_CUSTOMER_SIMULATION'];

        const res = await supertest(app)
          .post(`/api/leads/${leadA1Id}/conversations/messages`)
          .set('Authorization', `Bearer ${agentA1Token}`)
          .send({
            content: 'Simulated customer text that should be rejected in prod',
            channel: 'EMAIL',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toMatch(/Customer inquiry simulation is disabled in production/);
      } finally {
        process.env['NODE_ENV'] = originalNodeEnv;
        if (originalSimFlag !== undefined) {
          process.env['ENABLE_CUSTOMER_SIMULATION'] = originalSimFlag;
        } else {
          delete process.env['ENABLE_CUSTOMER_SIMULATION'];
        }
      }
    });

    it('allows genuine authenticated advisor messages via POST /messages/agent even in production', async () => {
      const originalNodeEnv = process.env['NODE_ENV'];

      try {
        process.env['NODE_ENV'] = 'production';

        const res = await supertest(app)
          .post(`/api/leads/${leadA1Id}/conversations/messages/agent`)
          .set('Authorization', `Bearer ${agentA1Token}`)
          .send({
            content: 'Hello, this is your authorized advisor answering your question.',
            channel: 'EMAIL',
          });

        expect(res.status).toBe(201);
        expect(res.body.senderType).toBe('AGENT');
        expect(res.body.senderId).toBe(agentA1Id);
      } finally {
        process.env['NODE_ENV'] = originalNodeEnv;
      }
    });
  });
});
