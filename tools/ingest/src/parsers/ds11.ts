import type { ParsedItem } from '../types.js';

export const DS11_PARSER_VERSION = 'ds11-v1';

interface UaQuestion {
  category?: string;
  topic?: string;
  difficulty?: string;
  promptHTML?: string;
  options?: unknown;
  optionsHTML?: boolean;
  correct?: number;
  explanation?: string;
}

const EXPECTED_MS = 120_000;

const DIFF_MAP: Record<string, 1 | 2 | 3> = {
  easy: 1,
  medium: 2,
  hard: 2,
  'very-hard': 3,
};

/** Decode the small HTML entity set used inside promptHTML/explanation. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    .replace(/&minus;/g, '−')
    .replace(/&plusmn;/g, '±')
    .replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥')
    .replace(/&ne;/g, '≠')
    .replace(/&infin;/g, '∞')
    .replace(/&sdot;/g, '⋅')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** Strip simple inline HTML tags, keep text. */
function stripHtml(s: string): string {
  return s.replace(/<\/?[a-zA-Z][^>]*>/g, '');
}

function cleanText(s: string): string {
  return decodeEntities(stripHtml(s)).replace(/\s+/g, ' ').trim();
}

/**
 * DS-11 — atmamoon/ultimate-aptitude `banks/questions-*.json`.
 * Each file is a JSON array of 5-option MCQs with a `correct` index,
 * a worked `explanation`, and `category`/`topic` slugs.
 */
export function parseDs11File(
  path: string,
  content: string,
): {
  items: ParsedItem[];
  rejected: { sourcePath: string; reason: string; excerpt?: string }[];
} {
  const items: ParsedItem[] = [];
  const rejected: { sourcePath: string; reason: string; excerpt?: string }[] = [];

  let rows: unknown;
  try {
    rows = JSON.parse(content);
  } catch {
    rejected.push({ sourcePath: path, reason: 'invalid JSON' });
    return { items, rejected };
  }
  if (!Array.isArray(rows)) {
    rejected.push({ sourcePath: path, reason: 'expected a JSON array of questions' });
    return { items, rejected };
  }

  rows.forEach((raw, idx) => {
    const q = raw as UaQuestion;
    const at = `${path}#${idx}`;
    const stem = typeof q.promptHTML === 'string' ? cleanText(q.promptHTML) : '';
    if (stem.length < 10) {
      rejected.push({
        sourcePath: at,
        reason: 'missing or too-short promptHTML',
        excerpt: stem.slice(0, 80),
      });
      return;
    }
    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.length < 2) {
      rejected.push({ sourcePath: at, reason: `only ${opts.length} options` });
      return;
    }
    if (typeof q.correct !== 'number' || q.correct < 0 || q.correct >= opts.length) {
      rejected.push({ sourcePath: at, reason: `correct index ${q.correct} out of range` });
      return;
    }
    const options = opts.map((o, i) => ({
      text: cleanText(String(o)),
      isCorrect: i === q.correct,
    }));
    if (options.some((o) => o.text.length === 0)) {
      rejected.push({ sourcePath: at, reason: 'empty option text' });
      return;
    }
    const diff = DIFF_MAP[String(q.difficulty ?? '').toLowerCase()] ?? 2;
    items.push({
      format: 'mcq',
      stem,
      solution:
        typeof q.explanation === 'string' && q.explanation.trim() ? cleanText(q.explanation) : null,
      options,
      topicHint: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : null,
      difficultyPrior: diff,
      expectedTimeMs: EXPECTED_MS,
      pool: 'practice',
      sourceName: 'DS-11 ultimate-aptitude',
      sourcePath: at,
      parserVersion: DS11_PARSER_VERSION,
    });
  });

  return { items, rejected };
}
