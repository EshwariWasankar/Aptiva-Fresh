import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(__dirname, '../../apps/api/.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../apps/api/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function run() {
  const qs = await prisma.question.findMany({
    where: { pool: 'practice', status: 'published', format: 'mcq' },
    select: { id: true, options: { select: { id: true }, take: 1 } },
    take: 50,
  });
  console.log(
    qs
      .filter((q) => q.options.length > 0)
      .map((q) => `${q.id}:${q.options[0].id}`)
      .join(','),
  );
  await prisma.$disconnect();
}
run();
