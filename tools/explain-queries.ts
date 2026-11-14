import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(__dirname, '../apps/api/.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function explain(title: string, sql: string, params: unknown[] = []) {
  console.log(`\n========================================`);
  console.log(`QUERY: ${title}`);
  console.log(`SQL: ${sql.trim().replace(/\s+/g, ' ')}`);
  console.log(`========================================`);
  const query = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`;
  const rows = (await prisma.$queryRawUnsafe(query, ...params)) as Array<Record<string, unknown>>;
  for (const r of rows) {
    console.log(r['QUERY PLAN']);
  }
}

async function main() {
  const plan = await prisma.practicePlan.findFirst({ where: { isCurrent: true } });
  const userId = plan?.userId ?? '00000000-0000-0000-0000-000000000000';
  const planId = plan?.id ?? '00000000-0000-0000-0000-000000000000';
  const session = await prisma.practiceSession.findFirst({ where: { userId } });
  const sessionId = session?.id ?? '00000000-0000-0000-0000-000000000000';

  console.log(`Using student userId: ${userId}`);
  console.log(`Using planId: ${planId}`);
  console.log(`Using sessionId: ${sessionId}`);

  // 1. Current Plan Path (E-031)
  await explain(
    'Current Plan (practice_plans idx_plans_user_current)',
    `SELECT * FROM practice_plans WHERE user_id = $1 AND is_current = true LIMIT 1`,
    [userId],
  );

  // 2. Plan Items Path
  await explain(
    'Plan Items by planId (practice_plan_items idx_practice_plan_items_plan_id_day_index)',
    `SELECT * FROM practice_plan_items WHERE plan_id = $1 ORDER BY day_index ASC, order_no ASC`,
    [planId],
  );

  // 3. Plan History Path (E-034)
  await explain(
    'Plan History by userId (practice_plans idx_plans_user_created)',
    `SELECT id, created_at FROM practice_plans WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );

  // 4. Session Summary Attempts (question_attempts context index)
  await explain(
    'Session Attempts by Context (question_attempts context index)',
    `SELECT * FROM question_attempts WHERE context_type = 'practice' AND context_id = $1`,
    [sessionId],
  );

  // 5. Dashboard Student Topic Profiles
  await explain(
    'Student Topic Profiles by userId',
    `SELECT * FROM student_topic_profiles WHERE user_id = $1`,
    [userId],
  );

  // 6. Mistake Notebook (mistake_entries user resolvedAt)
  await explain(
    'Mistake Notebook by userId (mistake_entries idx)',
    `SELECT * FROM mistake_entries WHERE user_id = $1 AND resolved_at IS NULL`,
    [userId],
  );

  // 7. Question Bank Pool Serve (questions pool + status index)
  await explain(
    'Question Selection by pool, status, topic (questions index)',
    `SELECT id, format, difficulty_prior FROM questions WHERE pool = 'practice' AND status = 'published' AND topic_id = (SELECT id FROM topics LIMIT 1) LIMIT 10`,
  );

  await prisma.$disconnect();
}

main().catch(console.error);
