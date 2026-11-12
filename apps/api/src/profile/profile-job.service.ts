import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ENV, type Env } from '../common/config/env';
import { RedisService } from '../common/redis/redis.service';
import { ProfileService } from './profile.service';

/**
 * PH6-T04 — baseline profile recomputation queue.
 * Enqueued after the diagnostic result job completes (post flush barrier).
 * Idempotent by diagnostic id inside ProfileService.recomputeBaseline.
 */
@Injectable()
export class ProfileJobService {
  private readonly logger = new Logger(ProfileJobService.name);
  private queue: Queue<{ diagnosticId: string; userId: string }> | null = null;
  private worker: Worker<{ diagnosticId: string; userId: string }> | null = null;
  private connection: Redis | null = null;
  private available = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!(await this.redis.ping())) {
      this.logger.warn('Redis unreachable at boot — profile queue disabled');
      return;
    }
    this.connection = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: null });
    const connection = this.connection;
    this.queue = new Queue(this.env.PROFILE_QUEUE_NAME, { connection });
    this.worker = new Worker(
      this.env.PROFILE_QUEUE_NAME,
      async (job) => {
        const svc = this.moduleRef.get(ProfileService, { strict: false });
        await svc.recomputeBaseline(job.data.userId, job.data.diagnosticId);
      },
      { connection, concurrency: 2 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`profile job ${job?.id} failed: ${err.message}`);
    });
    this.available = true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.connection?.quit().catch(() => this.connection?.disconnect());
  }

  async enqueue(diagnosticId: string, userId: string): Promise<void> {
    if (!this.available || !this.queue) return;
    await this.queue.add('recompute', { diagnosticId, userId }, { removeOnComplete: 100 });
  }
}
