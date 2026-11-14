import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH13-T02 Integration Tests: Billing, tiers, checkout orders, and idempotent webhooks.
 */
describe('billing (integration, PH13-T02)', () => {
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

    const email = `${uniq('billing-user')}@example.com`;
    const password = 'Test-Billing-2026!#';
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
    await prisma.userPass.deleteMany({ where: { userId } });
    await prisma.billingEvent.deleteMany({
      where: {
        idempotencyKey: { contains: userId },
      },
    });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('reports free tier with restricted features for new student', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/subscription').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBe('free');
    expect(res.body.data.isPassActive).toBe(false);
    expect(res.body.data.features.practicePlanCount).toBe(1);
    expect(res.body.data.features.multiTarget).toBe(false);
  });

  it('creates checkout order for Sprint Pass (14 days)', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/billing/orders').set(auth()).send({
      tier: 'sprint_14d',
      gateway: 'mock',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.tier).toBe('sprint_14d');
    expect(res.body.data.durationDays).toBe(14);
    expect(res.body.data.amountCents).toBe(79900);
  });

  it('processes payment webhook idempotently and grants pass immediately', async () => {
    const idempotencyKey = `evt_${userId}_${Date.now()}`;
    const webhookPayload = {
      idempotencyKey,
      eventType: 'payment.captured',
      gateway: 'mock',
      userId,
      tier: 'sprint_14d',
    };

    // First call: processes and grants pass
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .send(webhookPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('processed');
    expect(res1.body.data.tier).toBe('sprint_14d');
    expect(res1.body.data.passId).toBeDefined();

    // Verify subscription is now active
    const subRes = await request(app.getHttpServer()).get('/api/v1/me/subscription').set(auth());

    expect(subRes.status).toBe(200);
    expect(subRes.body.data.tier).toBe('sprint_14d');
    expect(subRes.body.data.isPassActive).toBe(true);
    expect(subRes.body.data.daysRemaining).toBeGreaterThanOrEqual(13);
    expect(subRes.body.data.features.reassessment).toBe(true);

    // Second call with same idempotencyKey: returns already_processed without duplicating pass
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/billing/webhook')
      .send(webhookPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('already_processed');
    expect(res2.body.data.idempotencyKey).toBe(idempotencyKey);

    const passes = await prisma.userPass.findMany({ where: { userId } });
    expect(passes.length).toBe(1);
  });
});
