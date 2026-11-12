import type { ParsedItem } from '../types.js';

export const DS12_PARSER_VERSION = 'ds12-v1';

interface AtpQuestion {
  category?: string;
  topic?: string;
  difficulty?: string;
  question?: string;
  solution?: string;
  options?: Record<string, string>;
  correct_answer?: string;
}

const EXPECTED_MS = 75_000;

const DIFF_MAP: Record<string, 1 | 2 | 3> = {
  basic: 1,
  intermediate: 2,
  advance: 3,
  advanced: 3,
};

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

function cleanText(s: string): string {
  return s
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * DS-12 — jidvish/aptitude-test-platform-public `app/src/question_bank.json`.
 * Shape: { meta, questions: [{ category, topic, difficulty, question,
 * solution, options: {a:..,b:..}, correct_answer: "d" }] }.
 */
export function parseDs12Bank(
  path: string,
  content: string,
): {
  items: ParsedItem[];
  rejected: { sourcePath: string; reason: string; excerpt?: string }[];
} {
  const items: ParsedItem[] = [];
  const rejected: { sourcePath: string; reason: string; excerpt?: string }[] = [];

  let doc: { questions?: unknown };
  try {
    doc = JSON.parse(content) as { questions?: unknown };
  } catch {
    rejected.push({ sourcePath: path, reason: 'invalid JSON' });
    return { items, rejected };
  }
  const rows = Array.isArray(doc.questions) ? doc.questions : null;
  if (!rows) {
    rejected.push({ sourcePath: path, reason: 'missing questions array' });
    return { items, rejected };
  }

  rows.forEach((raw, idx) => {
    const q = raw as AtpQuestion;
    const at = `${path}#${idx}`;
    const stem = typeof q.question === 'string' ? cleanText(q.question) : '';
    if (stem.length < 10) {
      rejected.push({
        sourcePath: at,
        reason: 'missing or too-short question',
        excerpt: stem.slice(0, 80),
      });
      return;
    }
    const opts = q.options ?? {};
    const letters = Object.keys(opts)
      .filter((k) => LETTERS.includes(k.toLowerCase()))
      .sort((a, b) => LETTERS.indexOf(a.toLowerCase()) - LETTERS.indexOf(b.toLowerCase()));
    if (letters.length < 2) {
      rejected.push({ sourcePath: at, reason: `only ${letters.length} options` });
      return;
    }
    const correctLetter = String(q.correct_answer ?? '').toLowerCase();
    const correctIdx = letters.findIndex((l) => l.toLowerCase() === correctLetter);
    if (correctIdx === -1) {
      rejected.push({
        sourcePath: at,
        reason: `correct_answer '${q.correct_answer}' not among options`,
      });
      return;
    }
    const options = letters.map((l, i) => ({
      text: cleanText(String(opts[l])),
      isCorrect: i === correctIdx,
    }));
    if (options.some((o) => o.text.length === 0)) {
      rejected.push({ sourcePath: at, reason: 'empty option text' });
      return;
    }
    const diff = DIFF_MAP[String(q.difficulty ?? '').toLowerCase()] ?? 2;
    const topicHint = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : null;
    items.push({
      format: 'mcq',
      stem,
      solution: typeof q.solution === 'string' && q.solution.trim() ? cleanText(q.solution) : null,
      options,
      topicHint,
      difficultyPrior: diff,
      expectedTimeMs: EXPECTED_MS,
      pool: 'practice',
      sourceName: 'DS-12 aptitude-test-platform',
      sourcePath: at,
      parserVersion: DS12_PARSER_VERSION,
    });
  });

  return { items, rejected };
}
