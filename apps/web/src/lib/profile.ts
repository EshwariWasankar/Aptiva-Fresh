import { api } from './apiClient';

// ------------------------------------------------------------- types

export interface ProfileTopicRow {
  topicId: string;
  topic: { id: string; slug: string; name: string; level: string };
  sectionSlug: string;
  rating: number;
  rd: number;
  intervalLow: number;
  intervalHigh: number;
  accuracyEma: number | null;
  timeEmaMs: number | null;
  attemptCount: number;
  errorMix: { reported?: Record<string, number>; inferred?: Record<string, number> };
  updatedAt: string;
}

export interface ProfileResponse {
  engineVersion: string;
  baseline: { snapshotId: string; takenAt: string; engineVersion: string } | null;
  topics: ProfileTopicRow[];
}

export interface ProfileSnapshotRow {
  id: string;
  trigger: string;
  isBaseline: boolean;
  engineVersion: string;
  takenAt: string;
}

// ------------------------------------------------------------- calls

export function getProfile(): Promise<ProfileResponse> {
  return api<ProfileResponse>('/me/profile');
}

export function getProfileHistory(): Promise<{ snapshots: ProfileSnapshotRow[] }> {
  return api<{ snapshots: ProfileSnapshotRow[] }>('/me/profile/history');
}
