import { api } from './apiClient';

export interface PatternReport {
  id: string;
  company: string;
  field: string;
  claim: Record<string, unknown>;
  weight?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export function listPatternReports(): Promise<PatternReport[]> {
  return api('/pattern-reports');
}

export function createPatternReport(body: {
  company: string;
  field: string;
  claim: Record<string, unknown>;
}): Promise<PatternReport> {
  return api('/pattern-reports', { method: 'POST', body });
}
