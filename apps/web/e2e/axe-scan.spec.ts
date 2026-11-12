import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * PH11-T04 — axe accessibility scan across public + student surfaces.
 * Registers a fresh student via the UI, then scans every main view.
 * Run: pnpm --filter @aptiva/web test:e2e
 */

const EMAIL = `axe-${Date.now()}@example.com`;
const PASSWORD = 'Axe-scan-pass-123';

const PUBLIC_PAGES = ['/', '/login', '/register', '/privacy', '/assessments/tcs-online-assessment'];
const STUDENT_PAGES = [
  '/dashboard',
  '/onboarding/diagnostic',
  '/plan',
  '/plan/history',
  '/practice',
  '/reassessment',
  '/notebook',
  '/profile',
  '/settings',
  '/setup/requirements',
];

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Next.js dev-tools overlay is dev-only chrome, not app content.
    .exclude('nextjs-portal')
    .analyze();
  const violations = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help} :: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`,
  );
  expect(violations, `axe violations on ${path}`).toEqual([]);
}

test.describe('axe scans', () => {
  test('public pages', async ({ page }) => {
    for (const p of PUBLIC_PAGES) await scan(page, p);
  });

  test('student pages', async ({ page }) => {
    // Register through the UI so the session is real.
    await page.goto('/register');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByLabel(/graduation year/i).fill('2027');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/dashboard|onboarding|diagnostic/, { timeout: 20_000 });

    for (const p of STUDENT_PAGES) await scan(page, p);
  });
});
