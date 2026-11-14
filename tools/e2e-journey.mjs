// PH11-T01 — scripted 12-step student journey against a live API.
// Usage: API_URL=http://localhost:4000/api/v1 node tools/e2e-journey.mjs
const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const EMAIL = `journey-${Date.now()}@example.com`;
const PASSWORD = 'Journey-pass-123!';
const results = [];
const step = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

let token = '';
const call = async (method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json.data, error: json.error };
};
const daysFromNow = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// 1 register
let r = await call('POST', '/auth/register', {
  email: EMAIL,
  password: PASSWORD,
  consentVersion: '2026-11',
});
step('register', r.status === 201, EMAIL);
token = r.data.accessToken;

// 2 requirements 60 min/day
const weekdays = { mon: 60, tue: 60, wed: 60, thu: 60, fri: 60 };
const reqBody = {
  mode: 'general',
  testDate: daysFromNow(30),
  deadlineDate: daysFromNow(30),
  minutesPerWeekday: weekdays,
  blockLengthMinutes: 30,
  wantedTopics: [],
};
r = await call('PUT', '/me/requirements', reqBody);
step(
  'requirements 60min + auto-plan',
  r.status === 200,
  `status=${r.status} ${JSON.stringify(r.data ?? r.error).slice(0, 120)}`,
);
const plan60 = await call('GET', '/me/plans/current');
const items60 = plan60.data?.items?.length ?? 0;
step('plan generated (60min)', plan60.status === 200 && items60 > 0, `${items60} items`);

// 3 shrink to 20 min → regenerate, verify no backlog (all items <=20min blocks)
r = await call('PUT', '/me/requirements', {
  ...reqBody,
  minutesPerWeekday: { mon: 20, tue: 20, wed: 20, thu: 20, fri: 20 },
});
step('requirements → 20min', r.status === 200);
const plan20 = await call('GET', '/me/plans/current');
const day0 = (plan20.data?.items ?? []).filter((i) => i.dayIndex === 0);
const day0Sum = day0.reduce((s, i) => s + i.minutes, 0);
step(
  're-plan compresses to 20min, no backlog',
  plan20.status === 200 && day0Sum <= 20,
  `day0=${day0Sum}min`,
);

// 4 practice session from today's block
const block = day0[0];
if (!block) {
  step('practice session', false, 'no block today');
} else {
  r = await call('POST', '/sessions', {
    kind: 'practice',
    topicId: block.topic?.id,
    blockType: block.blockType,
  });
  step('session start', r.status === 201, r.data?.id?.slice(0, 8));
  const sid = r.data.id;
  const attemptIds = [];
  for (let i = 0; i < 8; i++) {
    let n = await call('GET', `/sessions/${sid}/next`);
    if (n.status !== 200 || n.data?.done) break;
    if (n.data?.lesson || n.data?.type === 'lesson') {
      n = await call('GET', `/sessions/${sid}/next`);
    }
    if (n.status !== 200 || n.data?.done || !n.data?.question) break;
    const q = n.data.question;
    const body = { attemptId: crypto.randomUUID(), skipped: i === 7 };
    if (q.format === 'mcq' && q.options?.length) body.selectedOptionId = q.options[0].id;
    else body.numericInput = '1';
    const a = await call('PUT', `/sessions/${sid}/attempts/${q.id}`, body);
    if (a.status !== 200) break;
    attemptIds.push(body.attemptId);
  }
  step('answer questions', attemptIds.length > 0, `${attemptIds.length} attempts`);
  r = await call('POST', `/sessions/${sid}/finish`, { attemptIds });
  step('finish (flush barrier)', r.status === 202);
  // wait for recalc
  let done = false;
  for (let i = 0; i < 60 && !done; i++) {
    await new Promise((s) => setTimeout(s, 500));
    const sum = await call('GET', `/sessions/${sid}/summary`);
    done = sum.data?.recalcStatus === 'done' || sum.data?.recalcStatus === 'failed';
  }
  step('recalc completes', done);
}

// 5 notebook + profile + readiness
r = await call('GET', '/me/notebook');
step('mistake notebook', r.status === 200);
r = await call('GET', '/me/profile');
step(
  'profile',
  r.status === 200 && Array.isArray(r.data?.topics),
  `${r.data?.topics?.length ?? 0} topics`,
);
r = await call('GET', '/me/readiness');
step('readiness', r.status === 200);

// 6 plan history + settings
r = await call('GET', '/me/plans');
step(
  'plan history',
  r.status === 200 && r.data.plans.length >= 2,
  `${r.data.plans.length} versions`,
);
r = await call('PUT', '/me/plan-settings', { keepMyPlan: true });
step('keep-my-plan setting', r.status === 200);

// 7 reassessment
r = await call('POST', '/me/reassessments', { kind: 'check' });
step('reassessment start', r.status === 201 || r.status === 409, r.error?.code ?? 'ok');

// 8 export
r = await call('GET', '/me/data-export');
step('export requires re-auth', r.status === 401);
r = await call('GET', '/me/data-export', undefined);
// retry with header
const res = await fetch(`${API}/me/data-export`, {
  headers: { Authorization: `Bearer ${token}`, 'x-reauth-password': PASSWORD },
});
const exp = await res.json();
step('data export', res.status === 200 && exp.data?.user?.email === EMAIL);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
process.exit(failed.length ? 1 : 0);
