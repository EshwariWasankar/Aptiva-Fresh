import { Injectable, Logger } from '@nestjs/common';
import {
  ENGINE_VERSION,
  profileFromAttempts,
  QUESTION_RATING_MIN_RESPONSES,
  updateRating,
  type ProfileAttemptInput,
} from '@aptiva/engine';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * PH6 — profile reads (E-020) and baseline recomputation (PH6-T04/T06).
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** E-020 — current profile: per-topic states joined to taxonomy names. */
  async getProfile(userId: string) {
    const [rows, topics] = await Promise.all([
      this.prisma.studentTopicProfile.findMany({
        where: { userId },
        include: { topic: { select: { id: true, slug: true, name: true, level: true } } },
        orderBy: { topicId: 'asc' },
      }),
      this.prisma.topic.findMany({ select: { id: true, slug: true, level: true, parentId: true } }),
    ]);
    // Resolve each topic's root section for radar grouping.
    const byId = new Map(topics.map((t) => [t.id, t]));
    const sectionOf = (topicId: string): string => {
      let cur = byId.get(topicId);
      let guard = 0;
      while (cur?.parentId && guard++ < 8) cur = byId.get(cur.parentId);
      return cur?.slug ?? 'unknown';
    };
    const baseline = await this.prisma.profileSnapshot.findFirst({
      where: { userId, isBaseline: true },
      orderBy: { takenAt: 'desc' },
      select: { id: true, takenAt: true, engineVersion: true },
    });
    return {
      engineVersion: ENGINE_VERSION,
      baseline: baseline
        ? {
            snapshotId: baseline.id,
            takenAt: baseline.takenAt,
            engineVersion: baseline.engineVersion,
          }
        : null,
      topics: rows.map((r) => ({
        topicId: r.topicId,
        topic: r.topic,
        sectionSlug: sectionOf(r.topicId),
        rating: r.rating,
        rd: r.rd,
        intervalLow: Math.round((r.rating - 1.96 * r.rd) * 10) / 10,
        intervalHigh: Math.round((r.rating + 1.96 * r.rd) * 10) / 10,
        accuracyEma: r.accuracyEma,
        timeEmaMs: r.timeEmaMs,
        attemptCount: r.attemptCount,
        errorMix: r.errorMix,
        updatedAt: r.updatedAt,
      })),
    };
  }

  /** E-020 — snapshot history (newest first, capped). */
  async getHistory(userId: string, limit = 50) {
    const rows = await this.prisma.profileSnapshot.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      take: Math.min(limit, 200),
      select: { id: true, trigger: true, isBaseline: true, engineVersion: true, takenAt: true },
    });
    return { snapshots: rows };
  }

  /**
   * PH6-T04 — rebuild topic profiles from a diagnostic's attempts and write
   * the baseline snapshot. Idempotent by diagnostic id.
   */
  async recomputeBaseline(userId: string, diagnosticId: string) {
    const existing = await this.prisma.profileSnapshot.findFirst({
      where: { userId, isBaseline: true },
      orderBy: { takenAt: 'desc' },
    });
    if (existing && (existing.data as { diagnosticId?: string }).diagnosticId === diagnosticId) {
      return { snapshotId: existing.id, topics: 0, skipped: true };
    }

    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId, contextType: 'diagnostic', contextId: diagnosticId },
      include: {
        question: { select: { topicId: true, eloRating: true, expectedTimeMs: true } },
        errorFeedback: { select: { errorType: { select: { code: true } } } },
        errorInference: { select: { errorType: { select: { code: true } } } },
      },
      orderBy: { answeredAt: 'asc' },
    });

    const inputs: ProfileAttemptInput[] = attempts.map((a) => ({
      topicId: a.question.topicId,
      answeredAt: a.answeredAt.toISOString(),
      contextId: a.contextId,
      isCorrect: a.isCorrect,
      skipped: a.skipped,
      timeMs: a.timeMs,
      expectedTimeMs: a.question.expectedTimeMs,
      questionRating: a.question.eloRating,
      questionRd: 300,
      reportedErrorType: a.errorFeedback?.errorType.code ?? null,
      inferredErrorType: a.errorInference?.errorType?.code ?? null,
    }));

    const profile = profileFromAttempts(inputs);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      for (const t of profile.topics) {
        await tx.studentTopicProfile.upsert({
          where: { userId_topicId: { userId, topicId: t.topicId } },
          create: {
            userId,
            topicId: t.topicId,
            rating: t.rating,
            rd: t.rd,
            accuracyEma: t.accuracyEma,
            timeEmaMs: t.timeEmaMs,
            attemptCount: t.attemptCount,
            errorMix: t.errorMix,
          },
          update: {
            rating: t.rating,
            rd: t.rd,
            accuracyEma: t.accuracyEma,
            timeEmaMs: t.timeEmaMs,
            attemptCount: t.attemptCount,
            errorMix: t.errorMix,
          },
        });
      }
      return tx.profileSnapshot.create({
        data: {
          userId,
          trigger: 'baseline',
          isBaseline: true,
          data: JSON.parse(JSON.stringify({ diagnosticId, topics: profile.topics })),
          engineVersion: ENGINE_VERSION,
        },
      });
    });

    await this.refreshQuestionRatings(userId);
    this.logger.log(
      `baseline profile for ${userId}: ${profile.topics.length} topics, snapshot ${snapshot.id}`,
    );
    return { snapshotId: snapshot.id, topics: profile.topics.length, skipped: false };
  }

  /**
   * PH8-T03 — recompute topic profiles from ALL persisted attempts
   * (diagnostic + practice) and write a 'session' snapshot.
   * Idempotent by sessionId: an existing snapshot for this session
   * short-circuits the whole step.
   */
  async recomputeSession(userId: string, sessionId: string) {
    const existing = await this.prisma.profileSnapshot.findFirst({
      where: { userId, trigger: 'session' },
      orderBy: { takenAt: 'desc' },
    });
    if (existing && (existing.data as { sessionId?: string }).sessionId === sessionId) {
      return { snapshotId: existing.id, topics: 0, skipped: true };
    }

    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId },
      include: {
        question: { select: { topicId: true, eloRating: true, expectedTimeMs: true } },
        errorFeedback: { select: { errorType: { select: { code: true } } } },
        errorInference: { select: { errorType: { select: { code: true } } } },
      },
      orderBy: { answeredAt: 'asc' },
    });

    const inputs: ProfileAttemptInput[] = attempts.map((a) => ({
      topicId: a.question.topicId,
      answeredAt: a.answeredAt.toISOString(),
      contextId: a.contextId,
      isCorrect: a.isCorrect,
      skipped: a.skipped,
      timeMs: a.timeMs,
      expectedTimeMs: a.question.expectedTimeMs,
      questionRating: a.question.eloRating,
      questionRd: 300,
      reportedErrorType: a.errorFeedback?.errorType.code ?? null,
      inferredErrorType: a.errorInference?.errorType?.code ?? null,
    }));

    const profile = profileFromAttempts(inputs);

    const snapshot = await this.prisma.$transaction(async (tx) => {
      for (const t of profile.topics) {
        await tx.studentTopicProfile.upsert({
          where: { userId_topicId: { userId, topicId: t.topicId } },
          create: {
            userId,
            topicId: t.topicId,
            rating: t.rating,
            rd: t.rd,
            accuracyEma: t.accuracyEma,
            timeEmaMs: t.timeEmaMs,
            attemptCount: t.attemptCount,
            errorMix: t.errorMix,
          },
          update: {
            rating: t.rating,
            rd: t.rd,
            accuracyEma: t.accuracyEma,
            timeEmaMs: t.timeEmaMs,
            attemptCount: t.attemptCount,
            errorMix: t.errorMix,
          },
        });
      }
      return tx.profileSnapshot.create({
        data: {
          userId,
          trigger: 'session',
          isBaseline: false,
          data: JSON.parse(JSON.stringify({ sessionId, topics: profile.topics.length })),
          engineVersion: ENGINE_VERSION,
        },
      });
    });

    this.logger.log(
      `session profile for ${userId} (session ${sessionId}): ${profile.topics.length} topics`,
    );
    return { snapshotId: snapshot.id, topics: profile.topics.length, skipped: false };
  }

  /**
   * PH6-T06 — small-step question rating updates once a question reaches
   * QUESTION_RATING_MIN_RESPONSES responses. The question plays against a
   * fixed student prior; elo_rating blends 25% toward the observed rating.
   */
  private async refreshQuestionRatings(userId: string): Promise<void> {
    const grouped = await this.prisma.questionAttempt.groupBy({
      by: ['questionId'],
      where: { userId, isCorrect: { not: null }, skipped: false },
      _count: { _all: true },
    });
    const eligible = grouped.filter((g) => g._count._all >= QUESTION_RATING_MIN_RESPONSES);
    for (const g of eligible) {
      const q = await this.prisma.question.findUnique({
        where: { id: g.questionId },
        select: { eloRating: true },
      });
      if (!q) continue;
      const rows = await this.prisma.questionAttempt.findMany({
        where: { questionId: g.questionId, isCorrect: { not: null }, skipped: false },
        select: { isCorrect: true },
        orderBy: { answeredAt: 'asc' },
        take: 500,
      });
      let state = { rating: q.eloRating, rd: 300 };
      for (const a of rows) {
        state = updateRating(state, 1500, 300, a.isCorrect === true).state;
      }
      const blended = q.eloRating + 0.25 * (state.rating - q.eloRating);
      await this.prisma.question.update({
        where: { id: g.questionId },
        data: { eloRating: Math.round(blended * 100) / 100 },
      });
    }
  }
}
