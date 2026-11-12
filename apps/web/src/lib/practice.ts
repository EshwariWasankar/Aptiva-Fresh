import { api } from './apiClient';
import type { PlanResponse } from './content';

export interface SessionCreated {
  id: string;
  kind: string;
  status: string;
  recalcStatus: string;
  startedAt: string;
  plannedMinutes: number | null;
  topicId: string | null;
  blockType: string | null;
}

export interface ServedQuestion {
  sessionId: string;
  type?: 'question';
  lesson?: { id: string; title: string; content: string };
  done?: boolean;
  reason?: string;
  question?: {
    id: string;
    format: 'mcq' | 'numerical';
    stem: string;
    expectedTimeMs: number;
    difficultyPrior: number;
    answerFormat: string | null;
    decimalPlaces: number | null;
    shownAt: string;
    options: { id: string; text: string; orderNo: number }[];
  };
}

export interface AttemptResponse {
  attemptId: string;
  isCorrect: boolean | null;
  timeMs: number | null;
  expectedTimeMs: number;
  paceRatio: number | null;
  correctAnswerShown: boolean;
  promptErrorCause: boolean;
  roundingSuspected: boolean;
}

export interface RevealResponse {
  attemptId: string;
  isCorrect: boolean | null;
  correctOption: { id: string; text: string } | null;
  numericAnswer: string | null;
  solution: string | null;
}

export interface SessionSummary {
  sessionId: string;
  status: string;
  recalcStatus: 'none' | 'pending' | 'done' | 'failed';
  kind: string;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  startedAt: string;
  finishedAt: string | null;
  answered: number;
  skipped: number;
  correct: number;
  accuracy: number | null;
  avgTimeMs: number | null;
  paceRatio: number | null;
  topics: { topicId: string; name: string; attempted: number; correct: number }[];
}

export interface NotebookEntry {
  id: string;
  attemptId: string;
  stem: string;
  topic: { slug: string; name: string };
  answeredAt: string;
  isCorrect: boolean | null;
  timeMs: number | null;
  errorType: { code: string; label: string } | null;
  retryAt: string | null;
  retryCount: number;
  resolvedAt: string | null;
}

export function createSession(body: {
  kind?: string;
  planItemId?: string;
  topicId?: string;
  minutes?: number;
}) {
  return api<SessionCreated>('/sessions', { method: 'POST', body });
}
export function getNext(sessionId: string) {
  return api<ServedQuestion>(`/sessions/${sessionId}/next`);
}
export function submitAttempt(
  sessionId: string,
  questionId: string,
  body: {
    attemptId: string;
    selectedOptionId?: string | null;
    numericInput?: string | null;
    skipped?: boolean;
    answerChanges?: number;
    revisitCount?: number;
  },
) {
  return api<AttemptResponse>(`/sessions/${sessionId}/attempts/${questionId}`, {
    method: 'PUT',
    body,
  });
}
export function revealAttempt(sessionId: string, attemptId: string) {
  return api<RevealResponse>(`/sessions/${sessionId}/attempts/${attemptId}/reveal`);
}
export function finishSession(
  sessionId: string,
  body: { attemptIds?: string[]; attempts?: unknown[] },
) {
  return api<{ sessionId: string; status: string; recalcStatus: string }>(
    `/sessions/${sessionId}/finish`,
    { method: 'POST', body },
  );
}
export function getSessionSummary(sessionId: string) {
  return api<SessionSummary>(`/sessions/${sessionId}/summary`);
}
export function retryRecalc(sessionId: string) {
  return api<{ sessionId: string; recalcStatus: string }>(`/sessions/${sessionId}/recalc-retry`, {
    method: 'POST',
    body: {},
  });
}
export function getNotebook(filters?: { status?: string; topicId?: string }) {
  const qs = new URLSearchParams();
  if (filters?.status) qs.set('status', filters.status);
  if (filters?.topicId) qs.set('topicId', filters.topicId);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ entries: NotebookEntry[] }>(`/me/notebook${suffix}`);
}

// ---- PH-9/PH-10 additions ----

export function startReassessment(body: { kind: 'check' | 'topic' | 'mock'; topicId?: string }) {
  return api<{
    sessionId: string;
    kind: string;
    targetQuestions: number;
    availableQuestions: number;
    shortened: boolean;
    plannedMinutes: number | null;
  }>('/me/reassessments', { method: 'POST', body });
}

export interface ReassessmentComparison {
  sessionId: string;
  baselineSnapshotId: string;
  answered: number;
  accuracy: number | null;
  topics: {
    topicId: string;
    baselineRating: number | null;
    currentRating: number | null;
    delta: number | null;
    noiseBand: number | null;
    label: 'too_early_to_tell' | 'improved' | 'declined' | 'unchanged' | 'no_baseline';
    retention: 'retained' | 'decayed' | null;
    baselineAccuracy: number | null;
    currentAccuracy: number | null;
  }[];
  generatedAt: string;
}

export function getReassessmentComparison(sessionId: string) {
  return api<ReassessmentComparison>(`/me/reassessments/${sessionId}/comparison`);
}

export interface PlanVersion {
  planId: string;
  trigger: string;
  plannerMethod: string;
  engineVersion: string;
  isCurrent: boolean;
  createdAt: string;
  elapsedMs: number | null;
  itemCount: number;
}

export function getPlan(planId: string) {
  return api<PlanResponse>(`/me/plans/${planId}`);
}
export function listPlanVersions() {
  return api<{ plans: PlanVersion[] }>('/me/plans');
}
export function restorePlan(planId: string) {
  return api<{ planId: string }>(`/me/plans/${planId}/restore`, { method: 'POST', body: {} });
}
export function sendBlockFeedback(
  planId: string,
  itemId: string,
  reason: 'already_know' | 'too_easy' | 'not_relevant',
) {
  return api(`/me/plans/${planId}/items/${itemId}/feedback`, {
    method: 'POST',
    body: { reason },
  });
}
export function getPlanSettings() {
  return api<{ planSettings: Record<string, unknown> }>('/me/plan-settings');
}
export function putPlanSettings(body: {
  keepMyPlan?: boolean;
  pins?: string[];
  reminderLimits?: Record<string, unknown>;
}) {
  return api<{ planSettings: Record<string, unknown> }>('/me/plan-settings', {
    method: 'PUT',
    body,
  });
}
export function exportData(password: string) {
  return api<Record<string, unknown>>('/me/data-export', {
    headers: { 'x-reauth-password': password },
  });
}
export function deleteAccount(password: string) {
  return api<{ scheduled: boolean; deletionAfter: string }>('/me', {
    method: 'DELETE',
    headers: { 'x-reauth-password': password },
  });
}
export function updateConsents(consents: { purpose: string; granted: boolean }[]) {
  return api<{ updated: number }>('/me/consents', { method: 'PUT', body: { consents } });
}
