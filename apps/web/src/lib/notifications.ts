import { api } from './apiClient';

export interface NotificationPreferencesDto {
  optInReminders?: boolean;
  optInWeeklySummary?: boolean;
  dailyLimit?: number;
  preferredHourUtc?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'weekly_summary' | 'reminder' | 'streak' | 'system' | 'diagnostic';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationsListResponse {
  unreadCount: number;
  notifications: NotificationItem[];
}

export interface WeeklySummaryResponse {
  periodStart: string;
  periodEnd: string;
  optedIn: boolean;
  activeDaysCount: number;
  totalQuestions: number;
  activeMinutes: number;
  accuracyPercent: number | null;
  message: string;
}

export async function getNotificationPreferences(): Promise<NotificationPreferencesDto> {
  return api<NotificationPreferencesDto>('/me/notifications/preferences');
}

export async function updateNotificationPreferences(
  dto: NotificationPreferencesDto,
): Promise<NotificationPreferencesDto> {
  return api<NotificationPreferencesDto>('/me/notifications/preferences', {
    method: 'PUT',
    body: dto,
  });
}

export async function getWeeklySummary(): Promise<WeeklySummaryResponse> {
  return api<WeeklySummaryResponse>('/me/notifications/weekly-summary');
}

export async function getNotifications(): Promise<NotificationsListResponse> {
  return api<NotificationsListResponse>('/me/notifications');
}

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return api<{ success: boolean }>(`/me/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  return api<{ success: boolean }>('/me/notifications/read-all', {
    method: 'POST',
  });
}
