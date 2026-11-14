import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH13-T05 Integration Tests: External scores logging (manual and CSV).
 */
describe('external-scores (integration, PH13-T05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });
  const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    process.env.RATE_LIMIT_FACTOR = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    const email = `${uniq('ext-user')}@example.com`;
    const password = 'Test-Score-2026!#';
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

    // Create a second user to test isolation
    const otherEmail = `${uniq('other-ext')}@example.com`;
    const otherUser = await prisma.user.create({
      data: {
        email: otherEmail,
        passwordHash,
        role: 'student',
        emailVerifiedAt: new Date(),
      },
    });
    otherUserId = otherUser.id;
    const otherRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password });
    otherToken = otherRes.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.externalScore.deleteMany({
      where: { userId: { in: [userId, otherUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
    await app.close();
  });

  it('creates an external score manually and lists it', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me/external-scores')
      .set(auth())
      .send({
        source: 'AMCAT',
        assessmentName: 'AMCAT Placement Test',
        takenAt: '2026-10-15',
        totalScore: 780,
        maxScore: 900,
        percentile: 88.5,
        sectionScores: { quant: 820, logical: 750, verbal: 770 },
        notes: 'Good score in quantitative section',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.source).toBe('AMCAT');
    expect(res.body.data.totalScore).toBe(780);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/me/external-scores')
      .set(auth());

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].assessmentName).toBe('AMCAT Placement Test');
  });

  it('rejects invalid score where totalScore exceeds maxScore', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me/external-scores')
      .set(auth())
      .send({
        source: 'eLitmus',
        assessmentName: 'pH Test',
        takenAt: '2026-10-20',
        totalScore: 750,
        maxScore: 600, // Invalid: total > max
      });

    expect(res.status).toBe(422);
  });

  it('uploads multiple scores via CSV batch endpoint', async () => {
    const csvContent = `source,assessmentName,takenAt,totalScore,maxScore,percentile,notes
eLitmus,pH Test,2026-09-10,480,600,82.4,Good performance
CampusMock,Campus Pre-Placement,2026-10-01,72,100,75.0,College mock test
`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/me/external-scores/csv')
      .set(auth())
      .send({ csv: csvContent });

    expect(res.status).toBe(201);
    expect(res.body.data.uploadedCount).toBe(2);
    expect(res.body.data.errorsCount).toBe(0);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/me/external-scores')
      .set(auth());

    // 1 manual + 2 CSV = 3 total
    expect(listRes.body.data.length).toBe(3);
  });

  it('enforces user ownership when deleting an external score', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/me/external-scores')
      .set(auth());

    const scoreId = listRes.body.data[0].id;

    // Other user attempts to delete: 403 Forbidden
    const forbiddenRes = await request(app.getHttpServer())
      .delete(`/api/v1/me/external-scores/${scoreId}`)
      .set(auth(otherToken));

    expect(forbiddenRes.status).toBe(403);

    // Owner deletes: 200 OK
    const okRes = await request(app.getHttpServer())
      .delete(`/api/v1/me/external-scores/${scoreId}`)
      .set(auth());

    expect(okRes.status).toBe(200);
    expect(okRes.body.data.success).toBe(true);
  });
});
