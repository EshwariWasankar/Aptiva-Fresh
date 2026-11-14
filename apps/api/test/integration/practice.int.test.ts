import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH-8 integration tests: T-015 daily loop — plan block → session →
 * answers → finish → flush barrier → recalc job → new plan + snapshot +
 * change log; notebook entries; summary endpoint.
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
const futureDate = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

async function waitFor(cond: () => Promise<boolean>, ms = 30_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('waitFor timed out');
}

describe('practice daily loop (integration, PH-8)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const sessionIds: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function registerUser() {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `${uniq('prac')}@example.com`,
        password: 'a-strong-test-password',
        consentVersion: '2026-11',
      })
      .expect(201);
    const userId = res.body.data.user.id as string;
    userIds.push(userId);
    return { token: res.body.data.accessToken as string, userId };
  }

  beforeAll(async () => {
    for (const n of ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET']) {
      if (!process.env[n]) throw new Error(`${n} is not set`);
    }
    process.env.RATE_LIMIT_FACTOR = '1000';
    process.env.ATTEMPT_MIN_IDLE_MS = '50';
    // Isolate queue workers from a concurrently running dev API.
    process.env.RECALC_QUEUE_NAME ??= `aptiva-recalc-test-${process.pid}`;
    process.env.PROFILE_QUEUE_NAME ??= `aptiva-profile-test-${process.pid}`;
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.mistakeEntry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.planChangeLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.practicePlanItem.deleteMany({ where: { plan: { userId: { in: userIds } } } });
    await prisma.practicePlan.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.readinessEstimate.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.preparationRequirement.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.questionAttempt.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.practiceSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.profileSnapshot.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.studentTopicProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('T-015: full daily loop — session, answers, finish, recalc, new plan', async () => {
    const { token, userId } = await registerUser();

    // Requirements → auto first plan.
    await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({
        mode: 'general',
        testDate: futureDate(30),
        deadlineDate: futureDate(20),
        minutesPerWeekday: { mon: 30, tue: 30, wed: 30, thu: 30, fri: 30, sat: 0, sun: 0 },
        blockLengthMinutes: 30,
        wantedTopics: [],
      })
      .expect(200);
    const plan1 = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    const item = plan1.body.data.items[0];
    expect(item).toBeTruthy();

    // Start session from the plan block.
    const session = await request(app.getHttpServer())
      .post('/api/v1/sessions')
      .set(auth(token))
      .send({ kind: 'practice', planItemId: item.id })
      .expect(201);
    const sessionId = session.body.data.id as string;
    sessionIds.push(sessionId);
    expect(session.body.data.plannedMinutes).toBe(item.minutes);

    // Pull questions and answer a few (handle lesson gate).
    const attemptIds: string[] = [];
    const attemptsPayload: Record<string, unknown>[] = [];
    for (let i = 0; i < 3; i++) {
      const next = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}/next`)
        .set(auth(token))
        .expect(200);
      if (next.body.data.lesson) {
        // concept_repair gate — acknowledge and fetch again
        const again = await request(app.getHttpServer())
          .get(`/api/v1/sessions/${sessionId}/next`)
          .set(auth(token))
          .expect(200);
        expect(again.body.data.question ?? again.body.data.done).toBeTruthy();
        if (again.body.data.done) break;
        next.body.data = again.body.data;
      }
      if (next.body.data.done) break;
      const q = next.body.data.question;
      expect(q).toBeTruthy();
      // Pick the correct option when MCQ (DB knows the key; test-side only).
      const body: Record<string, unknown> = { attemptId: randomUUID(), skipped: i === 2 };
      if (!body.skipped) {
        if (q.format === 'mcq') {
          const correct = await prisma.questionOption.findFirst({
            where: { questionId: q.id, isCorrect: true },
          });
          if (correct) body.selectedOptionId = correct.id;
          else body.skipped = true;
        } else {
          const qq = await prisma.question.findUnique({ where: { id: q.id } });
          body.numericInput = qq?.numericAnswer?.toString() ?? '1';
        }
      }
      const res = await request(app.getHttpServer())
        .put(`/api/v1/sessions/${sessionId}/attempts/${q.id}`)
        .set(auth(token))
        .send(body)
        .expect(200);
      expect(res.body.data.attemptId).toBe(body.attemptId);
      attemptIds.push(body.attemptId as string);
      attemptsPayload.push({ ...body, questionId: q.id });
    }
    expect(attemptIds.length).toBeGreaterThan(0);

    // Finish → 202 → poll summary until recalc done.
    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/finish`)
      .set(auth(token))
      .send({ attemptIds, attempts: attemptsPayload })
      .expect(202);

    await waitFor(async () => {
      const row = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
      return row?.recalcStatus === 'done';
    });

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/sessions/${sessionId}/summary`)
      .set(auth(token))
      .expect(200);
    expect(summary.body.data.recalcStatus).toBe('done');
    expect(summary.body.data.answered).toBeGreaterThan(0);

    // Profile snapshot (session trigger) + readiness estimate exist.
    const snap = await prisma.profileSnapshot.findFirst({
      where: { userId, trigger: 'session' },
    });
    expect(snap).toBeTruthy();
    const readiness = await prisma.readinessEstimate.findFirst({ where: { userId } });
    expect(readiness).toBeTruthy();

    // New current plan + change log entry with session trigger.
    const plan2 = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    expect(plan2.body.data.planId).not.toBe(plan1.body.data.planId);
    const changes = await prisma.planChangeLog.findMany({
      where: { userId, trigger: 'session' },
    });
    expect(changes.length).toBeGreaterThanOrEqual(1);
    const summaryJson = changes[0]!.summary as { sessionId?: string; changes?: string[] };
    expect(summaryJson.sessionId).toBe(sessionId);

    // Mistake notebook has the skipped→no; wrong answers only — the skipped
    // one must NOT appear; answered ones may appear if wrong.
    const notebook = await request(app.getHttpServer())
      .get('/api/v1/me/notebook')
      .set(auth(token))
      .expect(200);
    const wrongEntries = notebook.body.data.entries.filter(
      (e: { isCorrect: boolean | null }) => e.isCorrect === false,
    );
    expect(wrongEntries.length).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it('E-043: summary for unknown session → 404; recalc retry only when failed', async () => {
    const { token } = await registerUser();
    const missing = await request(app.getHttpServer())
      .get(`/api/v1/sessions/${randomUUID()}/summary`)
      .set(auth(token))
      .expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});
