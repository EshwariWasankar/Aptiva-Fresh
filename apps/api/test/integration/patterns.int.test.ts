import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * PH13-T06 Integration Tests: Structural pattern reports and drift alerts.
 */
describe('patterns (integration, PH13-T06)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentToken: string;
  let adminToken: string;
  let studentId: string;
  let adminId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    process.env.RATE_LIMIT_FACTOR = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Student
    const studentEmail = `${uniq('student-pat')}@example.com`;
    const password = 'Test-Pattern-2026!#';
    const passwordHash = await argon2.hash(password);
    const student = await prisma.user.create({
      data: {
        email: studentEmail,
        passwordHash,
        role: 'student',
        emailVerifiedAt: new Date(),
      },
    });
    studentId = student.id;
    const sLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: studentEmail, password });
    studentToken = sLogin.body.data.accessToken;

    // Admin
    const adminEmail = `${uniq('admin-pat')}@example.com`;
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'admin',
        emailVerifiedAt: new Date(),
      },
    });
    adminId = admin.id;
    const aLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password });
    adminToken = aLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.patternReport.deleteMany({
      where: { userId: { in: [studentId, adminId] } },
    });
    await prisma.patternDriftAlert.deleteMany({
      where: { company: 'Sample Company' },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [studentId, adminId] } },
    });
    await app.close();
  });

  it('submits a structural pattern report successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pattern-reports')
      .set(auth(studentToken))
      .send({
        company: 'Sample Company',
        field: 'numQuestions',
        claim: {
          quant: 25,
          logical: 25,
          verbal: 20,
          totalDurationMinutes: 90,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.company).toBe('Sample Company');
  });

  it('strictly rejects free-text question content in pattern report (FR-025, E-092)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/pattern-reports')
      .set(auth(studentToken))
      .send({
        company: 'Sample Company',
        field: 'numQuestions',
        claim: {
          leakedQuestion: 'What is the sum of first 10 prime numbers? A) 129 B) 130',
        },
      });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('Structure only; free-text question content rejected');
  });

  it('allows admin to list and review pattern report', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/pattern-reports?company=Sample%20Company')
      .set(auth(adminToken));

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
    const reportId = listRes.body.data[0].id;

    const reviewRes = await request(app.getHttpServer())
      .patch(`/api/v1/pattern-reports/${reportId}/review`)
      .set(auth(adminToken))
      .send({ status: 'approved' });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.status).toBe('approved');
  });

  it('allows admin to manage company pattern drift alerts', async () => {
    // Admin creates drift alert
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/admin/drift-alerts')
      .set(auth(adminToken))
      .send({
        company: 'Sample Company',
        section: 'Quantitative',
        oldWeight: 0.25,
        newWeight: 0.4,
        severity: 'high',
        notes: 'Significant weight shift towards quantitative aptitude detected in recent drive',
      });

    expect(createRes.status).toBe(201);
    const alertId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('open');

    // Admin lists drift alerts
    const listAlerts = await request(app.getHttpServer())
      .get('/api/v1/admin/drift-alerts?company=Sample%20Company')
      .set(auth(adminToken));

    expect(listAlerts.status).toBe(200);
    expect(listAlerts.body.data.some((a: { id: string }) => a.id === alertId)).toBe(true);

    // Admin resolves drift alert
    const resolveRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/drift-alerts/${alertId}/resolve`)
      .set(auth(adminToken))
      .send({
        status: 'resolved',
        notes: 'Updated blueprint version to match new section weights',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
  });
});
