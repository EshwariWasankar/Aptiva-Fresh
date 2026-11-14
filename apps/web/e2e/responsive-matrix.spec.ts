import { expect, test } from '@playwright/test';

/**
 * PH11-T05 — Responsive and browser matrix test.
 * Verifies mobile (375px), tablet (768px), and desktop (1280px) viewports
 * for horizontal overflow, visibility of core elements, and responsive layout.
 */

const VIEWPORTS = [
  { name: 'Mobile (375x667)', width: 375, height: 667 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
  { name: 'Desktop (1280x800)', width: 1280, height: 800 },
];

const PAGES_TO_TEST = ['/', '/login', '/register', '/privacy'];

for (const vp of VIEWPORTS) {
  test.describe(`Responsive Viewport: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PAGES_TO_TEST) {
      test(`renders ${path} without horizontal scroll overflow`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(overflow, `Page ${path} has horizontal overflow at ${vp.width}px`).toBe(false);

        // Verify main content is visible
        const main = page.locator('main, #__next, body');
        await expect(main.first()).toBeVisible();
      });
    }

    test(`login form is responsive and interactable at ${vp.name}`, async ({ page }) => {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      const emailInput = page.getByLabel(/email/i);
      const passwordInput = page.getByLabel(/^password$/i);
      const submitBtn = page.getByRole('button', { name: /sign in|log in/i });

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitBtn).toBeVisible();

      // Ensure button is within viewport bounds
      const box = await submitBtn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 5); // allowing minor rounding
      }
    });
  });
}
