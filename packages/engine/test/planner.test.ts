import { describe, expect, it } from 'vitest';
import {
  buildCandidates,
  plan,
  priorities,
  readinessBand,
  type BlueprintInput,
  type CandidateTopicInput,
  type PlanCandidate,
  type PriorityTopicInput,
} from '../src/index.js';

const topic = (over: Partial<PriorityTopicInput> = {}): PriorityTopicInput => ({
  topicId: 't1',
  slug: 'topic-one',
  rating: 1200,
  rd: 200,
  attemptCount: 20,
  accuracyEma: 0.5,
  errorMix: { reported: {}, inferred: { concept: 3 } },
  thinEvidence: false,
  label: 'weak',
  ...over,
});

const blueprint = (weights: BlueprintInput['weights']): BlueprintInput => ({
  slug: 'generic',
  sourceType: 'public',
  confidence: 'medium',
  negativeMarking: null,
  weights,
});

const req = (daysLeft = 10) => ({
  testDate: '2026-12-01',
  deadlineDate: '2026-11-30',
  daysLeft,
  wantedTopics: [] as string[],
});

function makeCandidates(n: number, minutesEach = 20): PlanCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    candidateId: `t${i}:targeted_practice`,
    topicId: `t${i}`,
    blockType: 'targeted_practice' as const,
    minutes: minutesEach,
    gain: 10 - i * 0.01,
    gainPerMinute: (10 - i * 0.01) / minutesEach,
    priority: 1,
    difficultyBand: 2,
    rationaleSeed: {
      accuracy: 0.5,
      conceptualShare: 0.3,
      blueprintShare: 0.1,
      blueprintSource: 'public',
      daysLeft: 10,
      priority: 1,
      expectedGain: 100,
      wouldChangeIf: 'x',
    },
  }));
}

describe('T-ML-05 priorities', () => {
  it('gap zero gives priority zero; monotone in gap; factors in [0,1]', () => {
    const bp = blueprint([
      { topicId: 't1', share: 1, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
    ]);
    // Proficiency 90 (rating 1900) >> target ~85 → gap 0 → priority 0.
    const strong = priorities([topic({ rating: 1900, label: 'strong' })], bp, req());
    expect(strong[0]!.priority).toBe(0);
    expect(strong[0]!.maintenance).toBe(true);

    // Lower rating → larger gap → higher priority.
    const p1 = priorities([topic({ rating: 1500 })], bp, req());
    const p2 = priorities([topic({ rating: 1300 })], bp, req());
    const p3 = priorities([topic({ rating: 1100 })], bp, req());
    expect(p3[0]!.priority).toBeGreaterThan(p2[0]!.priority);
    expect(p2[0]!.priority).toBeGreaterThan(p1[0]!.priority);

    for (const f of Object.values(p1[0]!.factors)) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('thin-evidence topics get lower priority factor but remain candidates', () => {
    const bp = blueprint([
      { topicId: 't1', share: 1, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
    ]);
    const thin = priorities([topic({ thinEvidence: true, attemptCount: 3 })], bp, req());
    const full = priorities([topic({ thinEvidence: false, attemptCount: 20 })], bp, req());
    expect(thin[0]!.thinEvidence).toBe(true);
    expect(thin[0]!.priority).toBeLessThan(full[0]!.priority);
  });
});

describe('T-ML-06 planner properties', () => {
  it('minutes sum exactly to budget; deterministic; pins preserved', () => {
    const cands = makeCandidates(30);
    const input = {
      days: [
        {
          date: '2026-11-12',
          budgetMinutes: 45,
          pinned: [{ blockType: 'probe', topicId: 'tp', minutes: 10 }],
        },
        { date: '2026-11-13', budgetMinutes: 45 },
      ],
      candidates: cands,
    };
    const a = plan(input);
    const b = plan(input);
    expect(a.items.map((i) => [i.dayIndex, i.minutes, i.topicId, i.blockType])).toEqual(
      b.items.map((i) => [i.dayIndex, i.minutes, i.topicId, i.blockType]),
    );
    for (const d of a.days) {
      const sum = a.items
        .filter((i) => i.dayIndex === d.dayIndex)
        .reduce((s, i) => s + i.minutes, 0);
      expect(sum).toBe(d.budgetMinutes);
    }
    const pinned = a.items.filter((i) => i.pinned);
    expect(pinned).toHaveLength(1);
    expect(pinned[0]!.minutes).toBe(10);
    expect(a.items.filter((i) => !i.pinned).every((i) => i.rationale.priority !== undefined)).toBe(
      true,
    );
  });

  it('never more than two consecutive blocks from one topic', () => {
    // Force same-topic dominance: many candidates same topic.
    const cands = makeCandidates(3).map((c) => ({ ...c, topicId: 'same' }));
    const out = plan({ days: [{ date: 'd', budgetMinutes: 45 }], candidates: cands });
    const seq = out.items.map((i) => i.topicId);
    let run = 1;
    for (let i = 1; i < seq.length; i++) {
      run = seq[i] === seq[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });
});

describe('T-ML-07 planner deadline', () => {
  it('budgetMs=0 forces fallback within 300ms', () => {
    const cands = makeCandidates(200);
    const t0 = Date.now();
    const out = plan({
      days: [{ date: 'd', budgetMinutes: 45 }],
      candidates: cands,
      budgetMs: 0,
    });
    expect(out.plannerMethod).toBe('fallback');
    expect(Date.now() - t0).toBeLessThan(300);
    const sum = out.items.reduce((s, i) => s + i.minutes, 0);
    expect(sum).toBe(45);
  });
});

describe('T-ML-08 golden-ish plans', () => {
  it('45- and 15-minute plans differ and each sums to budget', () => {
    const topics = [
      topic({ topicId: 'a', slug: 'alpha', rating: 1100 }),
      topic({ topicId: 'b', slug: 'beta', rating: 1400 }),
      topic({ topicId: 'c', slug: 'gamma', rating: 1600 }),
    ];
    const bp = blueprint([
      { topicId: 'a', share: 0.5, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
      { topicId: 'b', share: 0.3, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
      { topicId: 'c', share: 0.2, difficultyBand: 2, paceSeconds: null, sectionSlug: 'verbal' },
    ]);
    const pr = priorities(topics, bp, req());
    const inputs: CandidateTopicInput[] = topics.map((t) => ({
      priority: pr.find((p) => p.topicId === t.topicId)!,
      accuracyEma: t.accuracyEma,
      errorMix: t.errorMix,
      difficultyBand: 2,
    }));
    const cands = buildCandidates(
      inputs,
      { topicsWithLessons: new Set() },
      {
        blueprintSource: 'public',
        daysLeft: 10,
      },
    );
    expect(cands.length).toBeGreaterThan(0);

    const p45 = plan({ days: [{ date: 'd1', budgetMinutes: 45 }], candidates: cands });
    const p15 = plan({ days: [{ date: 'd1', budgetMinutes: 15 }], candidates: cands });
    expect(p45.items.reduce((s, i) => s + i.minutes, 0)).toBe(45);
    expect(p15.items.reduce((s, i) => s + i.minutes, 0)).toBe(15);
    expect(p45.items.length).toBeGreaterThan(p15.items.length);
    // Every item carries rationale.
    expect(p45.items.every((i) => i.rationale && typeof i.rationale === 'object')).toBe(true);
  });
});

describe('PH9-T05 cram mode', () => {
  it('daysLeft<=2 produces only drill/revision block types', () => {
    const topics = [
      topic({ topicId: 'a', slug: 'alpha', rating: 1100 }),
      topic({ topicId: 'b', slug: 'beta', rating: 1400 }),
    ];
    const bp = blueprint([
      { topicId: 'a', share: 0.5, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
      { topicId: 'b', share: 0.5, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
    ]);
    const pr = priorities(topics, bp, req());
    const inputs: CandidateTopicInput[] = topics.map((t) => ({
      priority: pr.find((p) => p.topicId === t.topicId)!,
      accuracyEma: t.accuracyEma,
      errorMix: { reported: { conceptual: 0.8 }, inferred: {} },
      difficultyBand: 2,
    }));
    const lessons = new Set(['a']);
    buildCandidates(
      inputs,
      { topicsWithLessons: lessons },
      {
        blueprintSource: 'public',
        daysLeft: 10,
      },
    );
    const cram = buildCandidates(
      inputs,
      { topicsWithLessons: lessons },
      {
        blueprintSource: 'public',
        daysLeft: 1,
        cram: true,
      },
    );
    // Normal mode may pick concept_repair; cram must not.
    const cramTypes = new Set(cram.map((c) => c.blockType));
    expect(cramTypes.has('concept_repair')).toBe(false);
    expect(cramTypes.has('targeted_practice')).toBe(false);
    for (const t of cramTypes) {
      expect([
        'speed_drill',
        'formula_revision',
        'short_review',
        'timed_set',
        'mixed_check',
        'maintenance',
        'probe',
      ]).toContain(t);
    }
  });
});

describe('T-ML-12 readiness band', () => {
  it('returns a band with confidence, never a bare number', () => {
    const bp = blueprint([
      { topicId: 'a', share: 0.6, difficultyBand: 2, paceSeconds: null, sectionSlug: 'quant' },
      { topicId: 'b', share: 0.4, difficultyBand: 2, paceSeconds: null, sectionSlug: 'verbal' },
    ]);
    const out = readinessBand(
      [
        {
          topicId: 'a',
          rating: 1600,
          rd: 120,
          attemptCount: 30,
          paceRatio: 1.0,
          thinEvidence: false,
        },
        {
          topicId: 'b',
          rating: 1300,
          rd: 250,
          attemptCount: 4,
          paceRatio: 1.5,
          thinEvidence: true,
        },
      ],
      bp,
      'test',
    );
    expect(out.bandLow).toBeLessThanOrEqual(out.expected);
    expect(out.expected).toBeLessThanOrEqual(out.bandHigh);
    expect(['low', 'medium', 'high']).toContain(out.confidence);
    expect(out.topics).toHaveLength(2);
  });
});
