import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export type ReassessmentKind = 'check' | 'topic' | 'mock';

const KIND_CONFIG: Record<
  ReassessmentKind,
  { sessionKind: string; target: number; minutes: number }
> = {
  check: { sessionKind: 'check', target: 10, minutes: 10 },
  topic: { sessionKind: 'topic_test', target: 15, minutes: 15 },
  mock: { sessionKind: 'mock', target: 30, minutes: 30 },
};

const NOISE_FRACTION = 0.5; // |Δrating| below half the combined RD → too early to tell

/**
 * PH9 — on-demand reassessment (E-050/E-051).
 * Items come from the disjoint 'reassessment' pool and exclude anything
 * the student has already attempted; the runner's /next selection does
 * the per-question filtering. Pool exhaustion shortens the session and
 * is reported honestly rather than silently padded.
 */
@Injectable()
export class ReassessmentService {
  private readonly logger = new Logger(ReassessmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** E-050 — start a reassessment session. */
  async start(userId: string, dto: { kind: ReassessmentKind; topicId?: string | undefined }) {
    const cfg = KIND_CONFIG[dto.kind];
    if (!cfg) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Unknown kind' });
    if (dto.kind === 'topic' && !dto.topicId) {
      throw new ConflictException({
        code: 'VALIDATION_FAILED',
        message: 'topicId is required for a topic reassessment',
      });
    }
    if (dto.topicId) {
      const topic = await this.prisma.topic.findUnique({ where: { id: dto.topicId } });
      if (!topic) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Topic not found' });
    }

    // Pool depth: published reassessment items the student hasn't seen.
    const attempted = await this.prisma.questionAttempt.findMany({
      where: { userId },
      select: { questionId: true },
    });
    const seen = new Set(attempted.map((a) => a.questionId));
    const poolWhere: Prisma.QuestionWhereInput = {
      status: 'published',
      pool: 'reassessment',
      ...(dto.topicId
        ? { topic: { is: { OR: [{ id: dto.topicId }, { parentId: dto.topicId }] } } }
        : {}),
    };
    const available = await this.prisma.question.findMany({
      where: poolWhere,
      select: { id: true },
      take: 500,
    });
    const unseen = available.filter((q) => !seen.has(q.id)).length;
    if (unseen === 0) {
      throw new ConflictException({
        code: 'POOL_EXHAUSTED',
        message: 'No unseen reassessment questions available',
      });
    }
    const shortened = unseen < cfg.target;

    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        kind: cfg.sessionKind,
        topicId: dto.topicId ?? null,
        blockType: 'reassessment',
        plannedMinutes: shortened
          ? Math.max(5, Math.ceil((unseen / cfg.target) * cfg.minutes))
          : cfg.minutes,
      },
    });
    return {
      sessionId: session.id,
      kind: dto.kind,
      sessionKind: cfg.sessionKind,
      targetQuestions: cfg.target,
      availableQuestions: unseen,
      shortened,
      plannedMinutes: session.plannedMinutes,
    };
  }

  /**
   * E-051 — baseline-vs-now comparison with noise labels.
   * Computed lazily and cached in reassessment_results (unique session).
   */
  async comparison(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
    if (session.status !== 'finished') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Reassessment is not finished yet',
      });
    }

    const existing = await this.prisma.reassessmentResult.findUnique({
      where: { sessionId },
    });
    if (existing) return existing.comparison;

    const baseline = await this.prisma.profileSnapshot.findFirst({
      where: { userId, isBaseline: true },
      orderBy: { takenAt: 'desc' },
    });
    if (!baseline) {
      throw new ConflictException({
        code: 'NO_BASELINE',
        message: 'No baseline profile yet — take the diagnostic first',
      });
    }

    const baselineTopics = new Map<
      string,
      { rating: number; rd: number; accuracyEma: number | null }
    >();
    for (const t of (
      baseline.data as {
        topics?: { topicId: string; rating: number; rd: number; accuracyEma: number | null }[];
      }
    ).topics ?? []) {
      baselineTopics.set(t.topicId, t);
    }

    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId, contextType: 'practice', contextId: sessionId, skipped: false },
      include: { question: { select: { topicId: true } } },
    });
    const sessionTopicIds = [...new Set(attempts.map((a) => a.question.topicId))];

    const current = await this.prisma.studentTopicProfile.findMany({
      where: { userId, topicId: { in: sessionTopicIds } },
    });
    const currentByTopic = new Map(current.map((c) => [c.topicId, c]));

    const topics = sessionTopicIds.map((topicId) => {
      const b = baselineTopics.get(topicId);
      const c = currentByTopic.get(topicId);
      const delta = b && c ? c.rating - b.rating : null;
      const noiseBand = b && c ? (b.rd + c.rd) * NOISE_FRACTION : null;
      const tooEarly = delta !== null && noiseBand !== null && Math.abs(delta) <= noiseBand;
      const label = tooEarly
        ? 'too_early_to_tell'
        : delta === null
          ? 'no_baseline'
          : delta > 0
            ? 'improved'
            : delta < 0
              ? 'declined'
              : 'unchanged';
      const retention =
        b?.accuracyEma != null && c?.accuracyEma != null
          ? c.accuracyEma >= b.accuracyEma - 0.05
            ? 'retained'
            : 'decayed'
          : null;
      return {
        topicId,
        baselineRating: b?.rating ?? null,
        currentRating: c?.rating ?? null,
        delta,
        noiseBand,
        label,
        retention,
        baselineAccuracy: b?.accuracyEma ?? null,
        currentAccuracy: c?.accuracyEma ?? null,
      };
    });

    const answered = attempts.filter((a) => a.isCorrect !== null);
    const correct = answered.filter((a) => a.isCorrect === true).length;
    const comparison = {
      sessionId,
      baselineSnapshotId: baseline.id,
      answered: answered.length,
      accuracy: answered.length ? Number((correct / answered.length).toFixed(3)) : null,
      topics,
      generatedAt: new Date().toISOString(),
    };

    await this.prisma.reassessmentResult.upsert({
      where: { sessionId },
      create: {
        userId,
        sessionId,
        baselineSnapshotId: baseline.id,
        comparison: comparison as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
    return comparison;
  }
}
