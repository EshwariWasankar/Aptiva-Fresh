import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../common/config/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../common/audit/audit.service';

export const PRIVACY_QUEUE = 'aptiva-privacy';
const DELETION_DELAY_DAYS = 30;
const ALLOWED_PURPOSES = new Set(['analytics', 'marketing', 'support']);

/**
 * PH10-T01 — data export, account deletion, consent withdrawal (E-070..72).
 * Deletion is scheduled (30 days) and executed by a BullMQ job; the audit
 * record stores no personal content beyond the user id.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly audit: AuditService,
  ) {}

  private async requirePassword(userId: string, password: string | undefined) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    if (user.passwordHash) {
      const ok = password ? await this.password.verify(user.passwordHash, password) : false;
      if (!ok) {
        throw new UnauthorizedException({
          code: 'REAUTH_REQUIRED',
          message: 'Re-enter your password to continue',
        });
      }
    }
    // Google-only accounts have no password; a fresh access token is the
    // re-auth proof (token lifetime is 15 min).
    return user;
  }

  /** E-070 — full data export (JSON). */
  async exportData(userId: string, password: string | undefined) {
    const user = await this.requirePassword(userId, password);
    const [
      profile,
      topicProfiles,
      snapshots,
      requirements,
      plans,
      sessions,
      attempts,
      diagnostics,
      mistakes,
      consents,
    ] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId } }),
      this.prisma.studentTopicProfile.findMany({ where: { userId } }),
      this.prisma.profileSnapshot.findMany({ where: { userId }, orderBy: { takenAt: 'desc' } }),
      this.prisma.preparationRequirement.findMany({ where: { userId } }),
      this.prisma.practicePlan.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.practiceSession.findMany({ where: { userId }, orderBy: { startedAt: 'desc' } }),
      this.prisma.questionAttempt.findMany({
        where: { userId },
        orderBy: { answeredAt: 'asc' },
        take: 5000,
      }),
      this.prisma.diagnosticTest.findMany({ where: { userId } }),
      this.prisma.mistakeEntry.findMany({ where: { userId } }),
      this.prisma.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    await this.audit.record({
      actorId: userId,
      action: 'privacy.data_exported',
      objectType: 'user',
      objectId: userId,
    });
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        deletionRequestedAt: user.deletionRequestedAt,
        planSettings: user.planSettings,
      },
      profile,
      topicProfiles,
      snapshots,
      requirements,
      plans,
      sessions,
      attempts,
      diagnostics,
      mistakes,
      consents,
    };
  }

  /** E-071 — schedule account deletion (executes after 30 days). */
  async requestDeletion(userId: string, password: string | undefined) {
    const user = await this.requirePassword(userId, password);
    if (user.deletionRequestedAt) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Deletion already scheduled' });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { deletionRequestedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    await this.audit.record({
      actorId: userId,
      action: 'account.deletion_requested',
      objectType: 'user',
      objectId: userId,
      details: { scheduledInDays: DELETION_DELAY_DAYS },
    });
    return {
      scheduled: true,
      deletionAfter: new Date(now.getTime() + DELETION_DELAY_DAYS * 86_400_000).toISOString(),
    };
  }

  /** E-072 — consent withdrawal (optional purposes only). */
  async updateConsents(userId: string, consents: { purpose: string; granted: boolean }[]) {
    const noticeVersion = process.env.NOTICE_VERSION ?? '2026-11';
    for (const c of consents) {
      if (!ALLOWED_PURPOSES.has(c.purpose)) {
        throw new ConflictException({
          code: 'VALIDATION_FAILED',
          message: `Unknown consent purpose: ${c.purpose}`,
        });
      }
      await this.prisma.consentRecord.create({
        data: { userId, noticeVersion, purpose: c.purpose, granted: c.granted },
      });
    }
    await this.audit.record({
      actorId: userId,
      action: 'consent.updated',
      objectType: 'user',
      objectId: userId,
      details: { purposes: consents.map((c) => c.purpose) },
    });
    return { updated: consents.length };
  }
}

/**
 * PH10-T01/T-09 — deletion + retention worker.
 * Daily repeatable jobs delete users whose 30-day window elapsed and
 * purge expired auth tokens, old revoked tokens and old audit logs.
 */
@Injectable()
export class PrivacyJobService {
  private readonly logger = new Logger(PrivacyJobService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: Redis | null = null;
  private available = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!(await this.redis.ping())) return;
    this.connection = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
    const connection = this.connection;
    this.queue = new Queue(PRIVACY_QUEUE, { connection });
    this.worker = new Worker(
      PRIVACY_QUEUE,
      async (job) => {
        if (job.name === 'process-deletions') await this.processDeletions();
        if (job.name === 'retention-sweep') await this.retentionSweep();
      },
      { connection, concurrency: 1 },
    );
    await this.queue.upsertJobScheduler(
      'daily-deletions',
      { pattern: '15 3 * * *' },
      { name: 'process-deletions', data: {} },
    );
    await this.queue.upsertJobScheduler(
      'daily-retention',
      { pattern: '45 3 * * *' },
      { name: 'retention-sweep', data: {} },
    );
    this.available = true;
  }

  private async processDeletions(): Promise<void> {
    const cutoff = new Date(Date.now() - DELETION_DELAY_DAYS * 86_400_000);
    const due = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { lte: cutoff } },
      select: { id: true },
      take: 100,
    });
    for (const u of due) {
      await this.prisma.user.delete({ where: { id: u.id } });
      await this.audit.record({
        action: 'account.deleted',
        objectType: 'user',
        objectId: u.id,
      });
      this.logger.log(`deleted user ${u.id} (retention window elapsed)`);
    }
  }

  private async retentionSweep(): Promise<void> {
    const now = new Date();
    await this.prisma.authToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] },
    });
    const rtCutoff = new Date(now.getTime() - 90 * 86_400_000);
    await this.prisma.refreshToken.deleteMany({
      where: { revokedAt: { lt: rtCutoff } },
    });
    const auditCutoff = new Date(now.getTime() - 400 * 86_400_000);
    await this.prisma.auditLog.deleteMany({ where: { at: { lt: auditCutoff } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit().catch(() => this.connection?.disconnect());
  }
}
