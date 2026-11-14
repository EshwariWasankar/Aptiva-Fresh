/**
 * Pure commitment and streak evaluation (playbook Section 17.7).
 * Evaluates student progress against a commitment without guilt-inducing messaging.
 */

export interface PracticeDay {
  date: string; // YYYY-MM-DD
  activeSeconds: number;
  questionsAnswered: number;
}

export interface CommitmentRow {
  id?: string;
  userId?: string;
  type: 'days' | 'minutes';
  target: number;
  startDate: string | Date;
  restDaysAllowed?: number;
  restDayUsed?: boolean;
  status?: 'active' | 'completed' | 'broken' | 'ended_by_user';
  daysDone?: number;
  minutesDone?: number;
  endedAt?: Date | null;
}

export interface CommitmentConfig {
  dayDoneMinActiveSec: number;
  dayDoneMinQuestions: number;
  restDaysAllowed: number;
}

export const DEFAULT_COMMITMENT_CONFIG: CommitmentConfig = {
  dayDoneMinActiveSec: 600, // 10 minutes
  dayDoneMinQuestions: 10,
  restDaysAllowed: 1,
};

export interface CommitmentEval {
  status: 'active' | 'completed' | 'broken';
  daysDone: number;
  minutesDone: number;
  restDayUsed: boolean;
  text: string;
}

function toIsoDate(d: string | Date): string {
  if (typeof d === 'string') {
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function evaluateCommitment(
  c: CommitmentRow,
  days: PracticeDay[],
  todayStr: string,
  cfg: Partial<CommitmentConfig> = {},
): CommitmentEval {
  const config: CommitmentConfig = {
    ...DEFAULT_COMMITMENT_CONFIG,
    ...cfg,
  };

  const startDate = toIsoDate(c.startDate);
  const today = toIsoDate(todayStr);

  const dayMap = new Map<string, PracticeDay>();
  for (const d of days) {
    const key = toIsoDate(d.date);
    const existing = dayMap.get(key);
    if (existing) {
      dayMap.set(key, {
        date: key,
        activeSeconds: existing.activeSeconds + d.activeSeconds,
        questionsAnswered: existing.questionsAnswered + d.questionsAnswered,
      });
    } else {
      dayMap.set(key, {
        date: key,
        activeSeconds: d.activeSeconds,
        questionsAnswered: d.questionsAnswered,
      });
    }
  }

  const isDayDone = (dateKey: string): boolean => {
    const d = dayMap.get(dateKey);
    if (!d) return false;
    return (
      d.activeSeconds >= config.dayDoneMinActiveSec ||
      d.questionsAnswered >= config.dayDoneMinQuestions
    );
  };

  if (c.type === 'minutes') {
    let totalSec = 0;
    for (const [dateKey, d] of dayMap.entries()) {
      if (dateKey >= startDate) {
        totalSec += d.activeSeconds;
      }
    }
    const minutesDone = Math.floor(totalSec / 60);
    const isCompleted = minutesDone >= c.target;

    const status: 'active' | 'completed' = isCompleted ? 'completed' : 'active';
    let text: string;
    if (isCompleted) {
      text = 'Commitment complete. You can set a new one whenever you like.';
    } else {
      text = `${minutesDone} of ${c.target} minutes done.`;
    }

    return {
      status,
      daysDone: 0,
      minutesDone,
      restDayUsed: false,
      text,
    };
  }

  // c.type === 'days'
  let daysDone = 0;
  let restDayUsed = c.restDayUsed ?? false;
  let status: 'active' | 'completed' | 'broken' = 'active';

  let current = startDate;
  while (current <= today) {
    const done = isDayDone(current);

    if (current === today) {
      if (done) {
        daysDone += 1;
        if (daysDone >= c.target) {
          status = 'completed';
          break;
        }
      }
      // If not done on today, it is not a miss.
      break;
    }

    // Past date (current < today)
    if (done) {
      daysDone += 1;
      if (daysDone >= c.target) {
        status = 'completed';
        break;
      }
    } else {
      // Missed day
      if (!restDayUsed && config.restDaysAllowed > 0) {
        restDayUsed = true;
        // Neither counts nor breaks
      } else {
        status = 'broken';
        break;
      }
    }

    current = addDays(current, 1);
  }

  let text: string;
  if (status === 'completed') {
    text = 'Commitment complete. You can set a new one whenever you like.';
  } else if (status === 'broken') {
    text = 'This commitment has ended. You can start a new one whenever you like.';
  } else {
    text = `Day ${daysDone} of ${c.target} done.`;
    if (restDayUsed) {
      text += ' Your rest day has been used.';
    }
  }

  return {
    status,
    daysDone,
    minutesDone: 0,
    restDayUsed,
    text,
  };
}
