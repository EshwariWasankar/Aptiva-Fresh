import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  buildCandidates,
  ENGINE_VERSION,
  labelFor,
  plan as enginePlan,
  priorities,
  readinessBand,
  THIN_EVIDENCE_MIN_ATTEMPTS,
  type BlueprintInput,
  type BlueprintWeightInput,
  type PlanCandidate,
  type PriorityTopicInput,
  type ReadinessTopicInput,
} from '@aptiva/engine';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { GeneratePlanBody, MinutesPerWeekday, RequirementsBody } from './dto';
import { WEEKDAY_KEYS, type WeekdayKey } from './dto';

const DAY_MS = 86_400_000;
const SOURCE_RANK: Record<string, number> = {
  official: 4,
  public: 3,
  candidate_reported: 2,
  pattern_inferred: 1,
  assumption: 0,
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
function weekdayKey(d: Date): WeekdayKey {
  return WEEKDAY_KEYS[(d.getUTCDay() + 6) % 7]!; // Mon=0..Sun=6
}

/**
 * PH-7 — requirements (E-021), plan generation (E-030..E-033), readiness (E-036).
 * Blueprint resolution: assessment-specific current version when the
 * requirement names one, else the generic fallback blueprint — always with
 * provenance (sourceType/confidence) carried into rationale and readiness.
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------- E-021

  async getRequirements(userId: string) {
    const req = await this.prisma.preparationRequirement.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { assessment: { select: { id: true, slug: true, name: true, company: true } } },
    });
    if (!req) return { requirement: null };
    return { requirement: this.serializeRequirement(req) };
  }

  async putRequirements(userId: string, body: RequirementsBody) {
    const testDate = new Date(`${body.testDate}T00:00:00Z`);
    const deadlineDate = new Date(`${body.deadlineDate}T00:00:00Z`);
    const today = todayUtc();

    // T-012 validation (schema already enforces shape; these are the rules).
    if (testDate.getTime() <= today.getTime()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'testDate must be in the future',
        details: { field: 'testDate' },
      });
    }
    if (deadlineDate.getTime() > testDate.getTime()) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'deadlineDate must not be after testDate',
        details: { field: 'deadlineDate' },
      });
    }
    for (const [day, mins] of Object.entries(body.minutesPerWeekday)) {
      if (mins !== undefined && mins !== 0 && mins < 10) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: `minutesPerWeekday.${day} must be 0 or at least 10`,
          details: { field: `minutesPerWeekday.${day}` },
        });
      }
    }

    // wantedTopics may be slugs or uuids — resolve to ids.
    const wantedIds = await this.resolveTopicIds(body.wantedTopics);

    const requirement = await this.prisma.$transaction(async (tx) => {
      await tx.preparationRequirement.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false, supersededAt: new Date() },
      });
      return tx.preparationRequirement.create({
        data: {
          userId,
          assessmentId: body.assessmentId ?? null,
          mode: body.mode,
          testDate,
          deadlineDate,
          minutesPerWeekday: body.minutesPerWeekday as object,
          blockLengthMinutes: body.blockLengthMinutes,
          wantedTopics: wantedIds,
          preparationLevel: body.preparationLevel ?? null,
          knownInfo:
            body.knownInfo === undefined || body.knownInfo === null
              ? Prisma.DbNull
              : (body.knownInfo as Prisma.InputJsonValue),
        },
        include: { assessment: { select: { id: true, slug: true, name: true, company: true } } },
      });
    });

    // PH7-T07 — first plan is generated automatically after requirements.
    let planId: string | null = null;
    const existing = await this.prisma.practicePlan.findFirst({
      where: { requirementId: requirement.id, isCurrent: true },
      select: { id: true },
    });
    if (!existing) {
      try {
        const plan = await this.generatePlan(userId, requirement.id, 'setup');
        planId = plan.planId;
      } catch (err) {
        // Plan generation must never fail the requirements save.
        this.logger.warn(`auto first-plan failed: ${String(err).slice(0, 200)}`);
      }
    }
    return { requirement: this.serializeRequirement(requirement), planId };
  }

  private serializeRequirement(r: {
    id: string;
    assessmentId: string | null;
    mode: string;
    testDate: Date;
    deadlineDate: Date;
    minutesPerWeekday: unknown;
    blockLengthMinutes: number;
    wantedTopics: unknown;
    preparationLevel: string | null;
    knownInfo: unknown;
    isActive: boolean;
    createdAt: Date;
    assessment?: { id: string; slug: string; name: string; company: string } | null;
  }) {
    return {
      id: r.id,
      assessmentId: r.assessmentId,
      assessment: r.assessment ?? null,
      mode: r.mode,
      testDate: toIsoDate(r.testDate),
      deadlineDate: toIsoDate(r.deadlineDate),
      minutesPerWeekday: r.minutesPerWeekday,
      blockLengthMinutes: r.blockLengthMinutes,
      wantedTopics: r.wantedTopics,
      preparationLevel: r.preparationLevel,
      knownInfo: r.knownInfo,
      isActive: r.isActive,
      createdAt: r.createdAt,
    };
  }

  private async resolveTopicIds(values: string[]): Promise<string[]> {
    if (values.length === 0) return [];
    const byId = await this.prisma.topic.findMany({
      where: { id: { in: values } },
      select: { id: true },
    });
    const found = new Set(byId.map((t) => t.id));
    const missing = values.filter((v) => !found.has(v));
    if (missing.length === 0) return values;
    const bySlug = await this.prisma.topic.findMany({
      where: { slug: { in: missing } },
      select: { id: true },
    });
    const slugIds = new Set(bySlug.map((t) => t.id));
    // Values that are neither ids nor slugs are dropped silently — the form
    // offers pickers, and unknown entries must not 500 the save.
    return [...found, ...slugIds];
  }

  // ---------------------------------------------------------- blueprint

  /**
   * Resolve the blueprint for a requirement: the assessment's current
   * version when mode=assessment_specific and an assessment is set,
   * otherwise the 'generic' assessment. Returns engine input + provenance.
   */
  async resolveBlueprint(requirement: {
    mode: string;
    assessmentId: string | null;
  }): Promise<{ input: BlueprintInput; unverified: boolean }> {
    let assessmentId = requirement.assessmentId;
    let unverified = false;
    if (requirement.mode !== 'assessment_specific' || !assessmentId) {
      const generic = await this.prisma.assessment.findUnique({ where: { slug: 'generic' } });
      if (!generic) {
        // No blueprint at all — planner still works on priors only.
        return {
          input: {
            slug: 'none',
            sourceType: 'assumption',
            confidence: 'low',
            negativeMarking: null,
            weights: [],
          },
          unverified: true,
        };
      }
      assessmentId = generic.id;
      unverified = true;
    }

    const version = await this.prisma.assessmentVersion.findFirst({
      where: { assessmentId: assessmentId!, isCurrent: true },
      include: {
        sections: {
          include: {
            source: true,
            weights: {
              include: { topic: { select: { id: true, slug: true, level: true, parentId: true } } },
            },
          },
          orderBy: { orderNo: 'asc' },
        },
      },
    });
    if (!version || version.sections.length === 0) {
      return {
        input: {
          slug: 'none',
          sourceType: 'assumption',
          confidence: 'low',
          negativeMarking: null,
          weights: [],
        },
        unverified: true,
      };
    }

    // Section share: duration-weighted, equal split when durations absent.
    const totalDuration = version.sections.reduce((a, s) => a + (s.durationMin ?? 0), 0);
    const sectionCount = version.sections.length;
    const sectionShare = (s: { durationMin: number | null }) =>
      totalDuration > 0 ? (s.durationMin ?? 0) / totalDuration : 1 / sectionCount;

    const weights: BlueprintWeightInput[] = [];
    const seen = new Map<string, number>();
    let worstRank = 99;
    let worstSource = 'assumption';
    let worstConfRank = 99;
    let worstConfidence = 'low';
    let negativeMarking: number | null = null;

    for (const section of version.sections) {
      const sShare = sectionShare(section);
      const src = section.source;
      const srcType = src?.sourceType ?? 'assumption';
      const rank = SOURCE_RANK[srcType] ?? 0;
      if (rank < worstRank) {
        worstRank = rank;
        worstSource = srcType;
      }
      const confRank = src?.confidence === 'high' ? 2 : src?.confidence === 'medium' ? 1 : 0;
      if (confRank < worstConfRank) {
        worstConfRank = confRank;
        worstConfidence = src?.confidence ?? 'low';
      }
      if (negativeMarking === null && section.negativeMarking !== null) {
        negativeMarking = Number(section.negativeMarking);
      }
      for (const w of section.weights) {
        // Only topic-level weights feed the planner.
        if (w.topic.level !== 'topic') continue;
        const globalShare = sShare * Number(w.share);
        const prev = seen.get(w.topicId) ?? 0;
        seen.set(w.topicId, prev + globalShare);
        weights.push({
          topicId: w.topicId,
          share: globalShare,
          difficultyBand: w.difficultyBand,
          paceSeconds: w.paceSeconds,
          sectionSlug: null,
        });
      }
    }
    // Merge duplicate topic weights (same topic in multiple sections).
    const merged = new Map<string, BlueprintWeightInput>();
    for (const w of weights) {
      const prev = merged.get(w.topicId);
      if (prev) prev.share += w.share;
      else merged.set(w.topicId, { ...w });
    }
    const weightList = [...merged.values()];
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId! },
      select: { slug: true },
    });

    return {
      input: {
        slug: assessment?.slug ?? 'generic',
        sourceType: worstSource,
        confidence: worstConfidence,
        negativeMarking,
        weights: weightList,
      },
      unverified,
    };
  }

  // ---------------------------------------------------------- plan build

  private async loadProfileInputs(userId: string): Promise<{
    priorityInputs: PriorityTopicInput[];
    readinessInputs: ReadinessTopicInput[];
    paceByTopic: Map<string, number>;
    difficultyByTopic: Map<string, number>;
  }> {
    const rows = await this.prisma.studentTopicProfile.findMany({
      where: { userId },
      include: { topic: { select: { id: true, slug: true, level: true } } },
    });
    const priorityInputs: PriorityTopicInput[] = [];
    const readinessInputs: ReadinessTopicInput[] = [];
    const paceByTopic = new Map<string, number>();
    const difficultyByTopic = new Map<string, number>();
    for (const r of rows) {
      const errorMix = (r.errorMix ?? {}) as {
        reported?: Record<string, number>;
        inferred?: Record<string, number>;
      };
      const rating = r.rating;
      const rd = r.rd;
      const attemptCount = r.attemptCount;
      const thinEvidence = attemptCount < THIN_EVIDENCE_MIN_ATTEMPTS;
      priorityInputs.push({
        topicId: r.topicId,
        slug: r.topic.slug,
        rating,
        rd,
        attemptCount,
        accuracyEma: r.accuracyEma,
        errorMix: {
          reported: errorMix.reported ?? {},
          inferred: errorMix.inferred ?? {},
        },
        thinEvidence,
        label: labelFor(rating, rd),
      });
      readinessInputs.push({
        topicId: r.topicId,
        rating,
        rd,
        attemptCount,
        paceRatio: null, // filled below when blueprint pace is known
        thinEvidence,
      });
      difficultyByTopic.set(r.topicId, rating >= 1650 ? 3 : rating <= 1350 ? 1 : 2);
    }
    return { priorityInputs, readinessInputs, paceByTopic, difficultyByTopic };
  }

  private planDays(
    requirement: { deadlineDate: Date; minutesPerWeekday: unknown },
    override?: MinutesPerWeekday,
  ): { date: string; budgetMinutes: number }[] {
    const minutes = {
      ...(requirement.minutesPerWeekday as Record<string, number>),
      ...(override ?? {}),
    };
    const days: { date: string; budgetMinutes: number }[] = [];
    const today = todayUtc();
    const deadline = new Date(requirement.deadlineDate);
    for (let d = today; d <= deadline && days.length < 31; d = new Date(d.getTime() + DAY_MS)) {
      const mins = minutes[weekdayKey(d)] ?? 0;
      if (mins > 0) days.push({ date: toIsoDate(d), budgetMinutes: mins });
    }
    return days;
  }

  /** E-030 — generate (or regenerate) the current plan. */
  async generatePlan(
    userId: string,
    requirementId: string,
    trigger: 'setup' | 'requirements_change' | 'session' | 'reassessment' | 'restore' = 'setup',
    override?: MinutesPerWeekday,
  ) {
    const requirement = await this.prisma.preparationRequirement.findFirst({
      where: { id: requirementId, userId },
    });
    if (!requirement)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Requirement not found' });

    const { blueprint, unverified, candidates, readinessInputs } = await this.buildEngineInputs(
      userId,
      requirement,
    );

    const days = this.planDays(requirement, override).map((d) => ({
      ...d,
      pinned: [] as never[],
    }));

    const result = enginePlan({ days, candidates });

    // Persist: supersede current plan, insert new plan + items + change log.
    const snapshot = await this.prisma.profileSnapshot.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      select: { id: true },
    });

    const planRow = await this.prisma.$transaction(async (tx) => {
      await tx.practicePlan.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
      const plan = await tx.practicePlan.create({
        data: {
          userId,
          requirementId: requirement.id,
          snapshotId: snapshot?.id ?? null,
          trigger,
          plannerMethod: result.plannerMethod,
          elapsedMs: result.elapsedMs,
          engineVersion: ENGINE_VERSION,
          isCurrent: true,
        },
      });
      if (result.items.length) {
        await tx.practicePlanItem.createMany({
          data: result.items.map((i) => ({
            planId: plan.id,
            dayIndex: i.dayIndex,
            orderNo: i.orderNo,
            blockType: i.blockType,
            topicId: i.topicId,
            minutes: i.minutes,
            pinned: i.pinned,
            rationale: {
              ...(i.rationale as object),
              blueprintSlug: blueprint.slug,
              blueprintUnverified: unverified,
            } as object,
          })),
        });
      }
      await tx.planChangeLog.create({
        data: {
          planId: plan.id,
          userId,
          trigger,
          summary: {
            reason: trigger === 'setup' ? 'requirements_saved' : trigger,
            itemCount: result.items.length,
            dayCount: result.days.length,
            plannerMethod: result.plannerMethod,
            elapsedMs: result.elapsedMs,
            engineVersion: ENGINE_VERSION,
            blueprintSlug: blueprint.slug,
            blueprintUnverified: unverified,
          } as object,
        },
      });
      return plan;
    });

    // Readiness estimate alongside the plan (17.8: runs at plan start).
    try {
      await this.persistReadiness(userId, requirement.id, blueprint, readinessInputs);
    } catch (err) {
      this.logger.warn(`readiness estimate failed: ${String(err).slice(0, 160)}`);
    }

    return this.getPlanById(userId, planRow.id);
  }

  private async persistReadiness(
    userId: string,
    requirementId: string,
    blueprint: BlueprintInput,
    topics: ReadinessTopicInput[],
  ) {
    const band = readinessBand(topics, blueprint, ENGINE_VERSION);
    await this.prisma.readinessEstimate.create({
      data: {
        userId,
        requirementId,
        bandLow: band.bandLow,
        bandHigh: band.bandHigh,
        confidence: band.confidence,
        factors: {
          blueprintSlug: band.blueprintSlug,
          sourceType: band.blueprintSourceType,
          blueprintConfidence: band.blueprintConfidence,
          negativeMarking: band.negativeMarking,
          topics: band.topics,
        } as object,
        engineVersion: band.engineVersion,
      },
    });
  }

  async generateForActiveRequirement(userId: string, body: GeneratePlanBody | undefined) {
    const requirement = await this.prisma.preparationRequirement.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!requirement) {
      throw new ConflictException({
        code: 'NO_REQUIREMENTS',
        message: 'Save your preparation requirements first',
      });
    }
    // Regenerate: new current plan, trigger requirements_change when the
    // requirement itself was just edited, else 'setup' for first generation.
    const hasCurrent = await this.prisma.practicePlan.findFirst({
      where: { userId, isCurrent: true },
      select: { id: true },
    });
    const trigger = hasCurrent ? 'requirements_change' : 'setup';
    return this.generatePlan(userId, requirement.id, trigger, body?.minutesPerWeekday);
  }

  // ---------------------------------------------------------- E-031..E-033

  /** Shared engine inputs for plan generation and post-session regen. */
  private async buildEngineInputs(
    userId: string,
    requirement: {
      deadlineDate: Date;
      testDate: Date;
      wantedTopics: unknown;
      mode: string;
      assessmentId: string | null;
    },
  ) {
    const { input: blueprint, unverified } = await this.resolveBlueprint(requirement);
    const { priorityInputs, readinessInputs, difficultyByTopic } =
      await this.loadProfileInputs(userId);

    const wanted = (requirement.wantedTopics as string[]) ?? [];
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(requirement.deadlineDate).getTime() - todayUtc().getTime()) / DAY_MS),
    );
    const prios = priorities(priorityInputs, blueprint, {
      testDate: toIsoDate(requirement.testDate),
      deadlineDate: toIsoDate(requirement.deadlineDate),
      daysLeft,
      wantedTopics: wanted,
    });

    const profileById = new Map(priorityInputs.map((p) => [p.topicId, p]));
    const lessonTopics = await this.prisma.lesson.findMany({
      where: { status: 'published' },
      select: { topicId: true },
      distinct: ['topicId'],
    });
    const topicsWithLessons = new Set(lessonTopics.map((l) => l.topicId));

    // PH9-T07 — recent 'too_easy'/'not_relevant' block feedback
    // suppresses a topic from new candidates for 14 days.
    const suppressed = await this.suppressedTopics(userId);
    const inputs = prios
      .filter((p) => !suppressed.has(p.topicId))
      .map((p) => {
        const prof = profileById.get(p.topicId);
        return {
          priority: p,
          accuracyEma: prof?.accuracyEma ?? null,
          errorMix: prof?.errorMix ?? { reported: {}, inferred: {} },
          difficultyBand: difficultyByTopic.get(p.topicId) ?? null,
        };
      });
    const candidates: PlanCandidate[] = buildCandidates(
      inputs.length
        ? inputs
        : prios.map((p) => {
            const prof = profileById.get(p.topicId);
            return {
              priority: p,
              accuracyEma: prof?.accuracyEma ?? null,
              errorMix: prof?.errorMix ?? { reported: {}, inferred: {} },
              difficultyBand: difficultyByTopic.get(p.topicId) ?? null,
            };
          }),
      { topicsWithLessons },
      {
        blueprintSource: blueprint.sourceType,
        daysLeft,
        cram: daysLeft <= 2, // PH9-T05: last 48h → drills/revision only
      },
    );
    return { blueprint, unverified, candidates, readinessInputs };
  }

  /**
   * PH8-T03 — regenerate the plan for FUTURE days only after a session.
   * Days up to and including today are carried over unchanged; the change
   * log records the top three differences. Idempotent by sessionId.
   */
  async regenerateFutureDays(userId: string, sessionId: string) {
    // PH9-T06 — keepMyPlan: profiles/snapshot/readiness still update,
    // but the plan is only regenerated when the student asks.
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { planSettings: true },
    });
    const settings = (owner?.planSettings ?? {}) as { keepMyPlan?: boolean };
    if (settings.keepMyPlan === true) return { skipped: 'keep_my_plan' };

    const current = await this.prisma.practicePlan.findFirst({
      where: { userId, isCurrent: true },
      include: {
        requirement: true,
        items: { include: { topic: { select: { slug: true, name: true } } } },
      },
    });
    if (!current) return { skipped: true };

    const already = await this.prisma.planChangeLog.findFirst({
      where: {
        userId,
        trigger: 'session',
        summary: { path: ['sessionId'], equals: sessionId },
      },
      select: { id: true },
    });
    if (already) return { skipped: true };

    const today = todayUtc();
    const todayIso = toIsoDate(today);
    // dayIndex is relative to the emitted day sequence; item rationale.date
    // carries the real date, so carried/future split on the date itself.
    const carried = current.items.filter((i) => {
      const d = (i.rationale as { date?: string }).date;
      return d !== undefined && d <= todayIso;
    });
    const oldFuture = current.items.filter((i) => {
      const d = (i.rationale as { date?: string }).date;
      return d === undefined || d > todayIso;
    });
    const maxCarried = carried.reduce((m, i) => Math.max(m, i.dayIndex), -1);
    const offset = maxCarried + 1;

    const future = this.planDays(current.requirement).filter((d) => d.date > todayIso);

    const { blueprint, unverified, candidates, readinessInputs } = await this.buildEngineInputs(
      userId,
      current.requirement,
    );

    const result = enginePlan({
      days: future.map((d) => ({
        date: d.date,
        budgetMinutes: d.budgetMinutes,
        pinned: [] as never[],
      })),
      candidates,
    });
    // engine dayIndex is local to `future`; absolute = offset + local.

    // Top-three change summary: per-day topic-set diff, old future vs new.
    const oldByDay = new Map<number, Set<string>>();
    for (const i of oldFuture) {
      const set = oldByDay.get(i.dayIndex) ?? new Set<string>();
      set.add(i.topic.slug);
      oldByDay.set(i.dayIndex, set);
    }
    const slugByTopic = new Map<string, string>(
      oldFuture.map((i) => [i.topicId, i.topic.slug] as const),
    );
    const missingSlugs = [...new Set(result.items.map((i) => i.topicId))].filter(
      (id) => !slugByTopic.has(id),
    );
    if (missingSlugs.length) {
      const topics = await this.prisma.topic.findMany({
        where: { id: { in: missingSlugs } },
        select: { id: true, slug: true },
      });
      for (const t of topics) slugByTopic.set(t.id, t.slug);
    }
    const newByDay = new Map<number, Set<string>>();
    for (const i of result.items) {
      // engine dayIndex is local to `future`; absolute = offset + local.
      const abs = offset + i.dayIndex;
      const slug = slugByTopic.get(i.topicId) ?? i.topicId.slice(0, 8);
      const set = newByDay.get(abs) ?? new Set<string>();
      set.add(slug.split(':')[0]!);
      newByDay.set(abs, set);
    }
    const changes: string[] = [];
    const allDayIdx = new Set([...oldByDay.keys(), ...newByDay.keys()]);
    for (const di of [...allDayIdx].sort((a, b) => a - b)) {
      const o = oldByDay.get(di) ?? new Set<string>();
      const n = newByDay.get(di) ?? new Set<string>();
      const added = [...n].filter((x) => !o.has(x));
      const removed = [...o].filter((x) => !n.has(x));
      if (added.length || removed.length) {
        changes.push(
          `Day ${di + 1}: ${[...added.map((a) => `+${a}`), ...removed.map((r) => `-${r}`)].join(', ')}`,
        );
      }
      if (changes.length >= 3) break;
    }

    const snapshot = await this.prisma.profileSnapshot.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      select: { id: true },
    });

    const newPlan = await this.prisma.$transaction(async (tx) => {
      await tx.practicePlan.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
      const plan = await tx.practicePlan.create({
        data: {
          userId,
          requirementId: current.requirementId,
          snapshotId: snapshot?.id ?? null,
          trigger: 'session',
          plannerMethod: result.plannerMethod,
          elapsedMs: result.elapsedMs,
          engineVersion: ENGINE_VERSION,
          isCurrent: true,
        },
      });
      // Carried items keep their dayIndex/orderNo; new items are offset.
      const rows: Prisma.PracticePlanItemCreateManyInput[] = [];
      for (const i of carried) {
        rows.push({
          planId: plan.id,
          dayIndex: i.dayIndex,
          orderNo: i.orderNo,
          blockType: i.blockType,
          topicId: i.topicId,
          minutes: i.minutes,
          pinned: i.pinned,
          rationale: i.rationale as Prisma.InputJsonValue,
          status: i.status,
        });
      }
      for (const i of result.items) {
        const abs = offset + i.dayIndex;
        rows.push({
          planId: plan.id,
          dayIndex: abs,
          orderNo: i.orderNo,
          blockType: i.blockType,
          topicId: i.topicId,
          minutes: i.minutes,
          pinned: i.pinned,
          rationale: {
            ...(i.rationale as object),
            blueprintSlug: blueprint.slug,
            blueprintUnverified: unverified,
          } as Prisma.InputJsonValue,
        });
      }
      if (rows.length) await tx.practicePlanItem.createMany({ data: rows });
      await tx.planChangeLog.create({
        data: {
          planId: plan.id,
          userId,
          trigger: 'session',
          summary: {
            sessionId,
            reason: 'session_finished',
            itemCount: rows.length,
            plannerMethod: result.plannerMethod,
            engineVersion: ENGINE_VERSION,
            blueprintSlug: blueprint.slug,
            blueprintUnverified: unverified,
            changes: changes.slice(0, 3),
          } as Prisma.InputJsonValue,
        },
      });
      return plan;
    });

    try {
      await this.persistReadiness(userId, current.requirementId, blueprint, readinessInputs);
    } catch (err) {
      this.logger.warn(`readiness estimate failed: ${String(err).slice(0, 160)}`);
    }
    return { planId: newPlan.id, changes: changes.slice(0, 3), skipped: false };
  }

  /** Topics suppressed by recent block feedback (14-day window). */
  private async suppressedTopics(userId: string): Promise<Set<string>> {
    const cutoff = Date.now() - 14 * 86_400_000;
    const items = await this.prisma.practicePlanItem.findMany({
      where: { plan: { userId } },
      select: { topicId: true, rationale: true },
      take: 5000,
    });
    const out = new Set<string>();
    for (const i of items) {
      const fb = (i.rationale as { feedback?: { reason?: string; at?: string }[] }).feedback;
      if (
        Array.isArray(fb) &&
        fb.some(
          (f) =>
            (f.reason === 'too_easy' || f.reason === 'not_relevant') &&
            f.at !== undefined &&
            Date.parse(f.at) >= cutoff,
        )
      ) {
        out.add(i.topicId);
      }
    }
    return out;
  }

  /** E-034 — restore an earlier plan version for future days only. */
  async restorePlan(userId: string, planId: string) {
    const source = await this.prisma.practicePlan.findFirst({
      where: { id: planId, userId },
      include: { items: true, requirement: true },
    });
    if (!source) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan not found' });

    const current = await this.prisma.practicePlan.findFirst({
      where: { userId, isCurrent: true },
      include: { items: true },
    });
    const todayIso = toIsoDate(todayUtc());
    const carried = (current?.items ?? []).filter((i) => {
      const d = (i.rationale as { date?: string }).date;
      return d !== undefined && d <= todayIso;
    });
    const restored = source.items.filter((i) => {
      const d = (i.rationale as { date?: string }).date;
      return d === undefined || d > todayIso;
    });
    const maxCarried = carried.reduce((m, i) => Math.max(m, i.dayIndex), -1);
    const offset = maxCarried + 1;
    // Re-index restored items so dayIndex continues after carried days.
    const minDay = restored.reduce((m, i) => Math.min(m, i.dayIndex), Infinity);
    const dayShift = Number.isFinite(minDay) ? offset - minDay : 0;

    const snapshot = await this.prisma.profileSnapshot.findFirst({
      where: { userId },
      orderBy: { takenAt: 'desc' },
      select: { id: true },
    });

    const newPlan = await this.prisma.$transaction(async (tx) => {
      await tx.practicePlan.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });
      const plan = await tx.practicePlan.create({
        data: {
          userId,
          requirementId: source.requirementId,
          snapshotId: snapshot?.id ?? null,
          trigger: 'restore',
          plannerMethod: source.plannerMethod,
          elapsedMs: source.elapsedMs,
          engineVersion: source.engineVersion,
          isCurrent: true,
        },
      });
      const rows: Prisma.PracticePlanItemCreateManyInput[] = [];
      for (const i of carried) {
        rows.push({
          planId: plan.id,
          dayIndex: i.dayIndex,
          orderNo: i.orderNo,
          blockType: i.blockType,
          topicId: i.topicId,
          minutes: i.minutes,
          pinned: i.pinned,
          rationale: i.rationale as Prisma.InputJsonValue,
          status: i.status,
        });
      }
      for (const i of restored) {
        rows.push({
          planId: plan.id,
          dayIndex: i.dayIndex + dayShift,
          orderNo: i.orderNo,
          blockType: i.blockType,
          topicId: i.topicId,
          minutes: i.minutes,
          pinned: i.pinned,
          rationale: i.rationale as Prisma.InputJsonValue,
          status: 'pending',
        });
      }
      if (rows.length) await tx.practicePlanItem.createMany({ data: rows });
      await tx.planChangeLog.create({
        data: {
          planId: plan.id,
          userId,
          trigger: 'restore',
          summary: {
            restoredFromPlanId: planId,
            carriedItems: carried.length,
            restoredItems: restored.length,
            engineVersion: source.engineVersion,
          } as Prisma.InputJsonValue,
        },
      });
      return plan;
    });
    return { planId: newPlan.id, restoredItems: restored.length, carriedItems: carried.length };
  }

  /** E-035 — plan settings: keepMyPlan, pins, reminder limits. */
  async updatePlanSettings(
    userId: string,
    dto: {
      keepMyPlan?: boolean | undefined;
      pins?: string[] | undefined;
      reminderLimits?: Record<string, unknown> | undefined;
    },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planSettings: true },
    });
    const current = (user.planSettings ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current };
    if (dto.keepMyPlan !== undefined) next.keepMyPlan = dto.keepMyPlan;
    if (dto.reminderLimits !== undefined) next.reminderLimits = dto.reminderLimits;

    await this.prisma.$transaction(async (tx) => {
      if (dto.pins !== undefined) {
        const pinSet = new Set(dto.pins);
        const items = await tx.practicePlanItem.findMany({
          where: { plan: { userId, isCurrent: true } },
          select: { id: true, pinned: true },
        });
        for (const i of items) {
          const want = pinSet.has(i.id);
          if (want !== i.pinned) {
            await tx.practicePlanItem.update({ where: { id: i.id }, data: { pinned: want } });
          }
        }
        next.pins = dto.pins;
      }
      await tx.user.update({
        where: { id: userId },
        data: { planSettings: next as Prisma.InputJsonValue },
      });
    });
    return { planSettings: next };
  }

  async getPlanSettings(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planSettings: true },
    });
    return { planSettings: (user.planSettings ?? {}) as Record<string, unknown> };
  }

  /** Plan version history (P-16). */
  async listPlans(userId: string) {
    const plans = await this.prisma.practicePlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        trigger: true,
        plannerMethod: true,
        engineVersion: true,
        isCurrent: true,
        createdAt: true,
        elapsedMs: true,
        _count: { select: { items: true } },
      },
    });
    return {
      plans: plans.map((p) => ({
        planId: p.id,
        trigger: p.trigger,
        plannerMethod: p.plannerMethod,
        engineVersion: p.engineVersion,
        isCurrent: p.isCurrent,
        createdAt: p.createdAt,
        elapsedMs: p.elapsedMs,
        itemCount: p._count.items,
      })),
    };
  }

  /** PH9-T07 — block feedback: already know / too easy / not relevant. */
  async addItemFeedback(
    userId: string,
    planId: string,
    itemId: string,
    reason: 'already_know' | 'too_easy' | 'not_relevant',
    note?: string,
  ) {
    const item = await this.prisma.practicePlanItem.findFirst({
      where: { id: itemId, planId, plan: { userId } },
    });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan item not found' });
    const rationale = (item.rationale ?? {}) as Record<string, unknown>;
    const feedback = Array.isArray(rationale.feedback) ? [...(rationale.feedback as object[])] : [];
    feedback.push({ reason, note: note ?? null, at: new Date().toISOString() });
    await this.prisma.practicePlanItem.update({
      where: { id: itemId },
      data: { rationale: { ...rationale, feedback } as Prisma.InputJsonValue },
    });
    return { itemId, reason, recorded: true };
  }

  private async getPlanById(userId: string, planId: string) {
    const plan = await this.prisma.practicePlan.findFirst({
      where: { id: planId, userId },
      include: {
        items: {
          orderBy: [{ dayIndex: 'asc' }, { orderNo: 'asc' }],
          include: { topic: { select: { id: true, slug: true, name: true } } },
        },
      },
    });
    if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan not found' });
    return {
      planId: plan.id,
      plannerMethod: plan.plannerMethod,
      elapsedMs: plan.elapsedMs,
      engineVersion: plan.engineVersion,
      trigger: plan.trigger,
      isCurrent: plan.isCurrent,
      createdAt: plan.createdAt,
      items: plan.items.map((i) => ({
        id: i.id,
        dayIndex: i.dayIndex,
        orderNo: i.orderNo,
        blockType: i.blockType,
        topic: i.topic,
        minutes: i.minutes,
        pinned: i.pinned,
        rationale: i.rationale,
        status: i.status,
      })),
    };
  }

  /** GET /me/plans/:planId — any owned version (history/compare). */
  async getPlan(userId: string, planId: string) {
    return this.getPlanById(userId, planId);
  }

  async getCurrentPlan(userId: string) {
    const plan = await this.prisma.practicePlan.findFirst({
      where: { userId, isCurrent: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'No plan yet' });
    }
    return this.getPlanById(userId, plan.id);
  }

  async getItemRationale(userId: string, planId: string, itemId: string) {
    const item = await this.prisma.practicePlanItem.findFirst({
      where: { id: itemId, planId },
      include: { plan: { select: { userId: true } } },
    });
    if (!item || item.plan.userId !== userId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item not found' });
    }
    return { itemId: item.id, rationale: item.rationale };
  }

  /** E-033 — change history for the student (newest first). */
  async getChanges(userId: string, planId?: string) {
    const rows = await this.prisma.planChangeLog.findMany({
      where: planId ? { userId, planId } : { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { plan: { select: { id: true, isCurrent: true, createdAt: true } } },
    });
    return {
      changes: rows.map((r) => ({
        id: r.id,
        planId: r.planId,
        trigger: r.trigger,
        summary: r.summary,
        restoredFrom: r.restoredFrom,
        createdAt: r.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------- E-036

  async getReadiness(userId: string): Promise<Record<string, unknown>> {
    const latest = await this.prisma.readinessEstimate.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      return {
        estimateId: latest.id,
        bandLow: Number(latest.bandLow),
        bandHigh: Number(latest.bandHigh),
        confidence: latest.confidence,
        factors: latest.factors,
        engineVersion: latest.engineVersion,
        createdAt: latest.createdAt,
        disclaimer:
          'Practice-based estimates on our version of the test blueprint — not a prediction of any employer result.',
      };
    }
    // No stored estimate — compute one live from the active requirement.
    const requirement = await this.prisma.preparationRequirement.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!requirement) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'No requirements or estimate yet',
      });
    }
    const { input: blueprint } = await this.resolveBlueprint(requirement);
    const { readinessInputs } = await this.loadProfileInputs(userId);
    await this.persistReadiness(userId, requirement.id, blueprint, readinessInputs);
    return this.getReadiness(userId);
  }
}
