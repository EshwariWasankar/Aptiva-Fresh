import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  evaluateCommitment,
  type CommitmentEval,
  type PracticeDay as EnginePracticeDay,
} from '@aptiva/engine';
import { PrismaService } from '../common/prisma/prisma.service';

export interface SetCommitmentDto {
  type: 'days' | 'minutes';
  target: number;
  restDaysAllowed?: number;
}

@Injectable()
export class CommitmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private todayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private todayStr(): string {
    return this.todayDate().toISOString().slice(0, 10);
  }

  async getCommitment(userId: string): Promise<{
    commitment: unknown | null;
    evaluation: CommitmentEval | null;
  }> {
    const commitment = await this.prisma.userCommitment.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!commitment) {
      return { commitment: null, evaluation: null };
    }

    const practiceDays = await this.prisma.practiceDay.findMany({
      where: {
        userId,
        date: { gte: commitment.startDate },
      },
      orderBy: { date: 'asc' },
    });

    const engineDays: EnginePracticeDay[] = practiceDays.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      activeSeconds: d.activeSeconds,
      questionsAnswered: d.questionsAnswered,
    }));

    const evaluation = evaluateCommitment(
      {
        id: commitment.id,
        userId: commitment.userId,
        type: commitment.type as 'days' | 'minutes',
        target: commitment.target,
        startDate: commitment.startDate,
        restDaysAllowed: commitment.restDaysAllowed,
        restDayUsed: commitment.restDayUsed,
        status: commitment.status as 'active',
      },
      engineDays,
      this.todayStr(),
    );

    // Persist status updates if evaluation changed state
    if (
      evaluation.status !== commitment.status ||
      evaluation.restDayUsed !== commitment.restDayUsed ||
      evaluation.daysDone !== commitment.daysDone ||
      evaluation.minutesDone !== commitment.minutesDone
    ) {
      const updated = await this.prisma.userCommitment.update({
        where: { id: commitment.id },
        data: {
          status: evaluation.status,
          restDayUsed: evaluation.restDayUsed,
          daysDone: evaluation.daysDone,
          minutesDone: evaluation.minutesDone,
          endedAt: evaluation.status !== 'active' ? new Date() : null,
        },
      });
      return { commitment: updated, evaluation };
    }

    return { commitment, evaluation };
  }

  async setCommitment(userId: string, dto: SetCommitmentDto) {
    if (!dto.type || (dto.type !== 'days' && dto.type !== 'minutes')) {
      throw new UnprocessableEntityException('type must be either days or minutes');
    }
    if (!dto.target || dto.target <= 0 || !Number.isInteger(dto.target)) {
      throw new UnprocessableEntityException('target must be a positive integer');
    }

    // End existing active commitments
    await this.prisma.userCommitment.updateMany({
      where: { userId, status: 'active' },
      data: {
        status: 'ended_by_user',
        endedAt: new Date(),
      },
    });

    await this.prisma.userCommitment.create({
      data: {
        userId,
        type: dto.type,
        target: dto.target,
        startDate: this.todayDate(),
        restDaysAllowed: dto.restDaysAllowed ?? 1,
        restDayUsed: false,
        status: 'active',
        daysDone: 0,
        minutesDone: 0,
      },
    });

    return this.getCommitment(userId);
  }

  async endCommitment(userId: string) {
    await this.prisma.userCommitment.updateMany({
      where: { userId, status: 'active' },
      data: {
        status: 'ended_by_user',
        endedAt: new Date(),
      },
    });

    return {
      message: 'This commitment has ended. You can start a new one whenever you like.',
    };
  }

  async getActivityHistory(userId: string, daysBack = 365) {
    const today = this.todayDate();
    const todayStr = this.todayStr();
    const sinceDate = new Date(today.getTime() - Math.max(1, daysBack) * 24 * 60 * 60 * 1000);

    const [practiceDays, sessions, commitmentData] = await Promise.all([
      this.prisma.practiceDay.findMany({
        where: { userId, date: { gte: sinceDate } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.practiceSession.findMany({
        where: { userId, startedAt: { gte: sinceDate } },
        include: { topic: { select: { id: true, name: true, sectionSlug: true } } },
        orderBy: { startedAt: 'asc' },
      }),
      this.getCommitment(userId),
    ]);

    // Group sessions by date string YYYY-MM-DD
    const sessionsByDate = new Map<
      string,
      { count: number; topics: Set<string>; minutes: number }
    >();
    for (const s of sessions) {
      const dateStr = s.startedAt.toISOString().slice(0, 10);
      let entry = sessionsByDate.get(dateStr);
      if (!entry) {
        entry = { count: 0, topics: new Set<string>(), minutes: 0 };
        sessionsByDate.set(dateStr, entry);
      }
      entry.count += 1;
      if (s.topic?.name) {
        entry.topics.add(s.topic.name);
      }
      if (s.actualMinutes) {
        entry.minutes += s.actualMinutes;
      }
    }

    // Merge practiceDays and session summaries into daily activity map
    const dayMap = new Map<
      string,
      {
        date: string;
        activeSeconds: number;
        questionsAnswered: number;
        sessionCount: number;
        topics: string[];
        isRestDay: boolean;
      }
    >();

    for (const pd of practiceDays) {
      const dStr = pd.date.toISOString().slice(0, 10);
      const sessionInfo = sessionsByDate.get(dStr);
      dayMap.set(dStr, {
        date: dStr,
        activeSeconds: pd.activeSeconds,
        questionsAnswered: pd.questionsAnswered,
        sessionCount: sessionInfo?.count ?? (pd.questionsAnswered > 0 ? 1 : 0),
        topics: sessionInfo ? Array.from(sessionInfo.topics) : [],
        isRestDay: false,
      });
    }

    // Also include any session days that might not have practiceDay rows yet
    for (const [dStr, sessionInfo] of sessionsByDate.entries()) {
      if (!dayMap.has(dStr)) {
        dayMap.set(dStr, {
          date: dStr,
          activeSeconds: sessionInfo.minutes * 60,
          questionsAnswered: 0,
          sessionCount: sessionInfo.count,
          topics: Array.from(sessionInfo.topics),
          isRestDay: false,
        });
      }
    }

    // Compute streak stats across recorded days
    const sortedDates = Array.from(dayMap.keys()).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    const commitmentRow = commitmentData.commitment as
      { restDaysAllowed?: number; type?: string; target?: number } | undefined;
    const restDaysAllowed = commitmentRow?.restDaysAllowed ?? 1;

    for (const dStr of sortedDates) {
      const currDate = new Date(dStr + 'T00:00:00Z');
      const item = dayMap.get(dStr);
      const isActive = (item?.activeSeconds ?? 0) >= 300 || (item?.questionsAnswered ?? 0) >= 5;

      if (isActive) {
        if (!prevDate) {
          tempStreak = 1;
        } else {
          const diffDays = Math.round(
            (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (diffDays === 1) {
            tempStreak += 1;
          } else if (diffDays === 2 && restDaysAllowed > 0) {
            tempStreak += 1;
          } else {
            tempStreak = 1;
          }
        }
        prevDate = currDate;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      }
    }

    // Current streak: look backwards from today/yesterday
    let checkDate = new Date(today.getTime());
    let restDaysAvailable = restDaysAllowed;
    if (commitmentData.evaluation?.restDayUsed) {
      restDaysAvailable = 0;
    }

    const todayActivity = dayMap.get(todayStr);
    const todayDone =
      (todayActivity?.activeSeconds ?? 0) >= 300 || (todayActivity?.questionsAnswered ?? 0) >= 5;

    if (todayDone) {
      currentStreak += 1;
      checkDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    } else {
      checkDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      const act = dayMap.get(dStr);
      const isDone = (act?.activeSeconds ?? 0) >= 300 || (act?.questionsAnswered ?? 0) >= 5;

      if (isDone) {
        currentStreak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else if (restDaysAvailable > 0 && currentStreak > 0) {
        restDaysAvailable -= 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    let totalActiveSeconds = 0;
    let totalQuestions = 0;
    let totalSessions = 0;
    let activeDaysCount = 0;

    for (const item of dayMap.values()) {
      totalActiveSeconds += item.activeSeconds;
      totalQuestions += item.questionsAnswered;
      totalSessions += item.sessionCount;
      if (item.activeSeconds > 0 || item.questionsAnswered > 0) {
        activeDaysCount += 1;
      }
    }

    const averageDailyMinutes =
      activeDaysCount > 0 ? Math.round(totalActiveSeconds / 60 / activeDaysCount) : 0;

    return {
      periodDays: daysBack,
      periodStart: sinceDate.toISOString().slice(0, 10),
      periodEnd: todayStr,
      totalStudyHours: Number((totalActiveSeconds / 3600).toFixed(1)),
      totalActiveSeconds,
      totalQuestions,
      totalSessions,
      activeDaysCount,
      currentStreak,
      longestStreak,
      averageDailyMinutes,
      plannedRestDays: restDaysAllowed,
      restDayUsed: commitmentData.evaluation?.restDayUsed ?? false,
      commitment: commitmentData.commitment,
      evaluation: commitmentData.evaluation,
      days: Array.from(dayMap.values()),
    };
  }

  async recordPracticeActivity(userId: string, activeSeconds: number, questionsAnswered: number) {
    const today = this.todayDate();
    await this.prisma.practiceDay.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        activeSeconds: { increment: activeSeconds },
        questionsAnswered: { increment: questionsAnswered },
      },
      create: {
        userId,
        date: today,
        activeSeconds,
        questionsAnswered,
      },
    });
  }
}
