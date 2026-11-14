/**
 * PH12-T09 — Production Smoke Test Suite.
 * Exercises live staging/production endpoints:
 * 1. GET /api/v1/health & /api/v1/ready
 * 2. Web landing page + security headers
 * 3. robots.txt and sitemap.xml
 * 4. X-Robots-Tag: noindex verification on private routes
 * 5. Student auth flow: registration -> login -> token check
 * 6. Public assessment page
 *
 * Usage:
 *   WEB_URL=http://localhost:3000 API_URL=http://localhost:4000/api/v1 node tools/prod-smoke.mjs
 */

const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:4000/api/v1';

let passed = 0;
let failed = 0;

function assert(desc, condition, detail = '') {
  if (condition) {
    console.log(` PASS  ${desc}${detail ? ` (${detail})` : ''}`);
    passed++;
  } else {
    console.error(` FAIL  ${desc}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

async function run() {
  console.log(`Starting Production Smoke Test against:\n  Web: ${WEB}\n  API: ${API}\n`);

  // 1. Health & Readiness
  try {
    const healthRes = await fetch(`${API}/health`);
    const healthJson = await healthRes.json().catch(() => ({}));
    assert(
      'API /health endpoint returns 200 ok',
      healthRes.status === 200 && healthJson.data?.status === 'ok',
    );
  } catch (err) {
    assert('API /health endpoint reachable', false, err.message);
  }

  try {
    const readyRes = await fetch(`${API}/ready`);
    const readyJson = await readyRes.json().catch(() => ({}));
    assert(
      'API /ready endpoint returns 200 ok',
      readyRes.status === 200 && readyJson.data?.status === 'ok',
    );
  } catch (err) {
    assert('API /ready endpoint reachable', false, err.message);
  }

  // 2. Web Root & Security Headers
  try {
    const webRes = await fetch(`${WEB}/`);
    assert('Web landing page returns 200', webRes.status === 200);
    const xfo = webRes.headers.get('x-frame-options');
    assert('X-Frame-Options: DENY is present', xfo === 'DENY');
    const nosniff = webRes.headers.get('x-content-type-options');
    assert('X-Content-Type-Options: nosniff is present', nosniff === 'nosniff');
    const csp = webRes.headers.get('content-security-policy');
    assert('Content-Security-Policy is present', !!csp);
  } catch (err) {
    assert('Web root reachable', false, err.message);
  }

  // 3. robots.txt and sitemap.xml
  try {
    const robotsRes = await fetch(`${WEB}/robots.txt`);
    const robotsText = await robotsRes.text();
    assert('robots.txt returns 200', robotsRes.status === 200);
    assert('robots.txt disallows /dashboard/', robotsText.includes('Disallow: /dashboard/'));
    assert('robots.txt points to sitemap.xml', robotsText.includes('sitemap.xml'));
  } catch (err) {
    assert('robots.txt check', false, err.message);
  }

  try {
    const sitemapRes = await fetch(`${WEB}/sitemap.xml`);
    const sitemapText = await sitemapRes.text();
    assert('sitemap.xml returns 200', sitemapRes.status === 200);
    assert('sitemap.xml contains public URLs', sitemapText.includes('<loc>'));
  } catch (err) {
    assert('sitemap.xml check', false, err.message);
  }

  // 4. X-Robots-Tag on private routes
  try {
    const dashRes = await fetch(`${WEB}/dashboard`);
    const robotsTag = dashRes.headers.get('x-robots-tag');
    assert(
      'Private route /dashboard has X-Robots-Tag: noindex, nofollow',
      robotsTag?.includes('noindex'),
    );
  } catch (err) {
    assert('Private route robots tag', false, err.message);
  }

  // 5. Public Assessment blueprint page
  try {
    const assessRes = await fetch(`${WEB}/assessments/sample-it-company`);
    assert('Public assessment page returns 200', assessRes.status === 200);
  } catch (err) {
    assert('Assessment page reachable', false, err.message);
  }

  // 6. Student Auth Journey via Web Reverse Proxy
  const testEmail = `smoke-${Date.now()}@example.com`;
  const testPass = 'Smoke-Test-Pass-2026!';
  try {
    const regRes = await fetch(`${WEB}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPass, consentVersion: '2026-11' }),
    });
    const regJson = await regRes.json();
    assert(
      'Student registration succeeds (201)',
      regRes.status === 201 && !!regJson.data?.accessToken,
    );

    const token = regJson.data?.accessToken;
    const meRes = await fetch(`${WEB}/api/v1/me/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert('Authenticated /me/profile access works through proxy (200)', meRes.status === 200);
  } catch (err) {
    assert('Auth smoke flow', false, err.message);
  }

  console.log(`\nSmoke Test Summary: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
