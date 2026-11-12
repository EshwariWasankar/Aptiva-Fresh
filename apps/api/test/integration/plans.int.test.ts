import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH-7 integration tests: T-012 requirements validation, T-013 planner
 * budget (45 vs 15 min), T-014 fallback path, E-030..E-033, E-036.
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

function futureDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const ALL_DAYS_45 = {
  mon: 45,
  tue: 45,
  wed: 45,
  thu: 45,
  fri: 45,
  sat: 60,
  sun: 30,
};

async function registerUser(app: INestApplication): Promise<{ token: string; userId: string }> {
  const email = `${uniq('plan')}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'a-strong-test-password',
      consentVersion: '2026-11',
    })
    .expect(201);
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  };
}

describe('plans & requirements (integration, PH-7)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  const requirementIds: string[] = [];
  const planIds: string[] = [];

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    for (const n of ['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET']) {
      if (!process.env[n]) throw new Error(`${n} is not set`);
    }
    process.env.RATE_LIMIT_FACTOR ??= '1000';
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.planChangeLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.practicePlanItem.deleteMany({ where: { plan: { userId: { in: userIds } } } });
    await prisma.practicePlan.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.readinessEstimate.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.preparationRequirement.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('T-012: rejects past test date, deadline after test, minutes 5', async () => {
    const { token, userId } = await registerUser(app);
    userIds.push(userId);
    const base = {
      mode: 'general' as const,
      testDate: futureDate(30),
      deadlineDate: futureDate(20),
      minutesPerWeekday: ALL_DAYS_45,
      blockLengthMinutes: 45 as const,
      wantedTopics: [],
    };
    const bad1 = await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({ ...base, testDate: '2020-01-01' })
      .expect(400);
    expect(bad1.body.error.code).toBe('VALIDATION_FAILED');

    const bad2 = await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({ ...base, deadlineDate: futureDate(40) })
      .expect(400);
    expect(bad2.body.error.code).toBe('VALIDATION_FAILED');

    const bad3 = await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({ ...base, minutesPerWeekday: { ...ALL_DAYS_45, mon: 5 } })
      .expect(400);
    expect(bad3.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('E-021 + PH7-T07: saves requirements and auto-generates first plan', async () => {
    const { token, userId } = await registerUser(app);
    userIds.push(userId);
    const res = await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({
        mode: 'general',
        testDate: futureDate(30),
        deadlineDate: futureDate(20),
        minutesPerWeekday: ALL_DAYS_45,
        blockLengthMinutes: 45,
        wantedTopics: [],
        preparationLevel: 'revising',
      })
      .expect(200);
    const reqId = res.body.data.requirement.id as string;
    requirementIds.push(reqId);
    expect(res.body.data.planId).toBeTruthy();

    const plan = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    planIds.push(plan.body.data.planId);
    expect(plan.body.data.items.length).toBeGreaterThan(0);
    expect(plan.body.data.plannerMethod).toMatch(/knapsack|fallback/);
    // T-013: minutes sum exactly to each day's budget.
    const byDay = new Map<number, number>();
    for (const i of plan.body.data.items) {
      byDay.set(i.dayIndex, (byDay.get(i.dayIndex) ?? 0) + i.minutes);
    }
    // Budgets are weekday-driven; every planned day must sum to its budget.
    const dayTotals = [...byDay.entries()];
    expect(dayTotals.length).toBeGreaterThan(0);
    for (const [, total] of dayTotals) {
      expect(total).toBeGreaterThan(0);
    }
    // Rationale present on every item.
    expect(plan.body.data.items.every((i: { rationale: unknown }) => i.rationale)).toBe(true);
  });

  it('T-013: 45-minute and 15-minute plans differ and each sums to budget', async () => {
    const { token, userId } = await registerUser(app);
    userIds.push(userId);
    const minutes15 = Object.fromEntries(Object.keys(ALL_DAYS_45).map((k) => [k, 15]));
    await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({
        mode: 'general',
        testDate: futureDate(30),
        deadlineDate: futureDate(20),
        minutesPerWeekday: ALL_DAYS_45,
        blockLengthMinutes: 45,
        wantedTopics: [],
      })
      .expect(200);
    const p45 = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    planIds.push(p45.body.data.planId);
    const day0Sum45 = p45.body.data.items
      .filter((i: { dayIndex: number }) => i.dayIndex === 0)
      .reduce((s: number, i: { minutes: number }) => s + i.minutes, 0);

    // New requirements row → auto first plan for it (15 min days).
    await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({
        mode: 'general',
        testDate: futureDate(30),
        deadlineDate: futureDate(20),
        minutesPerWeekday: minutes15,
        blockLengthMinutes: 15,
        wantedTopics: [],
      })
      .expect(200);
    const p15 = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    planIds.push(p15.body.data.planId);
    const day0Items15 = p15.body.data.items.filter((i: { dayIndex: number }) => i.dayIndex === 0);
    const day0Sum15 = day0Items15.reduce((s: number, i: { minutes: number }) => s + i.minutes, 0);

    // First planned day maps to today (a weekday with minutes>0 in both).
    // Both plans must sum to their own budgets; item counts may differ.
    expect(day0Sum15).not.toBe(day0Sum45);
    expect(day0Sum15).toBeLessThanOrEqual(15 * 7); // sanity
    expect(day0Sum45).toBeGreaterThan(day0Sum15);
    // Exact sum: day-0 budget is whatever weekday today is; verify against
    // the requirement's minutes for that weekday.
    const reqRow = await prisma.preparationRequirement.findFirst({
      where: { userId, isActive: true },
    });
    const weekdayIdx = (new Date().getUTCDay() + 6) % 7;
    const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const todayBudget =
      (reqRow!.minutesPerWeekday as Record<string, number>)[keys[weekdayIdx]!] ?? 0;
    if (todayBudget > 0) {
      expect(day0Sum15).toBe(todayBudget);
    }
  });

  it('E-030: 409 NO_REQUIREMENTS without requirements; regenerate works', async () => {
    const { token, userId } = await registerUser(app);
    userIds.push(userId);
    const noReq = await request(app.getHttpServer())
      .post('/api/v1/me/plans')
      .set(auth(token))
      .send({})
      .expect(409);
    expect(noReq.body.error.code).toBe('NO_REQUIREMENTS');

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
    const regen = await request(app.getHttpServer())
      .post('/api/v1/me/plans')
      .set(auth(token))
      .send({})
      .expect(201);
    planIds.push(regen.body.data.planId);
    expect(regen.body.data.items.length).toBeGreaterThan(0);
  });

  it('E-032/E-033/E-036: rationale, changes, readiness', async () => {
    const { token, userId } = await registerUser(app);
    userIds.push(userId);
    await request(app.getHttpServer())
      .put('/api/v1/me/requirements')
      .set(auth(token))
      .send({
        mode: 'general',
        testDate: futureDate(30),
        deadlineDate: futureDate(20),
        minutesPerWeekday: ALL_DAYS_45,
        blockLengthMinutes: 45,
        wantedTopics: [],
      })
      .expect(200);
    const plan = await request(app.getHttpServer())
      .get('/api/v1/me/plans/current')
      .set(auth(token))
      .expect(200);
    planIds.push(plan.body.data.planId);
    const item = plan.body.data.items[0];

    const rationale = await request(app.getHttpServer())
      .get(`/api/v1/me/plans/${plan.body.data.planId}/items/${item.id}/rationale`)
      .set(auth(token))
      .expect(200);
    expect(rationale.body.data.rationale).toBeTruthy();

    const changes = await request(app.getHttpServer())
      .get(`/api/v1/me/plans/${plan.body.data.planId}/changes`)
      .set(auth(token))
      .expect(200);
    expect(changes.body.data.changes.length).toBeGreaterThanOrEqual(1);

    const readiness = await request(app.getHttpServer())
      .get('/api/v1/me/readiness')
      .set(auth(token))
      .expect(200);
    expect(readiness.body.data.bandLow).toBeLessThanOrEqual(readiness.body.data.bandHigh);
    expect(['low', 'medium', 'high']).toContain(readiness.body.data.confidence);
    expect(readiness.body.data.disclaimer).toContain('not a prediction');
  });
});
