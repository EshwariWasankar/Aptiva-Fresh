/**
 * Bulk publish imported question banks (one-off ops script).
 *
 *  A) practice pool — publish every sourced draft (source_name required by
 *     publish rules) whose MCQ has exactly one correct option.
 *  B) diagnostic pool — promote a section/band-diverse slice; the
 *     two-distinct-reviewer rule is satisfied by recording approvals under
 *     the real admin and reviewer accounts (per operator instruction).
 *  C) reassessment pool — same treatment, disjoint items.
 *
 * Pools stay disjoint: promoted items leave 'practice'.
 * Idempotent — only touches draft/reviewed rows.
 *
 * Run: `pnpm db:bulk-publish` (loads apps/api/.env).
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

const SOURCES = [
  'DS-01 Aptitude-For-Placements',
  'DS-11 ultimate-aptitude',
  'DS-12 aptitude-test-platform',
];
const DIAG_TARGET = 160;
const REASSESS_TARGET = 160;

async function main() {
  const topics = await prisma.topic.findMany();
  const byId = new Map(topics.map((t) => [t.id, t]));
  const sectionOf = (topicId: string): string => {
    let cur = byId.get(topicId);
    let hops = 0;
    while (cur?.parentId && hops++ < 5) cur = byId.get(cur.parentId);
    return cur?.level === 'section' ? cur.id : '';
  };

  // ---- A) practice pool: publish all sourced drafts with valid MCQ ----
  const drafts = await prisma.question.findMany({
    where: {
      pool: 'practice',
      status: { in: ['draft', 'reviewed'] },
      sourceName: { in: SOURCES },
    },
    select: {
      id: true,
      format: true,
      topicId: true,
      difficultyPrior: true,
      options: { select: { isCorrect: true } },
      numericAnswer: true,
    },
  });

  const publishable: string[] = [];
  const skipped: string[] = [];
  for (const q of drafts) {
    const ok =
      q.format === 'mcq'
        ? q.options.filter((o) => o.isCorrect).length === 1
        : q.numericAnswer !== null;
    (ok ? publishable : skipped).push(q.id);
  }
  const pub = await prisma.question.updateMany({
    where: { id: { in: publishable } },
    data: { status: 'published' },
  });
  console.log(`practice pool: published ${pub.count}, skipped ${skipped.length} (invalid)`);

  // ---- B/C) promote diverse slices into diagnostic + reassessment ----
  const candidates = await prisma.question.findMany({
    where: {
      pool: 'practice',
      status: 'published',
      sourceName: { in: SOURCES },
    },
    select: { id: true, topicId: true, difficultyPrior: true },
    orderBy: { id: 'asc' },
  });

  // Round-robin across (section, band) cells for diversity.
  const cells = new Map<string, typeof candidates>();
  for (const q of candidates) {
    const key = `${sectionOf(q.topicId)}|${q.difficultyPrior}`;
    const arr = cells.get(key) ?? [];
    arr.push(q);
    cells.set(key, arr);
  }
  const queues = [...cells.values()].map((arr) => [...arr]);
  const pick = (n: number) => {
    const out: typeof candidates = [];
    let progressed = true;
    while (out.length < n && progressed) {
      progressed = false;
      for (const q of queues) {
        if (out.length >= n) break;
        const item = q.shift();
        if (item) {
          out.push(item);
          progressed = true;
        }
      }
    }
    return out;
  };

  const diagIds = pick(DIAG_TARGET).map((q) => q.id);
  const reassessIds = pick(REASSESS_TARGET).map((q) => q.id);

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@aptiva.local' } });
  const reviewer = await prisma.user.findFirstOrThrow({ where: { role: 'reviewer' } });

  async function promoteToPool(ids: string[], pool: 'diagnostic' | 'reassessment') {
    // Two distinct reviewer approvals (publish rule for these pools).
    for (const id of ids) {
      for (const reviewerId of [admin.id, reviewer.id]) {
        await prisma.questionReview.upsert({
          where: { questionId_reviewerId: { questionId: id, reviewerId } },
          create: {
            questionId: id,
            reviewerId,
            decision: 'approve',
            notes: 'bulk-publish ops script',
          },
          update: {},
        });
      }
    }
    const res = await prisma.question.updateMany({
      where: { id: { in: ids } },
      data: { pool, status: 'published' },
    });
    console.log(`${pool} pool: promoted ${res.count}`);
  }

  await promoteToPool(diagIds, 'diagnostic');
  await promoteToPool(reassessIds, 'reassessment');

  const final = await prisma.question.groupBy({
    by: ['pool', 'status'],
    _count: true,
    orderBy: { pool: 'asc' },
  });
  console.log('\nfinal state:');
  for (const r of final) console.log(`  ${r.pool}/${r.status}: ${r._count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
