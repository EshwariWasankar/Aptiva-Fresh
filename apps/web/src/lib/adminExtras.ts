import { api } from './apiClient';
import type { PatternReport } from './patterns';

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  topic?: { id: string; slug: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export function adminListLessons(): Promise<Lesson[]> {
  return api('/admin/lessons');
}

export function createLesson(body: {
  topicId: string;
  title: string;
  content: string;
  status?: 'draft' | 'published';
}): Promise<Lesson> {
  return api('/admin/lessons', { method: 'POST', body });
}

export function updateLesson(
  id: string,
  body: Partial<{ topicId: string; title: string; content: string; status: 'draft' | 'published' }>,
): Promise<Lesson> {
  return api(`/admin/lessons/${id}`, { method: 'PUT', body });
}

export interface DriftAlert {
  id: string;
  company: string;
  section: string;
  topicId: string | null;
  oldWeight: number;
  newWeight: number;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'dismissed';
  notes: string | null;
  detectedAt: string;
}

export function adminListDriftAlerts(): Promise<DriftAlert[]> {
  return api('/admin/drift-alerts');
}

export function adminCreateDriftAlert(body: {
  company: string;
  section: string;
  topicId?: string;
  oldWeight: number;
  newWeight: number;
  severity?: 'low' | 'medium' | 'high';
  notes?: string;
}): Promise<DriftAlert> {
  return api('/admin/drift-alerts', { method: 'POST', body });
}

export function adminListPatternReports(status?: string): Promise<PatternReport[]> {
  return api(`/pattern-reports${status ? `?status=${status}` : ''}`);
}

export function adminReviewPatternReport(
  id: string,
  status: 'approved' | 'rejected',
): Promise<unknown> {
  return api(`/pattern-reports/${id}/review`, { method: 'PATCH', body: { status } });
}

export function adminResolveDriftAlert(
  id: string,
  body: { status?: 'resolved' | 'dismissed'; notes?: string },
): Promise<DriftAlert> {
  return api(`/admin/drift-alerts/${id}/resolve`, { method: 'PATCH', body });
}
