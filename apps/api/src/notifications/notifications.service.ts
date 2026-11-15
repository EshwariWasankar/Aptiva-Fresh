import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface NotificationPreferencesDto {
  optInReminders?: boolean;
  optInWeeklySummary?: boolean;
  dailyLimit?: number;
  preferredHourUtc?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    let prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await this.prisma.notificationPreference.create({
        data: {
          userId,
          optInReminders: false,
          optInWeeklySummary: false,
          dailyLimit: 1,
          preferredHourUtc: 14,
        },
      });
    }

    return prefs;
  }

  async updatePreferences(userId: string, dto: NotificationPreferencesDto) {
    const dailyLimit =
      dto.dailyLimit != null ? Math.min(3, Math.max(1, dto.dailyLimit)) : undefined;
    const preferredHourUtc =
      dto.preferredHourUtc != null ? Math.min(23, Math.max(0, dto.preferredHourUtc)) : undefined;

    const updateData: {
      optInReminders?: boolean;
      optInWeeklySummary?: boolean;
      dailyLimit?: number;
      preferredHourUtc?: number;
    } = {};
    if (dto.optInReminders !== undefined) updateData.optInReminders = dto.optInReminders;
    if (dto.optInWeeklySummary !== undefined)
      updateData.optInWeeklySummary = dto.optInWeeklySummary;
    if (dailyLimit !== undefined) updateData.dailyLimit = dailyLimit;
    if (preferredHourUtc !== undefined) updateData.preferredHourUtc = preferredHourUtc;

    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        optInReminders: dto.optInReminders ?? false,
        optInWeeklySummary: dto.optInWeeklySummary ?? false,
        dailyLimit: dailyLimit ?? 1,
        preferredHourUtc: preferredHourUtc ?? 14,
      },
    });
  }

  async getWeeklySummary(userId: string) {
    const prefs = await this.getPreferences(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const practiceDays = await this.prisma.practiceDay.findMany({
      where: {
        userId,
        date: { gte: sevenDaysAgo },
      },
    });

    const totalActiveSeconds = practiceDays.reduce((sum, d) => sum + d.activeSeconds, 0);
    const totalQuestions = practiceDays.reduce((sum, d) => sum + d.questionsAnswered, 0);
    const activeMinutes = Math.round(totalActiveSeconds / 60);

    // Get attempts over last 7 days for accuracy
    const attempts = await this.prisma.questionAttempt.findMany({
      where: {
        userId,
        answeredAt: { gte: sevenDaysAgo },
      },
      select: { isCorrect: true },
    });

    const correctCount = attempts.filter((a) => a.isCorrect).length;
    const accuracy =
      attempts.length > 0 ? Math.round((correctCount / attempts.length) * 100) : null;

    // Neutral, encouraging copy (zero guilt)
    let message = '';
    if (totalQuestions === 0) {
      message =
        'Welcome to your weekly summary! You can jump back into practice anytime you are ready.';
    } else {
      message = `This week you answered ${totalQuestions} questions across ${activeMinutes} minutes${
        accuracy != null ? ` with ${accuracy}% accuracy` : ''
      }. Great dedication!`;
    }

    return {
      periodStart: sevenDaysAgo.toISOString().slice(0, 10),
      periodEnd: now.toISOString().slice(0, 10),
      optedIn: prefs.optInWeeklySummary,
      activeDaysCount: practiceDays.length,
      totalQuestions,
      activeMinutes,
      accuracyPercent: accuracy,
      message,
    };
  }

  async getNotifications(userId: string) {
    const [prefs, weeklySummary, user] = await Promise.all([
      this.getPreferences(userId),
      this.getWeeklySummary(userId),
      this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    ]);

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'weekly_summary' | 'reminder' | 'streak' | 'system' | 'diagnostic';
      read: boolean;
      createdAt: string;
      link?: string;
    }> = [];

    // 1. Weekly summary notification
    if (weeklySummary.totalQuestions > 0 || prefs.optInWeeklySummary) {
      notifications.push({
        id: `weekly-${weeklySummary.periodEnd}`,
        title: 'Weekly Study Performance Summary',
        message: weeklySummary.message,
        type: 'weekly_summary',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/profile',
      });
    }

    // 2. Reminder notification if opted in
    if (prefs.optInReminders) {
      notifications.push({
        id: `reminder-${new Date().toISOString().slice(0, 10)}`,
        title: 'Daily Study Commitment',
        message: 'Your personalized adaptive drill blocks are ready for today.',
        type: 'reminder',
        read: false,
        createdAt: new Date().toISOString(),
        link: '/practice',
      });
    }

    // 3. Email verification notification if unverified
    if (user && !user.emailVerifiedAt) {
      notifications.push({
        id: 'verify-email-alert',
        title: 'Verify Your Email Address',
        message: 'Please verify your email address to secure your account and recover data.',
        type: 'system',
        read: false,
        createdAt: user.createdAt.toISOString(),
        link: '/verify-email',
      });
    }

    // 4. Welcome to Aptiva system message
    notifications.push({
      id: 'welcome-aptiva',
      title: 'Welcome to Aptiva Placement Workspace',
      message: 'Complete your diagnostic to calibrate your Bayesian mastery profile.',
      type: 'diagnostic',
      read: true,
      createdAt: user?.createdAt.toISOString() ?? new Date().toISOString(),
      link: '/onboarding/diagnostic',
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return {
      unreadCount,
      notifications,
    };
  }
}
