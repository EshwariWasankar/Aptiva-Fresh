import { api } from './apiClient';

export interface PracticeDayActivity {
  date: string; // YYYY-MM-DD
  activeSeconds: number;
  questionsAnswered: number;
  sessionCount: number;
  topics: string[];
  isRestDay: boolean;
}

export interface UserCommitmentRow {
  id: string;
  userId: string;
  type: 'days' | 'minutes';
  target: number;
  startDate: string;
  restDaysAllowed: number;
  restDayUsed: boolean;
  status: 'active' | 'completed' | 'broken' | 'ended_by_user';
  daysDone: number;
  minutesDone: number;
}

export interface CommitmentEval {
  status: 'active' | 'completed' | 'broken';
  daysDone: number;
  minutesDone: number;
  restDayUsed: boolean;
  text: string;
}

export interface CommitmentResponse {
  commitment: UserCommitmentRow | null;
  evaluation: CommitmentEval | null;
}

export interface ActivityHistoryResponse {
  periodDays: number;
  periodStart: string;
  periodEnd: string;
  totalStudyHours: number;
  totalActiveSeconds: number;
  totalQuestions: number;
  totalSessions: number;
  activeDaysCount: number;
  currentStreak: number;
  longestStreak: number;
  averageDailyMinutes: number;
  plannedRestDays: number;
  restDayUsed: boolean;
  commitment: UserCommitmentRow | null;
  evaluation: CommitmentEval | null;
  days: PracticeDayActivity[];
}

export async function getCommitment(): Promise<CommitmentResponse> {
  return api<CommitmentResponse>('/me/commitment');
}

export async function setCommitment(dto: {
  type: 'days' | 'minutes';
  target: number;
  restDaysAllowed?: number;
}): Promise<CommitmentResponse> {
  return api<CommitmentResponse>('/me/commitment', {
    method: 'PUT',
    body: dto,
  });
}

export async function endCommitment(): Promise<{ message: string }> {
  return api<{ message: string }>('/me/commitment', {
    method: 'DELETE',
  });
}

export async function getCommitmentActivity(days = 365): Promise<ActivityHistoryResponse> {
  return api<ActivityHistoryResponse>(`/me/commitment/activity?days=${days}`);
}
