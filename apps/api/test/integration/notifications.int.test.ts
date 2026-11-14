import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH13-T07 Integration Tests: Reminders & weekly summary (opt-in, student limit).
 */
describe('notifications (integration, PH13-T07)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    process.env.RATE_LIMIT_FACTOR = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const email = `${uniq('notif-user')}@example.com`;
    const password = 'Test-Notif-2026!#';
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'student',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    token = res.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.notificationPreference.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('fetches default notification preferences (opted out by default per FR-028)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/notifications/preferences')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.optInReminders).toBe(false);
    expect(res.body.data.optInWeeklySummary).toBe(false);
    expect(res.body.data.dailyLimit).toBe(1);
  });

  it('updates notification preferences with student-set limits', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/me/notifications/preferences')
      .set(auth())
      .send({
        optInReminders: true,
        optInWeeklySummary: true,
        dailyLimit: 2,
        preferredHourUtc: 16,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.optInReminders).toBe(true);
    expect(res.body.data.optInWeeklySummary).toBe(true);
    expect(res.body.data.dailyLimit).toBe(2);
    expect(res.body.data.preferredHourUtc).toBe(16);
  });

  it('returns weekly practice summary with zero-guilt messaging', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me/notifications/weekly-summary')
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.periodStart).toBeDefined();
    expect(res.body.data.periodEnd).toBeDefined();
    expect(res.body.data.optedIn).toBe(true);
    expect(res.body.data.message).toBeDefined();
    // Zero guilt check
    expect(res.body.data.message.toLowerCase()).not.toContain('lost');
    expect(res.body.data.message.toLowerCase()).not.toContain('failed');
  });
});
