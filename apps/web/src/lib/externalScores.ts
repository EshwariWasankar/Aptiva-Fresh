import { api } from './apiClient';

export interface ExternalScore {
  id: string;
  source: string;
  assessmentName: string;
  takenAt: string;
  totalScore: number;
  maxScore: number;
  percentile: number | null;
  sectionScores: Record<string, number> | null;
  reliability: number;
  notes: string | null;
  createdAt: string;
}

export interface CreateExternalScoreBody {
  source: string;
  assessmentName: string;
  takenAt: string;
  totalScore: number;
  maxScore: number;
  percentile?: number | null;
  notes?: string | null;
}

export function listExternalScores(): Promise<ExternalScore[]> {
  return api('/me/external-scores');
}

export function createExternalScore(body: CreateExternalScoreBody): Promise<ExternalScore> {
  return api('/me/external-scores', { method: 'POST', body });
}

export function uploadScoresCsv(csv: string): Promise<{ imported: number; errors?: string[] }> {
  return api('/me/external-scores/csv', { method: 'POST', body: { csv } });
}

export function deleteExternalScore(id: string): Promise<{ success: boolean }> {
  return api(`/me/external-scores/${id}`, { method: 'DELETE' });
}
