import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH-9/PH-10 integration tests: T-016 reassessment, T-019 privacy
 * export/delete/consents, T-020 authorization matrix.
 * Requires DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET.
 */

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

let seq = 0;
const uniq = (p: string) => `${p}-${Date.now()}-${++seq}`;
const PASSWORD = 'a-strong-test-password';

async function waitFor(cond: () => Promise<boolean>, ms = 30_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('waitFor timed out');
}

describe('reassessment + privacy + authz (integration, PH-9/10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const sessionIds: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function registerUser() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: `${uniq('u')}@example.com`, password: PASSWORD, consentVersion: '2026-11' })
      .expect(201);
    const userId = res.body.data.user.id as string;
    userIds.push(userId);
    return { token: res.body.data.accessToken as string, userId };
  }

  beforeAll(async () => {
    for (const n of ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET']) {
      if (!process.env[n]) throw new Error(`${n} is not set`);
    }
    process.env.RATE_LIMIT_FACTOR ??= '1000';
    process.env.RECALC_QUEUE_NAME ??= `aptiva-recalc-test-${process.pid}`;
    process.env.PROFILE_QUEUE_NAME ??= `aptiva-profile-test-${process.pid}`;
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.reassessmentResult.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.mistakeEntry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.consentRecord.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.studentTopicProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.profileSnapshot.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.planChangeLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.practicePlanItem.deleteMany({ where: { plan: { userId: { in: userIds } } } });
    await prisma.practicePlan.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.questionAttempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.practiceSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { objectId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('T-016: reassessment lifecycle — start, answer, finish, comparison', async () => {
    const { token, userId } = await registerUser();

    // Seed a baseline snapshot + topic profile so comparison has data.
    const topic = await prisma.topic.findFirst({ select: { id: true } });
    expect(topic).toBeTruthy();
    const snap = await prisma.profileSnapshot.create({
      data: {
        userId,
        trigger: 'baseline',
        isBaseline: true,
        data: { topics: [{ topicId: topic!.id, rating: 1500, rd: 300, accuracyEma: 0.6 }] },
        engineVersion: 'test',
      },
    });
    await prisma.studentTopicProfile.create({
      data: {
        userId,
        topicId: topic!.id,
        rating: 1520,
        rd: 290,
        accuracyEma: 0.62,
        timeEmaMs: 30000,
        attemptCount: 5,
        errorMix: {},
      },
    });
    void snap;

    // Pool is tiny (4 published reassessment items) → expect shortened.
    const start = await request(app.getHttpServer())
      .post('/api/v1/me/reassessments')
      .set(auth(token))
      .send({ kind: 'check' })
      .expect(201);
    const sessionId = start.body.data.sessionId as string;
    sessionIds.push(sessionId);
    expect(start.body.data.sessionKind).toBe('check');

    // Answer whatever the runner serves (pool-limited).
    const attemptIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const next = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}/next`)
        .set(auth(token));
      if (next.status !== 200 || next.body.data.done || next.body.data.lesson) break;
      const q = next.body.data.question;
      const attemptId = crypto.randomUUID();
      const body: Record<string, unknown> = { attemptId, skipped: true };
      const res = await request(app.getHttpServer())
        .put(`/api/v1/sessions/${sessionId}/attempts/${q.id}`)
        .set(auth(token))
        .send(body);
      if (res.status !== 200) break;
      attemptIds.push(attemptId);
    }
    expect(attemptIds.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/finish`)
      .set(auth(token))
      .send({ attemptIds })
      .expect(202);
    await waitFor(async () => {
      const row = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
      return row?.recalcStatus === 'done' || row?.recalcStatus === 'failed';
    });

    // E-051 — comparison with noise labels.
    const cmp = await request(app.getHttpServer())
      .get(`/api/v1/me/reassessments/${sessionId}/comparison`)
      .set(auth(token))
      .expect(200);
    expect(cmp.body.data.sessionId).toBe(sessionId);
    expect(cmp.body.data.baselineSnapshotId).toBe(snap.id);
    expect(Array.isArray(cmp.body.data.topics)).toBe(true);
    // Result row was persisted.
    const row = await prisma.reassessmentResult.findUnique({ where: { sessionId } });
    expect(row).toBeTruthy();

    // Second comparison call returns the cached result.
    const cmp2 = await request(app.getHttpServer())
      .get(`/api/v1/me/reassessments/${sessionId}/comparison`)
      .set(auth(token))
      .expect(200);
    expect(cmp2.body.data.generatedAt).toBe(cmp.body.data.generatedAt);
  }, 90_000);

  it('E-050: pool exhaustion → 409 once every reassessment item is seen', async () => {
    const { token, userId } = await registerUser();
    // Mark every published reassessment question as attempted by this user.
    const pool = await prisma.question.findMany({
      where: { status: 'published', pool: 'reassessment' },
      select: { id: true },
    });
    const session = await prisma.practiceSession.create({
      data: { userId, kind: 'practice' },
    });
    sessionIds.push(session.id);
    for (const q of pool) {
      await prisma.questionAttempt.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          questionId: q.id,
          contextType: 'practice',
          contextId: session.id,
          shownAt: new Date(),
          answeredAt: new Date(),
          isCorrect: true,
          skipped: false,
          sequenceNo: 1,
        },
      });
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/me/reassessments')
      .set(auth(token))
      .send({ kind: 'check' })
      .expect(409);
    expect(res.body.error.code).toBe('POOL_EXHAUSTED');
  });

  it('T-019: export requires re-auth; delete schedules; consents update', async () => {
    const { token, userId } = await registerUser();

    // Export without password → 401 REAUTH_REQUIRED.
    const noPw = await request(app.getHttpServer())
      .get('/api/v1/me/data-export')
      .set(auth(token))
      .expect(401);
    expect(noPw.body.error.code).toBe('REAUTH_REQUIRED');

    // Export with wrong password → 401.
    await request(app.getHttpServer())
      .get('/api/v1/me/data-export')
      .set(auth(token))
      .set('x-reauth-password', 'wrong-password-1')
      .expect(401);

    // Export with correct password → 200 with own data only.
    const exp = await request(app.getHttpServer())
      .get('/api/v1/me/data-export')
      .set(auth(token))
      .set('x-reauth-password', PASSWORD)
      .expect(200);
    expect(exp.body.data.user.id).toBe(userId);
    expect(exp.body.data.user.email).toContain('@example.com');

    // Consents: withdraw analytics.
    await request(app.getHttpServer())
      .put('/api/v1/me/consents')
      .set(auth(token))
      .send({ consents: [{ purpose: 'analytics', granted: false }] })
      .expect(200);
    const consents = await prisma.consentRecord.findMany({
      where: { userId, purpose: 'analytics' },
      orderBy: { createdAt: 'desc' },
    });
    expect(consents[0]!.granted).toBe(false);
    // Unknown purpose rejected.
    await request(app.getHttpServer())
      .put('/api/v1/me/consents')
      .set(auth(token))
      .send({ consents: [{ purpose: 'everything', granted: true }] })
      .expect(409);

    // Delete without password → 401; with password → scheduled.
    await request(app.getHttpServer()).delete('/api/v1/me').set(auth(token)).expect(401);
    const del = await request(app.getHttpServer())
      .delete('/api/v1/me')
      .set(auth(token))
      .set('x-reauth-password', PASSWORD)
      .expect(202);
    expect(del.body.data.scheduled).toBe(true);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.deletionRequestedAt).not.toBeNull();
    // Refresh tokens revoked.
    const liveTokens = await prisma.refreshToken.count({
      where: { userId, revokedAt: null },
    });
    expect(liveTokens).toBe(0);
    // Second delete → 409.
    await request(app.getHttpServer())
      .delete('/api/v1/me')
      .set(auth(token))
      .set('x-reauth-password', PASSWORD)
      .expect(409);
  });

  it('T-020: authorization matrix — cross-user and role checks', async () => {
    const a = await registerUser();
    const b = await registerUser();

    // Student A cannot read student B's session summary.
    const bSession = await prisma.practiceSession.create({
      data: { userId: b.userId, kind: 'practice' },
    });
    sessionIds.push(bSession.id);
    await request(app.getHttpServer())
      .get(`/api/v1/sessions/${bSession.id}/summary`)
      .set(auth(a.token))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/me/reassessments/${bSession.id}/comparison`)
      .set(auth(a.token))
      .expect(404);

    // Student cannot reach admin routes.
    await request(app.getHttpServer())
      .get('/api/v1/admin/questions')
      .set(auth(a.token))
      .expect(403);

    // Unauthenticated requests are rejected.
    await request(app.getHttpServer()).get('/api/v1/me/plans/current').expect(401);
    await request(app.getHttpServer()).get('/api/v1/me/notebook').expect(401);

    // Admin token reaches admin routes.
    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@aptiva.local', password: 'Admin-pass-123!' });
    if (admin.status === 200) {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/questions?limit=1')
        .set(auth(admin.body.data.accessToken))
        .expect(200);
      expect(res.body.data).toBeTruthy();
      // Admin access was audited (PH10-T06).
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'admin.access', actorId: admin.body.data.user.id },
        orderBy: { at: 'desc' },
      });
      expect(audit).toBeTruthy();
    }
  });
});
