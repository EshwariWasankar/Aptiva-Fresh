import { describe, expect, it } from 'vitest';
import {
  blendBlueprints,
  priorities,
  type BlueprintInput,
  type PriorityTopicInput,
  type RequirementInput,
  type TargetInput,
} from '../src/priority.js';

describe('blendBlueprints (PH13-T03, FR-022)', () => {
  const blueprintA: BlueprintInput = {
    slug: 'company-a',
    sourceType: 'company_pattern',
    confidence: 'high',
    negativeMarking: -0.25,
    weights: [
      {
        topicId: 'topic-quant-1',
        share: 0.6,
        difficultyBand: 3,
        paceSeconds: 90,
        sectionSlug: 'quant',
      },
      {
        topicId: 'topic-logical-1',
        share: 0.4,
        difficultyBand: 2,
        paceSeconds: 60,
        sectionSlug: 'logical',
      },
    ],
  };

  const blueprintB: BlueprintInput = {
    slug: 'company-b',
    sourceType: 'company_pattern',
    confidence: 'high',
    negativeMarking: 0,
    weights: [
      {
        topicId: 'topic-quant-1',
        share: 0.2,
        difficultyBand: 2,
        paceSeconds: 80,
        sectionSlug: 'quant',
      },
      {
        topicId: 'topic-verbal-1',
        share: 0.8,
        difficultyBand: 4,
        paceSeconds: 45,
        sectionSlug: 'verbal',
      },
    ],
  };

  it('blends two target blueprints according to weight split', () => {
    const targets: TargetInput[] = [
      {
        company: 'Company A',
        targetDate: '2026-11-25',
        daysLeft: 10,
        weight: 0.7,
        blueprint: blueprintA,
      },
      {
        company: 'Company B',
        targetDate: '2026-12-15',
        daysLeft: 30,
        weight: 0.3,
        blueprint: blueprintB,
      },
    ];

    const blended = blendBlueprints(targets);

    expect(blended.targetCount).toBe(2);
    expect(blended.blueprint.slug).toBe('blended-company-a-company-b');
    // quant-1: (0.6*0.7 + 0.2*0.3) = 0.42 + 0.06 = 0.48
    // logical-1: 0.4*0.7 = 0.28
    // verbal-1: 0.8*0.3 = 0.24
    // sum = 1.0
    const quantWeight = blended.blueprint.weights.find((w) => w.topicId === 'topic-quant-1');
    const logicalWeight = blended.blueprint.weights.find((w) => w.topicId === 'topic-logical-1');
    const verbalWeight = blended.blueprint.weights.find((w) => w.topicId === 'topic-verbal-1');

    expect(quantWeight).toBeDefined();
    expect(logicalWeight).toBeDefined();
    expect(verbalWeight).toBeDefined();

    expect(quantWeight!.share).toBeCloseTo(0.48, 2);
    expect(logicalWeight!.share).toBeCloseTo(0.28, 2);
    expect(verbalWeight!.share).toBeCloseTo(0.24, 2);

    // Effective days left: 10*0.7 + 30*0.3 = 7 + 9 = 16
    expect(blended.effectiveDaysLeft).toBe(16);
  });

  it('produces one coherent priorities list from blended targets', () => {
    const targets: TargetInput[] = [
      {
        company: 'Company A',
        targetDate: '2026-11-25',
        daysLeft: 10,
        weight: 0.7,
        blueprint: blueprintA,
      },
      {
        company: 'Company B',
        targetDate: '2026-12-15',
        daysLeft: 30,
        weight: 0.3,
        blueprint: blueprintB,
      },
    ];

    const blended = blendBlueprints(targets);

    const topics: PriorityTopicInput[] = [
      {
        topicId: 'topic-quant-1',
        slug: 'ratios',
        rating: 1350,
        rd: 150,
        attemptCount: 15,
        accuracyEma: 0.5,
        errorMix: { reported: {}, inferred: {} },
        thinEvidence: false,
        label: 'weak',
      },
      {
        topicId: 'topic-logical-1',
        slug: 'syllogisms',
        rating: 1450,
        rd: 120,
        attemptCount: 20,
        accuracyEma: 0.65,
        errorMix: { reported: {}, inferred: {} },
        thinEvidence: false,
        label: 'moderate',
      },
      {
        topicId: 'topic-verbal-1',
        slug: 'reading-comp',
        rating: 1400,
        rd: 130,
        attemptCount: 10,
        accuracyEma: 0.6,
        errorMix: { reported: {}, inferred: {} },
        thinEvidence: false,
        label: 'moderate',
      },
    ];

    const req: RequirementInput = {
      testDate: '2026-11-25',
      deadlineDate: '2026-11-25',
      daysLeft: blended.effectiveDaysLeft,
      wantedTopics: [],
    };

    const result = priorities(topics, blended.blueprint, req);
    expect(result.length).toBe(3);
    // quant-1 has highest blended share (0.48) and lowest proficiency (1350) -> highest priority
    expect(result[0]!.topicId).toBe('topic-quant-1');
  });
});
