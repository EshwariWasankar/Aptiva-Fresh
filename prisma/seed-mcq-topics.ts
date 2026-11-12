/**
 * Taxonomy extension + source synonyms for the MCQ imports (DS-11, DS-12).
 *
 * The two GitHub MCQ sources label questions with their own topic slugs
 * (e.g. `algebra-equations`) or display names (e.g. `Time and Distance`).
 * This script:
 *  1. creates the missing topic-level rows under the correct section,
 *  2. upserts topic_synonyms so the ingest mapper resolves every source
 *     phrase to a taxonomy node (never guessed — unmapped stays rejected).
 *
 * Idempotent: topics keyed by slug, synonyms keyed by phrase.
 * Run: `pnpm db:seed-mcq-topics` (needs DATABASE_URL).
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(__dirname, '../apps/api/.env') });
loadEnv();

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
});

/** New topic-level rows: [slug, name, parentSectionSlug]. */
const NEW_TOPICS: [string, string, string][] = [
  // Quantitative Aptitude
  ['algebra', 'Algebra', 'quant'],
  ['geometry', 'Geometry', 'quant'],
  ['mensuration', 'Mensuration', 'quant'],
  ['mixtures', 'Mixtures and Alligation', 'quant'],
  ['interest', 'Simple and Compound Interest', 'quant'],
  ['sets', 'Set Theory', 'quant'],
  ['statistics', 'Statistics', 'quant'],
  // Data Interpretation
  ['data-sufficiency', 'Data Sufficiency', 'di'],
  // Logical Reasoning
  ['analogies', 'Analogies', 'reasoning'],
  ['coding-decoding', 'Coding and Decoding', 'reasoning'],
  ['directions', 'Directions', 'reasoning'],
  ['series', 'Series', 'reasoning'],
  ['blood-relations', 'Blood Relations', 'reasoning'],
  ['grouping', 'Grouping and Selection', 'reasoning'],
  ['scheduling', 'Scheduling', 'reasoning'],
  ['odd-one-out', 'Odd One Out', 'reasoning'],
  ['operator-substitution', 'Operator Substitution', 'reasoning'],
  ['non-verbal-reasoning', 'Non-Verbal Reasoning', 'reasoning'],
  // Verbal Ability
  ['critical-reasoning', 'Critical Reasoning', 'verbal'],
];

/** Source phrase (as emitted by the parsers) → taxonomy slug. */
const SYNONYMS: [string, string][] = [
  // ---- DS-11 ultimate-aptitude topic slugs ----
  ['ages', 'ages'],
  ['algebra-equations', 'algebra'],
  ['algebra-functions', 'algebra'],
  ['algebra-inequalities', 'algebra'],
  ['arithmetic-advanced', 'number-system'],
  ['averages', 'averages'],
  ['boats-streams', 'trains-boats'],
  ['data-interpretation', 'data-interpretation'],
  ['di-games', 'data-interpretation'],
  ['di-mixed', 'data-interpretation'],
  ['di-tables', 'tables-charts'],
  ['di-data-sufficiency', 'data-sufficiency'],
  ['di-graphics', 'tables-charts'],
  ['di-multi-source', 'caselets'],
  ['di-table-analysis', 'tables-charts'],
  ['di-two-part', 'caselets'],
  ['ds-algebra', 'algebra'],
  ['ds-arithmetic', 'number-system'],
  ['ds-geometry', 'geometry'],
  ['ds-number-properties', 'number-system'],
  ['ds-word-problems', 'number-system'],
  ['geometry-circles', 'geometry'],
  ['geometry-coordinate', 'geometry'],
  ['geometry-triangles', 'geometry'],
  ['mensuration', 'mensuration'],
  ['mixtures-alligation', 'mixtures'],
  ['number-factors', 'number-system'],
  ['number-properties', 'number-system'],
  ['number-remainders', 'remainders'],
  ['numeric-sequences', 'number-series'],
  ['percentages', 'percentages'],
  ['permutations-combinations', 'permutations-combinations'],
  ['pipes-cisterns', 'pipes-cisterns'],
  ['probability', 'probability'],
  ['profit-loss', 'profit-loss'],
  ['progressions', 'number-series'],
  ['ratios-proportion', 'ratio-proportion'],
  ['set-theory', 'sets'],
  ['simple-compound-interest', 'interest'],
  ['statistics', 'statistics'],
  ['successive-discounts', 'discount'],
  ['time-speed-distance', 'time-speed-distance'],
  ['time-work', 'time-work'],
  ['trains', 'trains-boats'],
  ['analogies', 'analogies'],
  ['blood-relations', 'blood-relations'],
  ['coding-decoding', 'coding-decoding'],
  ['directions', 'directions'],
  ['letter-series', 'series'],
  ['lr-arrangements', 'arrangements'],
  ['lr-grouping', 'grouping'],
  ['lr-scheduling', 'scheduling'],
  ['number-series', 'series'],
  ['odd-one-out', 'odd-one-out'],
  ['operator-substitution', 'operator-substitution'],
  ['syllogisms', 'syllogisms'],
  ['rc-detail', 'rc-passage'],
  ['rc-function', 'rc-passage'],
  ['rc-inference', 'inference'],
  ['rc-main-idea', 'rc-passage'],
  ['rc-tone', 'rc-passage'],
  ['cr-assumption', 'critical-reasoning'],
  ['cr-boldface', 'critical-reasoning'],
  ['cr-evaluate', 'critical-reasoning'],
  ['cr-flaw', 'critical-reasoning'],
  ['cr-inference', 'critical-reasoning'],
  ['cr-paradox', 'critical-reasoning'],
  ['cr-strengthen', 'critical-reasoning'],
  ['cr-weaken', 'critical-reasoning'],
  // ---- DS-12 aptitude-test-platform topic names ----
  ['time and distance', 'time-speed-distance'],
  ['ratios and proportions', 'ratio-proportion'],
  ['number systems', 'number-system'],
  ['series', 'series'],
  ['analogies', 'analogies'],
  ['coding-decoding', 'coding-decoding'],
  ['blood relations', 'blood-relations'],
  ['directions', 'directions'],
  ['data sufficiency', 'data-sufficiency'],
  ['non-verbal reasoning', 'non-verbal-reasoning'],
  ['simple and compound interest', 'interest'],
  ['simple interest', 'interest'],
  ['critical reasoning', 'critical-reasoning'],
];

async function main() {
  let topicsCreated = 0;
  let synonymsUpserted = 0;

  for (const [slug, name, sectionSlug] of NEW_TOPICS) {
    const section = await prisma.topic.findUnique({ where: { slug: sectionSlug } });
    if (!section) throw new Error(`section '${sectionSlug}' not found — run db:seed first`);
    const existing = await prisma.topic.findUnique({ where: { slug } });
    if (existing) continue;
    await prisma.topic.create({
      data: { slug, name, level: 'topic', parentId: section.id },
    });
    topicsCreated += 1;
  }

  const all = await prisma.topic.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(all.map((t) => [t.slug, t.id]));

  for (const [phrase, topicSlug] of SYNONYMS) {
    const topicId = bySlug.get(topicSlug);
    if (!topicId) throw new Error(`taxonomy slug '${topicSlug}' missing`);
    await prisma.topicSynonym.upsert({
      where: { phrase },
      create: { phrase, topicId },
      update: { topicId },
    });
    synonymsUpserted += 1;
  }

  console.log(`topics created: ${topicsCreated}, synonyms upserted: ${synonymsUpserted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
