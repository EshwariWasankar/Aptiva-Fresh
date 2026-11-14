import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EngineError, markAttempt, type MarkingQuestion } from '@aptiva/engine';
import { Prisma } from '../../generated/prisma/client';
import { ENV, type Env } from '../common/config/env';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AttemptStreamService, type AttemptEvent } from './attempt-stream.service';
import { RecalcService } from './recalc.service';
import type { AttemptSubmitDto, SessionCreateDto, SessionFinishDto } from './dto';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // stated 2h expiry [P]
const SESS_CACHE_TTL_S = 300;
const QKEY_CACHE_TTL_S = 3_600;
const RESULT_CACHE_TTL_S = 86_400;
const MAX_SESSION_QUESTIONS = 80;

interface SessionCache {
  id: string;
  userId: string;
  kind: string;
  status: string;
  startedAt: string;
}

export interface QuestionKey {
  id: string;
  topicId: string;
  format: 'mcq' | 'numerical';
  status: string;
  pool: string;
  expectedTimeMs: number;
  numericAnswer: string | null;
  answerFormat: string | null;
  decimalPlaces: number | null;
  tolerance: string | null;
  options: { id: string; isCorrect: boolean }[];
}

/** kind → required question pool (pools stay disjoint, DATA-003). */
const KIND_POOL: Record<string, string> = {
  practice: 'practice',
  // Reassessment kinds draw from the disjoint 'reassessment' pool so a
  // reassessment measures learning, not memory (DATA-003).
  mock: 'reassessment',
  check: 'reassessment',
  topic_test: 'reassessment',
};

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly stream: AttemptStreamService,
    private readonly recalc: RecalcService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---------------------------------------------------------- E-040

  async createSession(userId: string, dto: SessionCreateDto) {
    // PH8-T01 — a session started from a plan block inherits the block's
    // topic, block type and minutes; custom practice takes an explicit topic.
    let topicId: string | null = null;
    let blockType: string | null = null;
    let plannedMinutes = dto.plannedMinutes ?? dto.minutes ?? null;
    if (dto.planItemId) {
      const item = await this.prisma.practicePlanItem.findFirst({
        where: { id: dto.planItemId, plan: { userId } },
        include: { plan: { select: { id: true, userId: true, isCurrent: true } } },
      });
      if (!item) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan item not found' });
      }
      topicId = item.topicId;
      blockType = item.blockType;
      plannedMinutes = item.minutes;
    } else if (dto.topicId) {
      const topic = await this.prisma.topic.findUnique({ where: { id: dto.topicId } });
      if (!topic) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Topic not found' });
      topicId = topic.id;
    }
    const session = await this.prisma.practiceSession.create({
      data: {
        userId,
        kind: dto.kind,
        planItemId: dto.planItemId ?? null,
        topicId,
        blockType,
        plannedMinutes,
      },
    });
    await this.cacheSession(session);
    return {
      id: session.id,
      kind: session.kind,
      status: session.status,
      recalcStatus: session.recalcStatus,
      startedAt: session.startedAt,
      plannedMinutes: session.plannedMinutes,
      topicId,
      blockType,
    };
  }

  // ------------------------------------------- serve (shown_at stamp)

  /**
   * Serve one question inside a session: ownership + pool checks, then
   * stamps shown_at server-side (Redis; falls back to attempt time when
   * Redis is unavailable). Answer keys are never returned.
   */
  async serveQuestion(userId: string, sessionId: string, questionId: string) {
    const session = await this.requireSession(userId, sessionId);
    const q = await this.questionKey(questionId);
    this.assertQuestionUsable(session, q);

    const shownAt = await this.markShown(sessionId, questionId);
    const full = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { orderNo: 'asc' } } },
    });
    if (!full) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Question not found' });
    return {
      sessionId,
      question: {
        id: full.id,
        format: full.format,
        stem: full.stem,
        expectedTimeMs: full.expectedTimeMs,
        difficultyPrior: full.difficultyPrior,
        answerFormat: full.answerFormat,
        decimalPlaces: full.decimalPlaces,
        shownAt: shownAt.toISOString(),
        options: full.options.map((o) => ({ id: o.id, text: o.text, orderNo: o.orderNo })),
      },
    };
  }

  // ---------------------------------------------------------- E-041

  async submitAttempt(
    userId: string,
    sessionId: string,
    questionId: string,
    dto: AttemptSubmitDto,
  ) {
    // ---- Idempotency fast paths (Redis result cache, then DB row) ----
    const cached = await this.redis.client.get(`attempt:result:${dto.attemptId}`);
    if (cached) return JSON.parse(cached) as Record<string, unknown>;
    const existing = await this.prisma.questionAttempt.findUnique({
      where: { id: dto.attemptId },
      include: { question: { select: { expectedTimeMs: true } } },
    });
    if (existing) return this.resultFromRow(existing);

    const session = await this.requireSession(userId, sessionId);
    const q = await this.questionKey(questionId);
    this.assertQuestionUsable(session, q);

    // ---- Mark from the cached key (no answer key leaves the server) ----
    const markingQuestion: MarkingQuestion = {
      format: q.format,
      options: q.options,
      numericAnswer: q.numericAnswer != null ? Number(q.numericAnswer) : null,
      answerFormat: (q.answerFormat as 'integer' | 'decimal' | null) ?? null,
      decimalPlaces: q.decimalPlaces,
      tolerance: q.tolerance != null ? Number(q.tolerance) : null,
    };
    let marked;
    try {
      // No blueprint is linked to practice sessions yet (PH-7); negative
      // marking stays off until a session carries blueprint context.
      marked = markAttempt(
        markingQuestion,
        {
          selectedOptionId: dto.selectedOptionId ?? null,
          numericInput: dto.numericInput ?? null,
          skipped: dto.skipped,
        },
        { negativeMarking: null },
      );
    } catch (err) {
      if (err instanceof EngineError) {
        if (err.code === 'INVALID_NUMERIC_INPUT') {
          throw new UnprocessableEntityException({
            code: 'INVALID_NUMERIC_INPUT',
            message: 'Answer could not be parsed — the attempt was not consumed',
          });
        }
        throw new UnprocessableEntityException({
          code: 'VALIDATION_FAILED',
          message: err.message,
        });
      }
      throw err;
    }

    // ---- Server-authoritative timestamps (SEC-011/NFR-005) ----
    const answeredAt = new Date();
    const shownAt = (await this.getShown(sessionId, questionId)) ?? answeredAt;
    const timeMs = Math.max(0, answeredAt.getTime() - shownAt.getTime());
    const sequenceNo = await this.nextSequenceNo('practice', sessionId);

    const event: AttemptEvent = {
      attemptId: dto.attemptId,
      userId,
      questionId,
      contextType: 'practice',
      contextId: sessionId,
      shownAt: shownAt.toISOString(),
      answeredAt: answeredAt.toISOString(),
      timeMs,
      selectedOptionId: dto.selectedOptionId ?? null,
      numericInput: dto.numericInput ?? null,
      roundingSuspected: marked.roundingSuspected,
      isCorrect: marked.isCorrect,
      skipped: dto.skipped,
      sequenceNo,
      revisitCount: dto.revisitCount,
      answerChanges: dto.answerChanges,
    };

    const response = {
      attemptId: dto.attemptId,
      isCorrect: marked.isCorrect,
      timeMs,
      expectedTimeMs: q.expectedTimeMs,
      paceRatio: q.expectedTimeMs > 0 ? Number((timeMs / q.expectedTimeMs).toFixed(3)) : null,
      correctAnswerShown: true,
      promptErrorCause: true,
      roundingSuspected: marked.roundingSuspected,
    };

    // ---- Persist: stream first, direct DB when Redis is down ----
    await this.persistAttempt(event);
    await this.cacheAttemptResult(dto.attemptId, response);
    if (marked.isCorrect === false && !dto.skipped) {
      void this.recordMistake(userId, event, q.topicId).catch((err) =>
        this.logger.warn(`mistake entry failed: ${String(err).slice(0, 120)}`),
      );
    }
    return response;
  }

  /** PH8-T06 — mistake notebook row for a wrong answer (retry ladder). */
  private async recordMistake(userId: string, event: AttemptEvent, topicId: string): Promise<void> {
    const LADDER_DAYS = [1, 3, 7, 14];
    const priorWrong = await this.prisma.questionAttempt.count({
      where: {
        userId,
        isCorrect: false,
        skipped: false,
        question: { topicId },
        answeredAt: { lt: new Date(event.answeredAt) },
      },
    });
    const retryCount = Math.min(priorWrong, LADDER_DAYS.length - 1);
    const retryAt = new Date(
      new Date(event.answeredAt).getTime() + LADDER_DAYS[retryCount]! * 86_400_000,
    );
    await this.prisma.mistakeEntry.upsert({
      where: { attemptId: event.attemptId },
      create: {
        userId,
        attemptId: event.attemptId,
        retryAt,
        retryCount,
      },
      update: {},
    });
  }

  /** Degraded mode (PH4-T04): write the attempt row directly. */
  async persistDirect(event: AttemptEvent): Promise<void> {
    try {
      await this.prisma.questionAttempt.create({
        data: {
          id: event.attemptId,
          userId: event.userId,
          questionId: event.questionId,
          contextType: event.contextType,
          contextId: event.contextId,
          shownAt: new Date(event.shownAt),
          answeredAt: new Date(event.answeredAt),
          timeMs: event.timeMs,
          selectedOptionId: event.selectedOptionId,
          numericInput: event.numericInput,
          roundingSuspected: event.roundingSuspected,
          isCorrect: event.isCorrect,
          skipped: event.skipped,
          sequenceNo: event.sequenceNo,
          revisitCount: event.revisitCount,
          answerChanges: event.answerChanges,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw new ServiceUnavailableException({
        code: 'ATTEMPT_STORE_UNAVAILABLE',
        message: 'Could not persist the attempt — please retry',
      });
    }
  }

  private resultFromRow(row: {
    id: string;
    timeMs: number | null;
    isCorrect: boolean | null;
    roundingSuspected: boolean;
    question?: { expectedTimeMs: number } | null;
  }) {
    const expected = row.question?.expectedTimeMs ?? 0;
    return {
      attemptId: row.id,
      isCorrect: row.isCorrect,
      timeMs: row.timeMs,
      expectedTimeMs: expected,
      paceRatio:
        expected > 0 && row.timeMs != null ? Number((row.timeMs / expected).toFixed(3)) : null,
      correctAnswerShown: true,
      promptErrorCause: true,
      roundingSuspected: row.roundingSuspected,
    };
  }

  // ---------------------------------------------------------- E-042

  /**
   * Flush barrier (PH4-T05/T-009): compare client-held ids with
   * persisted rows and stream-pending ids, drain the stream, re-ingest
   * any payloads the client still holds, then finish + enqueue recalc.
   */
  async finishSession(userId: string, sessionId: string, dto: SessionFinishDto) {
    const session = await this.requireSession(userId, sessionId);
    if (session.status !== 'active') {
      throw new ConflictException({ code: 'CONFLICT', message: 'Session is not active' });
    }

    const clientAttempts = dto.attempts ?? [];
    const clientIds = new Set<string>([
      ...(dto.attemptIds ?? []),
      ...clientAttempts.map((a) => a.attemptId),
    ]);

    // Wait for the stream to drain, then verify every client id persisted.
    const deadline = Date.now() + this.env.FLUSH_BARRIER_TIMEOUT_MS;
    let persisted = await this.persistedIds([...clientIds], sessionId);
    while (persisted.size < clientIds.size && Date.now() < deadline) {
      await this.stream.processAvailable().catch(() => 0);
      await sleep(50);
      persisted = await this.persistedIds([...clientIds], sessionId);
    }

    // Re-ingest payloads the client still holds but the server lacks.
    let reingested = 0;
    for (const a of clientAttempts) {
      if (persisted.has(a.attemptId)) continue;
      try {
        await this.submitAttempt(userId, sessionId, a.questionId, a);
        reingested += 1;
      } catch (err) {
        this.logger.warn(
          `barrier re-ingest failed for ${a.attemptId}: ${String(err).slice(0, 160)}`,
        );
      }
    }
    if (reingested > 0) {
      // Give the stream a moment, then force-drain once more.
      await sleep(100);
      await this.stream.processAvailable().catch(() => 0);
      persisted = await this.persistedIds([...clientIds], sessionId);
    }

    const missing = [...clientIds].filter((id) => !persisted.has(id));
    if (missing.length > 0) {
      this.logger.warn(
        `flush barrier: ${missing.length} attempt ids not persisted for session ${sessionId}`,
      );
    }

    const now = new Date();
    const actualMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60_000),
    );
    await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        status: 'finished',
        finishedAt: now,
        actualMinutes,
        recalcStatus: 'pending',
      },
    });
    await this.invalidateSession(sessionId);

    // Update practice_days for commitments & streaks (PH13-T04)
    try {
      const today = new Date();
      const todayDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      await this.prisma.practiceDay.upsert({
        where: { userId_date: { userId, date: todayDate } },
        update: {
          activeSeconds: { increment: Math.max(0, actualMinutes * 60) },
          questionsAnswered: { increment: persisted.size },
        },
        create: {
          userId,
          date: todayDate,
          activeSeconds: Math.max(0, actualMinutes * 60),
          questionsAnswered: persisted.size,
        },
      });
    } catch (streakErr) {
      this.logger.warn(`Failed to record practice day: ${String(streakErr)}`);
    }

    try {
      await this.recalc.enqueueRecalc({ sessionId, userId });
    } catch (err) {
      // Queue down: session is still finished; recalc stays pending and
      // the student sees the neutral retry banner (Section 11.5).
      this.logger.error(`recalc enqueue failed for ${sessionId}: ${String(err).slice(0, 160)}`);
    }

    return {
      sessionId,
      status: 'finished',
      recalcStatus: 'pending',
      persistedCount: persisted.size,
      missingCount: missing.length,
    };
  }

  private async persistedIds(ids: string[], sessionId: string): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.prisma.questionAttempt.findMany({
      where: { id: { in: ids }, contextType: 'practice', contextId: sessionId },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  /** Stream-first persistence with degraded direct-write fallback. */
  async persistAttempt(event: AttemptEvent): Promise<void> {
    try {
      await this.stream.append(event);
    } catch (err) {
      this.logger.warn(`stream append failed, degraded direct write: ${String(err).slice(0, 160)}`);
      await this.persistDirect(event);
    }
  }

  async findAttemptRow(attemptId: string) {
    return this.prisma.questionAttempt.findUnique({ where: { id: attemptId } });
  }

  async cacheAttemptResult(attemptId: string, payload: unknown): Promise<void> {
    await this.redis.client
      .set(`attempt:result:${attemptId}`, JSON.stringify(payload), 'EX', RESULT_CACHE_TTL_S)
      .catch(() => undefined);
  }

  async getCachedResult<T>(attemptId: string): Promise<T | null> {
    const v = await this.redis.client.get(`attempt:result:${attemptId}`).catch(() => null);
    return v ? (JSON.parse(v) as T) : null;
  }

  /** E-044 — mistake notebook: wrong answers with cause + retry date. */
  async notebook(userId: string, filters: { status?: 'open' | 'resolved'; topicId?: string }) {
    // Lazy resolution: a later correct attempt on the same topic closes
    // the entry (spec: resolved when the student demonstrates the skill).
    const open = await this.prisma.mistakeEntry.findMany({
      where: { userId, resolvedAt: null },
      include: {
        attempt: {
          include: {
            question: {
              select: { topicId: true, stem: true, topic: { select: { slug: true, name: true } } },
            },
            errorInference: { select: { errorType: { select: { code: true, label: true } } } },
            errorFeedback: { select: { errorType: { select: { code: true, label: true } } } },
          },
        },
      },
      orderBy: { retryAt: 'asc' },
      take: 500,
    });
    const topicIds = [...new Set(open.map((e) => e.attempt.question.topicId))];
    if (topicIds.length) {
      const laterCorrect = await this.prisma.questionAttempt.findMany({
        where: {
          userId,
          isCorrect: true,
          skipped: false,
          question: { topicId: { in: topicIds } },
        },
        select: { question: { select: { topicId: true } }, answeredAt: true },
      });
      const resolvedTopics = new Map<string, Date>();
      for (const a of laterCorrect) {
        const prev = resolvedTopics.get(a.question.topicId);
        if (!prev || a.answeredAt < prev) resolvedTopics.set(a.question.topicId, a.answeredAt);
      }
      for (const e of open) {
        const fixedAt = resolvedTopics.get(e.attempt.question.topicId);
        const attemptAt = e.attempt.answeredAt;
        if (fixedAt && fixedAt > attemptAt) {
          await this.prisma.mistakeEntry.update({
            where: { id: e.id },
            data: { resolvedAt: fixedAt },
          });
          e.resolvedAt = fixedAt;
        }
      }
    }
    let entries = open;
    if (filters.status === 'open') entries = entries.filter((e) => !e.resolvedAt);
    if (filters.status === 'resolved') entries = entries.filter((e) => e.resolvedAt);
    if (filters.topicId) {
      entries = entries.filter((e) => e.attempt.question.topicId === filters.topicId);
    }
    return {
      entries: entries.map((e) => ({
        id: e.id,
        attemptId: e.attemptId,
        stem: e.attempt.question.stem,
        topic: e.attempt.question.topic,
        answeredAt: e.attempt.answeredAt,
        isCorrect: e.attempt.isCorrect,
        timeMs: e.attempt.timeMs,
        errorType:
          e.attempt.errorFeedback?.errorType ?? e.attempt.errorInference?.errorType ?? null,
        retryAt: e.retryAt,
        retryCount: e.retryCount,
        resolvedAt: e.resolvedAt,
      })),
    };
  }

  // ------------------------------------------------- PH-8: next item

  /**
   * PH8-T01 — pick the next question for an active session.
   * Selection: session topic descendants → published pool → unseen
   * preferred → |difficulty step| ≤ 1 band → topic-share cap.
   * Returns { type:'lesson' } once for concept_repair blocks, { done }
   * at the session cap, otherwise the served question payload.
   */
  async nextQuestion(userId: string, sessionId: string) {
    const row = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
    await this.requireSession(userId, sessionId); // status + expiry checks
    if (row.status !== 'active') {
      throw new ConflictException({ code: 'CONFLICT', message: `Session is ${row.status}` });
    }

    // Concept-repair gate: show the published lesson once before questions.
    if (row.blockType === 'concept_repair' && row.topicId) {
      const shown = await this.redis.client.get(`sesslesson:${sessionId}`).catch(() => '1'); // Redis down → don't block practice
      if (shown !== '1') {
        const lesson = await this.prisma.lesson.findFirst({
          where: { topicId: row.topicId, status: 'published' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, title: true, content: true },
        });
        if (lesson) {
          await this.redis.client
            .set(`sesslesson:${sessionId}`, '1', 'EX', SESS_CACHE_TTL_S)
            .catch(() => undefined);
          return {
            sessionId,
            type: 'lesson' as const,
            lesson,
          };
        }
      }
    }

    const servedCount = await this.servedIds(sessionId);
    if (servedCount.size >= MAX_SESSION_QUESTIONS) {
      return { sessionId, done: true as const, reason: 'session_limit' as const };
    }

    const pool = KIND_POOL[row.kind] ?? 'practice';
    const topicIds = row.topicId ? await this.topicDescendants(row.topicId) : null;

    // Seen set: this session's shown ids + every question the user attempted.
    const attempted = await this.prisma.questionAttempt.findMany({
      where: { userId },
      select: { questionId: true },
    });
    const seen = new Set([...servedCount, ...attempted.map((a) => a.questionId)]);

    let candidates = await this.prisma.question.findMany({
      where: {
        status: 'published',
        pool,
        ...(topicIds ? { topicId: { in: topicIds } } : {}),
      },
      select: { id: true, topicId: true, difficultyPrior: true, expectedTimeMs: true },
      take: 1000,
    });
    if (candidates.length === 0 && topicIds) {
      // Sparse pool: widen to the whole session pool rather than dead-end.
      candidates = await this.prisma.question.findMany({
        where: { status: 'published', pool },
        select: { id: true, topicId: true, difficultyPrior: true, expectedTimeMs: true },
        take: 1000,
      });
    }
    const unseen = candidates.filter((c) => !seen.has(c.id));
    if (unseen.length === 0) {
      return { sessionId, done: true as const, reason: 'pool_exhausted' as const };
    }

    // Difficulty step ≤ 1 band from the last served question.
    const lastDiff = await this.lastDifficulty(sessionId);
    let pool1 = unseen;
    if (lastDiff !== null) {
      const stepped = unseen.filter((c) => Math.abs(c.difficultyPrior - lastDiff) <= 1);
      if (stepped.length > 0) pool1 = stepped;
    }

    // Topic-share cap (mixed sessions only): no topic above 60% of served.
    const topicCounts = await this.topicCounts(sessionId);
    const distinctTopics = new Set(pool1.map((c) => c.topicId)).size;
    if (distinctTopics > 1) {
      const cap = Math.max(2, Math.ceil(servedCount.size * 0.6));
      const under = pool1.filter((c) => (topicCounts.get(c.topicId) ?? 0) < cap);
      if (under.length > 0) pool1 = under;
    }

    pool1.sort(
      (a, b) =>
        Math.abs(a.difficultyPrior - (lastDiff ?? a.difficultyPrior)) -
          Math.abs(b.difficultyPrior - (lastDiff ?? b.difficultyPrior)) ||
        a.expectedTimeMs - b.expectedTimeMs ||
        a.id.localeCompare(b.id),
    );
    const pick = pool1[0]!;
    await this.markShown(sessionId, pick.id);
    await this.bumpTopicCount(sessionId, pick.topicId);
    await this.setLastDifficulty(sessionId, pick.difficultyPrior);
    return this.serveQuestion(userId, sessionId, pick.id);
  }

  private async servedIds(sessionId: string): Promise<Set<string>> {
    try {
      const keys = await this.redis.client.hkeys(`shown:${sessionId}`);
      return new Set(keys);
    } catch {
      const rows = await this.prisma.questionAttempt.findMany({
        where: { contextType: 'practice', contextId: sessionId },
        select: { questionId: true },
      });
      return new Set(rows.map((r) => r.questionId));
    }
  }

  private async topicDescendants(topicId: string): Promise<string[]> {
    const all = await this.prisma.topic.findMany({ select: { id: true, parentId: true } });
    const children = new Map<string, string[]>();
    for (const t of all) {
      if (t.parentId) {
        const arr = children.get(t.parentId) ?? [];
        arr.push(t.id);
        children.set(t.parentId, arr);
      }
    }
    const out = [topicId];
    const queue = [topicId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const child of children.get(cur) ?? []) {
        out.push(child);
        queue.push(child);
      }
    }
    return out;
  }

  private async lastDifficulty(sessionId: string): Promise<number | null> {
    try {
      const v = await this.redis.client.get(`sessdiff:${sessionId}`);
      if (v) return Number(v);
    } catch {
      /* fall through */
    }
    const last = await this.prisma.questionAttempt.findFirst({
      where: { contextType: 'practice', contextId: sessionId },
      orderBy: { sequenceNo: 'desc' },
      include: { question: { select: { difficultyPrior: true } } },
    });
    return last?.question.difficultyPrior ?? null;
  }

  private async setLastDifficulty(sessionId: string, diff: number): Promise<void> {
    await this.redis.client
      .set(`sessdiff:${sessionId}`, String(diff), 'EX', SESS_CACHE_TTL_S)
      .catch(() => undefined);
  }

  private async topicCounts(sessionId: string): Promise<Map<string, number>> {
    try {
      const h = await this.redis.client.hgetall(`sesstopics:${sessionId}`);
      return new Map(Object.entries(h).map(([k, v]) => [k, Number(v)]));
    } catch {
      return new Map();
    }
  }

  private async bumpTopicCount(sessionId: string, topicId: string): Promise<void> {
    await this.redis.client
      .hincrby(`sesstopics:${sessionId}`, topicId, 1)
      .then(() => this.redis.client.expire(`sesstopics:${sessionId}`, SESS_CACHE_TTL_S))
      .catch(() => undefined);
  }

  // ------------------------------------------------- PH-8: summary/retry

  /** E-043 — session summary + recalculation status. */
  async sessionSummary(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
    const attempts = await this.prisma.questionAttempt.findMany({
      where: { userId, contextType: 'practice', contextId: sessionId },
      include: {
        question: {
          select: {
            topicId: true,
            expectedTimeMs: true,
            topic: { select: { slug: true, name: true } },
          },
        },
      },
      orderBy: { sequenceNo: 'asc' },
    });
    const answered = attempts.filter((a) => !a.skipped);
    const correct = answered.filter((a) => a.isCorrect === true).length;
    const timeMs = answered.reduce((s, a) => s + (a.timeMs ?? 0), 0);
    const expectedMs = answered.reduce((s, a) => s + a.question.expectedTimeMs, 0);
    const byTopic = new Map<string, { name: string; attempted: number; correct: number }>();
    for (const a of answered) {
      const t = byTopic.get(a.question.topicId) ?? {
        name: a.question.topic.name,
        attempted: 0,
        correct: 0,
      };
      t.attempted += 1;
      if (a.isCorrect) t.correct += 1;
      byTopic.set(a.question.topicId, t);
    }
    return {
      sessionId: session.id,
      status: session.status,
      recalcStatus: session.recalcStatus,
      kind: session.kind,
      plannedMinutes: session.plannedMinutes,
      actualMinutes: session.actualMinutes,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      answered: answered.length,
      skipped: attempts.length - answered.length,
      correct,
      accuracy: answered.length ? Number((correct / answered.length).toFixed(3)) : null,
      avgTimeMs: answered.length ? Math.round(timeMs / answered.length) : null,
      paceRatio: expectedMs > 0 ? Number((timeMs / expectedMs).toFixed(3)) : null,
      topics: [...byTopic.entries()].map(([topicId, v]) => ({ topicId, ...v })),
    };
  }

  /** Neutral retry for a failed recalculation (Section 11.5). */
  async retryRecalc(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
    if (session.recalcStatus !== 'failed') {
      throw new ConflictException({
        code: 'CONFLICT',
        message: `Recalculation is ${session.recalcStatus}`,
      });
    }
    await this.prisma.practiceSession.update({
      where: { id: sessionId },
      data: { recalcStatus: 'pending' },
    });
    try {
      await this.recalc.enqueueRecalc({ sessionId, userId });
    } catch (err) {
      await this.prisma.practiceSession.update({
        where: { id: sessionId },
        data: { recalcStatus: 'failed' },
      });
      throw err;
    }
    return { sessionId, recalcStatus: 'pending' };
  }

  /**
   * Post-attempt reveal (P-14 immediate mode): correctness was already
   * returned by E-041; this endpoint reveals the key/explanation ONLY
   * after the attempt row exists — the answer key never precedes marking.
   */
  async revealAttempt(userId: string, sessionId: string, attemptId: string) {
    const attempt = await this.prisma.questionAttempt.findFirst({
      where: { id: attemptId, userId, contextType: 'practice', contextId: sessionId },
      include: {
        question: {
          include: { options: { where: { isCorrect: true }, select: { id: true, text: true } } },
        },
      },
    });
    if (!attempt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Attempt not found' });
    return {
      attemptId: attempt.id,
      isCorrect: attempt.isCorrect,
      correctOption: attempt.question.options[0] ?? null,
      numericAnswer: attempt.question.numericAnswer?.toString() ?? null,
      solution: attempt.question.solution,
    };
  }

  // ------------------------------------------------------- internals

  private async requireSession(userId: string, sessionId: string): Promise<SessionCache> {
    let s = await this.sessionFromCache(sessionId);
    if (!s) {
      const row = await this.prisma.practiceSession.findUnique({ where: { id: sessionId } });
      if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
      if (row.userId !== userId) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      s = {
        id: row.id,
        userId: row.userId,
        kind: row.kind,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
      };
      await this.cacheSession(row);
    }
    if (s.userId !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Session not found' });
    }
    if (s.status !== 'active') {
      throw new ConflictException({ code: 'CONFLICT', message: `Session is ${s.status}` });
    }
    if (Date.now() - new Date(s.startedAt).getTime() > SESSION_TTL_MS) {
      throw new ConflictException({ code: 'SESSION_EXPIRED', message: 'Session expired' });
    }
    return s;
  }

  private assertQuestionUsable(session: SessionCache, q: QuestionKey): void {
    const requiredPool = KIND_POOL[session.kind] ?? 'practice';
    if (q.status !== 'published') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Question not available' });
    }
    if (q.pool !== requiredPool) {
      throw new UnprocessableEntityException({
        code: 'WRONG_POOL',
        message: `This question is not in the ${requiredPool} pool`,
      });
    }
  }

  /** Answer-key cache — SEC-010: keys live server-side only. */
  async questionKey(questionId: string): Promise<QuestionKey> {
    const cached = await this.redis.client.get(`qkey:${questionId}`);
    if (cached) return JSON.parse(cached) as QuestionKey;
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { options: { select: { id: true, isCorrect: true } } },
    });
    if (!q) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Question not found' });
    const key: QuestionKey = {
      id: q.id,
      topicId: q.topicId,
      format: q.format as 'mcq' | 'numerical',
      status: q.status,
      pool: q.pool,
      expectedTimeMs: q.expectedTimeMs,
      numericAnswer: q.numericAnswer?.toString() ?? null,
      answerFormat: q.answerFormat,
      decimalPlaces: q.decimalPlaces,
      tolerance: q.tolerance?.toString() ?? null,
      options: q.options.map((o) => ({ id: o.id, isCorrect: o.isCorrect })),
    };
    await this.redis.client
      .set(`qkey:${questionId}`, JSON.stringify(key), 'EX', QKEY_CACHE_TTL_S)
      .catch(() => undefined);
    return key;
  }

  async markShown(sessionId: string, questionId: string): Promise<Date> {
    const now = Date.now();
    try {
      const set = await this.redis.client.hsetnx(`shown:${sessionId}`, questionId, String(now));
      if (set === 1) return new Date(now);
      const prev = await this.redis.client.hget(`shown:${sessionId}`, questionId);
      return prev ? new Date(Number(prev)) : new Date(now);
    } catch {
      return new Date(now);
    }
  }

  async getShown(sessionId: string, questionId: string): Promise<Date | null> {
    try {
      const v = await this.redis.client.hget(`shown:${sessionId}`, questionId);
      return v ? new Date(Number(v)) : null;
    } catch {
      return null;
    }
  }

  async nextSequenceNo(contextType: string, contextId: string): Promise<number> {
    try {
      return await this.redis.client.incr(`seq:${contextType}:${contextId}`);
    } catch {
      const count = await this.prisma.questionAttempt.count({
        where: { contextType, contextId },
      });
      return count + 1;
    }
  }

  private async cacheSession(s: {
    id: string;
    userId: string;
    kind: string;
    status: string;
    startedAt: Date;
  }): Promise<void> {
    const payload: SessionCache = {
      id: s.id,
      userId: s.userId,
      kind: s.kind,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
    };
    await this.redis.client
      .set(`sess:${s.id}`, JSON.stringify(payload), 'EX', SESS_CACHE_TTL_S)
      .catch(() => undefined);
  }

  private async sessionFromCache(sessionId: string): Promise<SessionCache | null> {
    try {
      const v = await this.redis.client.get(`sess:${sessionId}`);
      return v ? (JSON.parse(v) as SessionCache) : null;
    } catch {
      return null;
    }
  }

  private async invalidateSession(sessionId: string): Promise<void> {
    await this.redis.client.del(`sess:${sessionId}`).catch(() => undefined);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
