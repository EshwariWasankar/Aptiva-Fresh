/**
 * PH12-T09 — Secure creation of the first admin account (playbook Section 21 / 35).
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment (or arguments).
 * Hashes password using argon2 (Argon2id), creates the user with role='admin'
 * and emailVerified=true, and writes an audit log entry.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Strong-Password-123!' pnpm tsx tools/create-admin.ts
 */

import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
loadEnv({ path: resolve(__dirname, '../apps/api/.env') });
loadEnv();

import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm tsx tools/create-admin.ts');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin account ${email} already exists (id: ${existing.id}).`);
      await prisma.$disconnect();
      return;
    }
    console.log(`Promoting existing user ${email} to admin...`);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'admin', passwordHash, emailVerifiedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorId: updated.id,
        action: 'admin.promoted',
        objectType: 'user',
        objectId: updated.id,
        details: { email },
      },
    });
    console.log(`User ${email} promoted to admin successfully.`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'admin.created',
      objectType: 'user',
      objectId: user.id,
      details: { email },
    },
  });

  console.log(`First admin created successfully: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
