import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../common/config/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { ProfileService } from '../profile/profile.service';
import { PlansService } from '../plans/plans.service';

export const RECALC_QUEUE = 'aptiva-recalc'; // default; env.RECALC_QUEUE_NAME overrides

export interface RecalcJobData {
  sessionId: string;
  userId: string;
}

/**
 * PH8-T03 — post-session recalculation (BullMQ).
 * Pipeline: flush barrier already ran at finish → this job updates topic
 * profiles from ALL persisted attempts → session snapshot → readiness
 * estimate → regenerates future plan days only → change log (top 3).
 *
 * Idempotent: per-user advisory lock + per-step markers (snapshot keyed
 * by sessionId, change log keyed by summary.sessionId) + CAS on
 * recalc_status. Recalculation failure never blocks practice — the
 * session stays finished and the student sees a neutral retry banner.
 */
@Injectable()
export class RecalcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecalcService.name);
  private queue: Queue<RecalcJobData> | null = null;
  private worker: Worker<RecalcJobData> | null = null;
  private connection: Redis | null = null;
  private available = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly moduleRef: ModuleRef,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!(await this.redis.ping())) {
      this.logger.warn('Redis unreachable at boot — recalc queue disabled until restart');
      return;
    }
    await this.startWorkers();
  }

  private async startWorkers(): Promise<void> {
    this.connection = new Redis(this.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    const connection = this.connection;
    this.queue = new Queue<RecalcJobData>(this.env.RECALC_QUEUE_NAME, { connection });
    this.worker = new Worker<RecalcJobData>(
      this.env.RECALC_QUEUE_NAME,
      async (job) => {
        const { sessionId, userId } = job.data;
        const session = await this.prisma.practiceSession.findUnique({
          where: { id: sessionId },
        });
        if (!session || session.recalcStatus !== 'pending') return; // idempotent

        // Per-user serialisation: recalculation is a pure function of
        // persisted attempts, so a retried job converges to the same state.
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

          const profiles = this.moduleRef.get(ProfileService, { strict: false });
          await profiles.recomputeSession(userId, sessionId);

          const plans = this.moduleRef.get(PlansService, { strict: false });
          await plans.regenerateFutureDays(userId, sessionId);

          await tx.practiceSession.updateMany({
            where: { id: sessionId, recalcStatus: 'pending' },
            data: { recalcStatus: 'done' },
          });
        });
        this.logger.log(`recalc done session=${sessionId} user=${userId}`);
      },
      { connection, concurrency: 4 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`recalc job ${job?.id} failed: ${err.message}`);
      // Final failure → neutral 'failed' status + retry action for the student.
      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = job?.opts.attempts ?? 3;
      if (job && attemptsMade >= maxAttempts) {
        void this.prisma.practiceSession
          .updateMany({
            where: { id: job.data.sessionId, recalcStatus: 'pending' },
            data: { recalcStatus: 'failed' },
          })
          .catch(() => undefined);
      }
    });
    this.available = true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit();
  }

  async enqueueRecalc(data: RecalcJobData): Promise<void> {
    if (!this.available) {
      if (!(await this.redis.ping())) {
        throw new Error('recalc queue unavailable: Redis unreachable');
      }
      await this.startWorkers();
    }
    await this.queue!.add('session-recalc', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }
}
