import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH13-T04 Integration Tests: Commitments & streaks with rest days and neutral wording.
 */
describe('commitments (integration, PH13-T04)', () => {
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

    const email = `${uniq('streak-user')}@example.com`;
    const password = 'Test-Streak-2026!#';
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
    await prisma.practiceDay.deleteMany({ where: { userId } });
    await prisma.userCommitment.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('returns null when student has no active commitment', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/commitment').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.commitment).toBeNull();
    expect(res.body.data.evaluation).toBeNull();
  });

  it('sets a days streak commitment and evaluates active progress with neutral wording', async () => {
    const res = await request(app.getHttpServer()).put('/api/v1/me/commitment').set(auth()).send({
      type: 'days',
      target: 7,
      restDaysAllowed: 1,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.commitment).toBeDefined();
    expect(res.body.data.commitment.target).toBe(7);
    expect(res.body.data.commitment.status).toBe('active');
    expect(res.body.data.evaluation.text).toContain('Day 0 of 7 done.');
  });

  it('records practice activity and increments day streak', async () => {
    const activityRes = await request(app.getHttpServer())
      .post('/api/v1/me/commitment/activity')
      .set(auth())
      .send({
        activeSeconds: 700,
        questionsAnswered: 12,
      });

    expect(activityRes.status).toBe(201);
    expect(activityRes.body.data.evaluation.status).toBe('active');
    expect(activityRes.body.data.evaluation.daysDone).toBe(1);
    expect(activityRes.body.data.evaluation.text).toBe('Day 1 of 7 done.');
  });

  it('sets a minutes target commitment and updates progress', async () => {
    const res = await request(app.getHttpServer()).put('/api/v1/me/commitment').set(auth()).send({
      type: 'minutes',
      target: 30,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.commitment.type).toBe('minutes');
    expect(res.body.data.commitment.target).toBe(30);
    // Previous activity was 700s ≈ 11 min
    expect(res.body.data.evaluation.minutesDone).toBeGreaterThanOrEqual(11);
    expect(res.body.data.evaluation.text).toContain('minutes done.');
  });

  it('ends commitment cleanly with neutral wording', async () => {
    const res = await request(app.getHttpServer()).delete('/api/v1/me/commitment').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe(
      'This commitment has ended. You can start a new one whenever you like.',
    );

    const check = await request(app.getHttpServer()).get('/api/v1/me/commitment').set(auth());
    expect(check.body.data.commitment).toBeNull();
  });
});
