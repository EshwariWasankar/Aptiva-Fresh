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
