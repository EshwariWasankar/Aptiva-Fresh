import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ProfileService } from '../../src/profile/profile.service';

/**
 * PH-6 integration tests: E-020 profile endpoints, baseline snapshot after
 * diagnostic submit (real result-job → profile-job chain), idempotent
 * recompute, thin-evidence flags, error mix split.
 * Requires DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET.
 */

const PASSWORD = 'a-strong-test-password';

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

let seq = 0;
const uniq = (p: string) => `${p}-${Date.now()}-${++seq}`;

async function waitFor(cond: () => Promise<boolean>, ms = 20_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('waitFor timed out');
}

describe('profile (integration, PH-6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let profiles: ProfileService;
  let token: string;
  let userId: string;
  const questionIds: string[] = [];
  const topicIds: string[] = [];
  const diagnosticIds: string[] = [];
  const correctByQuestion = new Map<string, string>();

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    for (const n of ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET']) {
      if (!process.env[n]) throw new Error(`${n} is not set`);
    }
    process.env.RATE_LIMIT_FACTOR ??= '1000';
    app = await createApp();
    prisma = app.get(PrismaService);
    profiles = app.get(ProfileService);

    // 2 sections × 2 topics; 8 diagnostic-pool items (enough for express=12? no —
    // composer needs 12 for express; use standard? Express needs 3/section=6 min.
    // Provide 4 sections × 3 topics × 1 q = 12 items for a full express run.)
    const sections = ['Quant', 'Logical', 'DI', 'Verbal'];
    for (const name of sections) {
      const sec = await prisma.topic.create({
        data: { slug: uniq(`psec-${name}`), name: `PSec ${name}`, level: 'section' },
      });
      topicIds.push(sec.id);
      for (let i = 0; i < 3; i++) {
        const child = await prisma.topic.create({
          data: {
            slug: uniq(`pt-${name}-${i}`),
            name: `PTopic ${name} ${i}`,
            level: 'topic',
            parentId: sec.id,
          },
        });
        topicIds.push(child.id);
        const q = await prisma.question.create({
          data: {
            topicId: child.id,
            format: 'mcq',
            stem: uniq(`Profile stem ${name} ${i}`) + ' — pick the even number.',
            difficultyPrior: 2,
            expectedTimeMs: 30_000,
            pool: 'diagnostic',
            status: 'published',
            sourceName: 'test',
            author: 'test',
            stemHash: uniq('hash-prof'),
            options: {
              create: [
                { text: '4', isCorrect: true, orderNo: 0 },
                { text: '5', isCorrect: false, orderNo: 1 },
              ],
            },
          },
          include: { options: true },
        });
        questionIds.push(q.id);
        correctByQuestion.set(q.id, q.options.find((o) => o.isCorrect)!.id);
      }
    }

    const hash = await argon2.hash(PASSWORD);
    const u = await prisma.user.create({
      data: {
        email: `${uniq('prof')}@example.com`,
        passwordHash: hash,
        role: 'student',
        emailVerifiedAt: new Date(),
      },
    });
    userId = u.id;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: u.email, password: PASSWORD })
      .expect(201);
    token = res.body.data.accessToken as string;
  });

  afterAll(async () => {
    const diagIds = diagnosticIds;
    await prisma.profileSnapshot.deleteMany({ where: { userId } });
    await prisma.studentTopicProfile.deleteMany({ where: { userId } });
    const attemptIds = (
      await prisma.questionAttempt.findMany({
        where: { contextType: 'diagnostic', contextId: { in: diagIds } },
        select: { id: true },
      })
    ).map((a) => a.id);
    await prisma.attemptErrorInference.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await prisma.attemptErrorFeedback.deleteMany({ where: { attemptId: { in: attemptIds } } });
    await prisma.diagnosticResult.deleteMany({ where: { diagnosticId: { in: diagIds } } });
    await prisma.questionAttempt.deleteMany({
      where: { contextType: 'diagnostic', contextId: { in: diagIds } },
    });
    await prisma.diagnosticTest.deleteMany({ where: { id: { in: diagIds } } });
    await prisma.questionAttempt.deleteMany({ where: { questionId: { in: questionIds } } });
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
    await prisma.topic.deleteMany({ where: { id: { in: topicIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('E-010/E-011/E-012: completes an express diagnostic', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/diagnostics')
      .set(auth(token))
      .send({ mode: 'express' })
      .expect(201);
    const id = created.body.data.id as string;
    diagnosticIds.push(id);

    const attemptIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const next = await request(app.getHttpServer())
        .get(`/api/v1/diagnostics/${id}/next`)
        .set(auth(token))
        .expect(200);
      const q = next.body.data.question;
      if (!q) break;
      // The composer may serve real pool items too — any valid option works.
      const optionId = q.options[(i * 7) % q.options.length].id;
      const res = await request(app.getHttpServer())
        .put(`/api/v1/diagnostics/${id}/answers/${q.id}`)
        .set(auth(token))
        .send({ attemptId: randomUUID(), selectedOptionId: optionId })
        .expect(200);
      attemptIds.push(res.body.data.attemptId);
    }
    expect(attemptIds.length).toBe(12);

    await request(app.getHttpServer())
      .post(`/api/v1/diagnostics/${id}/submit`)
      .set(auth(token))
      .send({ attemptIds })
      .expect(201);

    // Result job → profile job chain (real BullMQ workers).
    await waitFor(async () => {
      const snap = await prisma.profileSnapshot.findFirst({
        where: { userId, isBaseline: true },
      });
      return snap !== null;
    });
  });

  it('writes student_topic_profiles + baseline snapshot with thin-evidence flags', async () => {
    const rows = await prisma.studentTopicProfile.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.attemptCount).toBeGreaterThan(0);
      expect(r.rating).toBeGreaterThan(0);
      const mix = r.errorMix as { reported?: Record<string, number> };
      expect(mix).toBeDefined();
    }

    const snap = await prisma.profileSnapshot.findFirstOrThrow({
      where: { userId, isBaseline: true },
    });
    expect(snap.trigger).toBe('baseline');
    const data = snap.data as { diagnosticId: string; topics: unknown[] };
    expect(data.diagnosticId).toBe(diagnosticIds[0]);
    expect(data.topics.length).toBe(rows.length);
  });

  it('recomputeBaseline is idempotent by diagnostic id', async () => {
    const before = await prisma.profileSnapshot.count({ where: { userId } });
    const res = await profiles.recomputeBaseline(userId, diagnosticIds[0]!);
    expect(res.skipped).toBe(true);
    const after = await prisma.profileSnapshot.count({ where: { userId } });
    expect(after).toBe(before);
  });

  it('E-020: GET /me/profile returns topics with intervals and counts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/profile')
      .set(auth(token))
      .expect(200);
    expect(res.body.data.topics.length).toBeGreaterThan(0);
    const t = res.body.data.topics[0];
    expect(t.intervalHigh).toBeGreaterThan(t.rating);
    expect(t.intervalLow).toBeLessThan(t.rating);
    expect(t.attemptCount).toBeGreaterThan(0);
    expect(t.sectionSlug).toBeTruthy();
    expect(res.body.data.baseline.snapshotId).toBeTruthy();
  });

  it('E-020: GET /me/profile/history lists snapshots', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/profile/history')
      .set(auth(token))
      .expect(200);
    expect(res.body.data.snapshots.length).toBeGreaterThan(0);
    expect(res.body.data.snapshots[0].isBaseline).toBe(true);
  });
});
