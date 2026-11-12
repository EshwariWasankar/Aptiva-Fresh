import { describe, expect, it } from 'vitest';
import { parseDs01File } from '../src/parsers/ds01.js';
import { parseGsm8k } from '../src/parsers/dsm8k.js';
import { parseDs07File } from '../src/parsers/ds07.js';
import { parseAnswerLiteral, stemHash } from '../src/normalize.js';

const DS01_SAMPLE = `Percentage-1 - Placement Exercise
NOTE: This kind of question is very common in campus placement.

Problem:
What percent is 42 kg of 336 kg?

Solution:
Percentage = (Part / Whole) * 100
= (42 / 336) * 100 = 12.5

Final Answer:
42 kg is 12.5% of 336 kg.
`;

const DS01_MULTIPART = `Probability-1 - Placement Exercise

Problem:
Two coins are tossed. Find (a) two heads and (b) at least one head.

Solution:
P = favourable / total = 1/4 and 3/4

Final Answer:
(a) Probability of two heads = 1/4
(b) Probability of at least one head = 3/4
`;

const DS01_NONNUMERIC = `Ratio-1 - Placement Exercise

Problem:
Find the ratio of two numbers.

Solution:
Ratio = 4 : 3

Final Answer:
The ratio is 4 : 3
`;

describe('parseDs01File (golden)', () => {
  it('parses a single-problem file into a numerical item', () => {
    const { items, rejected } = parseDs01File('Percentage/Percentage-1', DS01_SAMPLE);
    expect(rejected).toHaveLength(0);
    expect(items).toHaveLength(1);
    const q = items[0]!;
    expect(q.format).toBe('numerical');
    expect(q.numericAnswer).toBeCloseTo(12.5, 5);
    expect(q.topicHint).toBe('Percentage');
    expect(q.solution).toContain('12.5');
    expect(q.pool).toBe('practice');
    expect(q.tolerance).toBeGreaterThan(0);
  });

  it('rejects multi-part final answers', () => {
    const { items, rejected } = parseDs01File('Probability/Probability-1', DS01_MULTIPART);
    expect(items).toHaveLength(0);
    expect(rejected[0]!.reason).toMatch(/multi-part/);
  });

  it('rejects non-numeric final answers (e.g. ratios)', () => {
    const { items, rejected } = parseDs01File(
      'Ratio and Proportion/Ratio and Proportion-1',
      DS01_NONNUMERIC,
    );
    expect(items).toHaveLength(0);
    expect(rejected[0]!.reason).toMatch(/ratio|not a parseable number/);
  });

  it('rejects files without a Problem section', () => {
    const { rejected } = parseDs01File('X/Y-1', 'just some text\n');
    expect(rejected[0]!.reason).toMatch(/no Problem/);
  });
});

describe('parseGsm8k (golden)', () => {
  it('parses JSONL rows into numerical items', () => {
    const jsonl = [
      JSON.stringify({
        question:
          'Natalia sold clips to 48 friends in April, and then she sold half as many clips in May. How many clips did Natalia sell altogether?',
        answer: 'Natalia sold 48/2 = 24 clips in May. 48 + 24 = 72 clips. #### 72',
      }),
      JSON.stringify({ question: 'bad row', answer: 'no marker here' }),
      'not json',
    ].join('\n');
    const { items, rejected } = parseGsm8k(jsonl, 'train.jsonl');
    expect(items).toHaveLength(1);
    expect(items[0]!.numericAnswer).toBe(72);
    expect(items[0]!.difficultyPrior).toBe(1);
    expect(rejected).toHaveLength(2);
  });
});

const DS07_SAMPLE = `# TCS Online Assessment (OA)

| Section           | Difficulty |
| ----------------- | ---------- |
| Numerical Ability | ⭐⭐⭐        |
| Logical Reasoning | ⭐⭐         |

# Numerical Ability

### Arithmetic

* Percentages
* Profit and Loss
* Ratio and Proportion

### Time-Based Problems

* Time and Work
* Time, Speed and Distance

# Logical Reasoning

## Frequently Asked Topics

* Blood Relations
* Seating Arrangement
* Syllogisms

# Preparation Strategy

* Arithmetic
`;

describe('parseDs07File (golden)', () => {
  it('extracts section and topic records, skipping meta sections', () => {
    const { records, rejected } = parseDs07File('Companies/01-TCS/01-OA.md', DS07_SAMPLE);
    expect(rejected).toHaveLength(0);
    const sections = records.filter((r) => r.topicText === null);
    const topics = records.filter((r) => r.topicText !== null);
    expect(sections.map((s) => s.sectionName)).toEqual(['Numerical Ability', 'Logical Reasoning']);
    expect(topics.map((t) => t.topicText)).toContain('Percentages');
    expect(topics.map((t) => t.topicText)).toContain('Syllogisms');
    // Meta sections excluded.
    expect(records.some((r) => r.sectionName === 'Preparation Strategy')).toBe(false);
    // Difficulty note captured from the pattern table.
    const num = sections.find((s) => s.sectionName === 'Numerical Ability');
    expect(num?.difficultyNote).toBe('3/4');
    expect(records[0]!.company).toBe('TCS');
    expect(records[0]!.roundName).toBe('Online Assessment');
    expect(records[0]!.sourcePath).toBe('Companies/01-TCS/01-OA.md');
  });

  it('ignores non-OA files and reports empty OA files', () => {
    expect(parseDs07File('Companies/01-TCS/03-HR.md', '# HR').records).toHaveLength(0);
    const empty = parseDs07File('Companies/02-Accenture/01-OA.md', '');
    expect(empty.records).toHaveLength(0);
    expect(empty.rejected[0]!.reason).toBe('empty file');
  });
});

describe('normalize helpers', () => {
  it('parseAnswerLiteral handles ints, decimals, fractions, percents', () => {
    expect(parseAnswerLiteral('12.5')).toBe(12.5);
    expect(parseAnswerLiteral('1/4')).toBe(0.25);
    expect(parseAnswerLiteral('42%')).toBe(42);
    expect(parseAnswerLiteral('4 : 3')).toBeNull();
    expect(parseAnswerLiteral('yes')).toBeNull();
  });

  it('stemHash is stable and matches API normalisation shape', () => {
    expect(stemHash('Hello   World')).toBe(stemHash('hello world'));
    expect(stemHash('a<b>c')).toBe(stemHash('ac'));
  });
});

// ------------------------------------------------ DS-11 / DS-12 (MCQ)

import { parseDs11File } from '../src/parsers/ds11.js';
import { parseDs12Bank } from '../src/parsers/ds12.js';

describe('parseDs11File', () => {
  const bank = JSON.stringify([
    {
      category: 'Numerical',
      topic: 'algebra-equations',
      difficulty: 'hard',
      promptHTML: 'If <b>x</b> &amp; y satisfy x + y = 10, what is x &times; y when x = y?',
      options: ['20', '25', '30', '35', '40'],
      correct: 1,
      explanation: 'x = y = 5, so x &times; y = 25.',
    },
    {
      category: 'Verbal',
      topic: 'rc-main-idea',
      difficulty: 'very-hard',
      promptHTML: '',
      options: ['a'],
      correct: 0,
    },
  ]);

  it('parses MCQ rows with correct index and decoded entities', () => {
    const { items, rejected } = parseDs11File('banks/questions-x.json', bank);
    expect(items).toHaveLength(1);
    const q = items[0]!;
    expect(q.format).toBe('mcq');
    expect(q.stem).toContain('x × y');
    expect(q.options).toHaveLength(5);
    expect(q.options!.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(q.options![1]!.isCorrect).toBe(true);
    expect(q.topicHint).toBe('algebra-equations');
    expect(q.difficultyPrior).toBe(2);
    expect(q.solution).toContain('25');
    expect(rejected).toHaveLength(1); // empty prompt rejected
  });
});

describe('parseDs12Bank', () => {
  const bank = JSON.stringify({
    meta: { total: 1 },
    questions: [
      {
        category: 'Quantitative Aptitude',
        topic: 'Percentages',
        difficulty: 'Basic',
        question: 'What is 25% of 400?',
        solution: '0.25 × 400 = 100.',
        options: { a: '200', b: '100', c: '300', d: '400' },
        correct_answer: 'b',
      },
      {
        category: 'Logical Reasoning',
        topic: 'Series',
        difficulty: 'Bogus',
        question: '2, 4, 8, ?',
        options: { a: '12', b: '16' },
        correct_answer: 'z',
      },
    ],
  });

  it('maps letter keys to option order and rejects bad rows', () => {
    const { items, rejected } = parseDs12Bank('app/src/question_bank.json', bank);
    expect(items).toHaveLength(1);
    const q = items[0]!;
    expect(q.options!.map((o) => o.text)).toEqual(['200', '100', '300', '400']);
    expect(q.options![1]!.isCorrect).toBe(true);
    expect(q.difficultyPrior).toBe(1);
    expect(q.topicHint).toBe('Percentages');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toContain('correct_answer');
  });
});
