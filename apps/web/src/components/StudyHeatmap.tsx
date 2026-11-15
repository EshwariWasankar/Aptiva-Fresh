'use client';

import { useMemo, useState } from 'react';
import type { PracticeDayActivity, ActivityHistoryResponse } from '../lib/commitments';
import { IconFlame, IconTarget } from './Icons';

interface StudyHeatmapProps {
  activity: ActivityHistoryResponse | null;
  loading?: boolean;
  compact?: boolean;
  onFilterChange?: (days: number) => void;
  selectedFilterDays?: number;
}

export function StudyHeatmap({
  activity,
  loading = false,
  compact = false,
  onFilterChange,
  selectedFilterDays = 365,
}: StudyHeatmapProps) {
  const [filterDays, setFilterDays] = useState<number>(selectedFilterDays);
  const [hoveredDay, setHoveredDay] = useState<PracticeDayActivity | null>(null);
  const [selectedDay, setSelectedDay] = useState<PracticeDayActivity | null>(null);

  const activeFilter = onFilterChange ? selectedFilterDays : filterDays;

  const handleFilterClick = (days: number) => {
    setFilterDays(days);
    onFilterChange?.(days);
  };

  // Build a map of YYYY-MM-DD -> PracticeDayActivity
  const activityMap = useMemo(() => {
    const map = new Map<string, PracticeDayActivity>();
    if (!activity?.days) return map;
    for (const d of activity.days) {
      map.set(d.date, d);
    }
    return map;
  }, [activity]);

  // Generate calendar grid ending today
  const { weeks, monthByWeek } = useMemo(() => {
    const now = new Date();
    // Use UTC date boundary to match backend
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const daysToShow = compact ? 84 : activeFilter; // 12 weeks for compact, or activeFilter

    // We start from `today - daysToShow` days, aligned to start of week (Sunday)
    const startDate = new Date(today.getTime() - (daysToShow - 1) * 24 * 60 * 60 * 1000);
    const dayOfWeek = startDate.getUTCDay(); // 0 = Sunday
    startDate.setUTCDate(startDate.getUTCDate() - dayOfWeek);

    const generatedWeeks: Array<Array<{ dateStr: string; dateObj: Date; inRange: boolean }>> = [];
    const monthMap = new Map<number, string>();

    const cursor = new Date(startDate.getTime());
    let currentWeek: Array<{ dateStr: string; dateObj: Date; inRange: boolean }> = [];
    let prevMonth = -1;
    let weekIdx = 0;

    while (cursor <= today || currentWeek.length > 0) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const inRange =
        cursor <= today && cursor.getTime() >= today.getTime() - daysToShow * 24 * 60 * 60 * 1000;
      const m = cursor.getUTCMonth();

      if (m !== prevMonth && currentWeek.length === 0) {
        monthMap.set(weekIdx, cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }));
        prevMonth = m;
      }

      currentWeek.push({
        dateStr,
        dateObj: new Date(cursor.getTime()),
        inRange,
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
        weekIdx += 1;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (cursor > today && currentWeek.length === 0) break;
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const dateStr = cursor.toISOString().slice(0, 10);
        currentWeek.push({
          dateStr,
          dateObj: new Date(cursor.getTime()),
          inRange: false,
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      generatedWeeks.push(currentWeek);
    }

    return { weeks: generatedWeeks, monthByWeek: monthMap };
  }, [activeFilter, compact]);

  const getIntensityClass = (minutes: number) => {
    if (minutes <= 0) return 'bg-slate-100/90 border-slate-200/60 hover:border-purple-300';
    if (minutes < 15)
      return 'bg-purple-200 border-purple-300/80 hover:ring-2 hover:ring-purple-300';
    if (minutes < 30)
      return 'bg-purple-400 border-purple-500/80 hover:ring-2 hover:ring-purple-400';
    if (minutes < 60)
      return 'bg-purple-600 border-purple-700/80 hover:ring-2 hover:ring-purple-500';
    return 'bg-purple-800 border-purple-950/80 hover:ring-2 hover:ring-purple-600';
  };

  const activeDay = selectedDay || hoveredDay;

  // Sizing of cells based on filter and mode
  const isMonthView = !compact && activeFilter === 30;
  const cellDimensionClass = isMonthView
    ? 'w-7 h-7 sm:w-9 sm:h-9 rounded-lg text-[10px]'
    : compact
      ? 'w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px]'
      : 'w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-[17px] md:h-[17px] rounded-sm sm:rounded';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-purple-50 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Study Activity &amp; Commitments
            </h3>
            {activity && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-900 border border-purple-200">
                <IconFlame className="w-3.5 h-3.5 text-purple-700" />
                {activity.currentStreak} day streak
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Genuine recorded practice duration across drills, tests and diagnostics.
          </p>
        </div>

        {/* Range Filters */}
        {!compact && (
          <div className="flex items-center gap-1 rounded-xl bg-purple-50/80 p-1 border border-purple-100 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleFilterClick(30)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === 30
                  ? 'bg-white text-purple-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              30 Days
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick(180)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === 180
                  ? 'bg-white text-purple-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              6 Months
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick(365)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === 365
                  ? 'bg-white text-purple-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              1 Year
            </button>
          </div>
        )}
      </div>

      {/* Summary Statistics Bar */}
      {activity && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 w-full">
          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Study Hours
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalStudyHours}h
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Active Days
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.activeDaysCount}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Current Streak
            </span>
            <span className="text-xl font-bold tracking-tight text-purple-700 mt-1 flex items-center gap-1">
              {activity.currentStreak}d
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Longest Streak
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.longestStreak}d
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Sessions
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalSessions}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Questions
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalQuestions}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3.5 border border-purple-100/80 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Avg / Active Day
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.averageDailyMinutes}m
            </span>
          </div>
        </div>
      )}

      {/* Heatmap Contribution Grid Card: Centered & Balanced Layout */}
      <div className="rounded-2xl bg-white/70 p-5 sm:p-7 border border-purple-100/80 shadow-xs flex flex-col gap-4 overflow-hidden w-full">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading study heatmap…</div>
        ) : (
          <div className="overflow-x-auto pb-3 w-full flex justify-center">
            <div className="flex flex-col items-center min-w-fit px-2">
              <div className="flex items-start">
                {/* Weekday Labels Column */}
                <div
                  className={`flex flex-col ${isMonthView ? 'gap-2 pt-7' : 'gap-1 sm:gap-1.5 pt-6'} text-[10px] sm:text-[11px] text-slate-400 pr-2.5 select-none shrink-0`}
                >
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'}`}
                  >
                    Sun
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'} font-bold text-slate-700`}
                  >
                    Mon
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'}`}
                  >
                    Tue
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'} font-bold text-slate-700`}
                  >
                    Wed
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'}`}
                  >
                    Thu
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'} font-bold text-slate-700`}
                  >
                    Fri
                  </span>
                  <span
                    className={`${isMonthView ? 'h-7 sm:h-9 leading-7 sm:leading-9' : 'h-3.5 sm:h-4 leading-3.5 sm:leading-4'}`}
                  >
                    Sat
                  </span>
                </div>

                {/* Weekly Columns with Aligned Month Header Above */}
                <div className={`flex ${isMonthView ? 'gap-2 sm:gap-3' : 'gap-1 sm:gap-1.5'}`}>
                  {weeks.map((week, wIdx) => {
                    const monthName = monthByWeek.get(wIdx);
                    return (
                      <div key={wIdx} className="flex flex-col items-center">
                        {/* Month Label Slot (100% aligned with corresponding column) */}
                        <div className="h-5 text-[11px] font-bold text-slate-500 select-none whitespace-nowrap overflow-visible flex items-end">
                          {monthName ?? ''}
                        </div>

                        {/* 7 Day Blocks */}
                        <div
                          className={`flex flex-col ${isMonthView ? 'gap-2 sm:gap-3 mt-2' : 'gap-1 sm:gap-1.5 mt-1'}`}
                        >
                          {week.map((day) => {
                            const act = activityMap.get(day.dateStr);
                            const minutes = act ? Math.round(act.activeSeconds / 60) : 0;
                            const isSelected = selectedDay?.date === day.dateStr;

                            return (
                              <button
                                key={day.dateStr}
                                type="button"
                                disabled={!day.inRange}
                                onClick={() => {
                                  if (act) {
                                    setSelectedDay(isSelected ? null : act);
                                  } else {
                                    setSelectedDay({
                                      date: day.dateStr,
                                      activeSeconds: 0,
                                      questionsAnswered: 0,
                                      sessionCount: 0,
                                      topics: [],
                                      isRestDay: false,
                                    });
                                  }
                                }}
                                onMouseEnter={() => {
                                  if (act) {
                                    setHoveredDay(act);
                                  } else {
                                    setHoveredDay({
                                      date: day.dateStr,
                                      activeSeconds: 0,
                                      questionsAnswered: 0,
                                      sessionCount: 0,
                                      topics: [],
                                      isRestDay: false,
                                    });
                                  }
                                }}
                                onMouseLeave={() => setHoveredDay(null)}
                                title={`${day.dateStr}: ${minutes}m (${act ? act.questionsAnswered : 0} questions)`}
                                className={`${cellDimensionClass} border transition-all flex items-center justify-center font-medium ${
                                  !day.inRange
                                    ? 'opacity-0 cursor-default pointer-events-none'
                                    : isSelected
                                      ? 'ring-2 ring-purple-600 scale-110 z-10'
                                      : ''
                                } ${day.inRange ? getIntensityClass(minutes) : ''}`}
                              >
                                {isMonthView && day.inRange && (
                                  <span className="text-[10px] text-slate-700 font-semibold">
                                    {day.dateObj.getUTCDate()}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend & Day Details Footer: Centered & Balanced */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-purple-100/60 text-xs text-slate-600">
          {/* Active / Hovered Day Details */}
          <div className="flex items-center gap-2 min-h-6">
            {activeDay ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-900">
                  {new Date(activeDay.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                  :
                </span>
                <span className="font-semibold text-purple-950">
                  {Math.round(activeDay.activeSeconds / 60)} mins studied
                </span>
                <span className="text-slate-400">·</span>
                <span>{activeDay.questionsAnswered} questions</span>
                <span className="text-slate-400">·</span>
                <span>{activeDay.sessionCount} sessions</span>
                {activeDay.topics && activeDay.topics.length > 0 && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 italic">
                      Topics: {activeDay.topics.slice(0, 3).join(', ')}
                      {activeDay.topics.length > 3 ? ` +${activeDay.topics.length - 3} more` : ''}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-xs">
                Hover or click any square to inspect date duration, questions, and topics.
              </span>
            )}
          </div>

          {/* Less -> More Legend */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs text-slate-500 font-medium shrink-0">
            <span>Less</span>
            <span className="h-3 w-3 rounded-xs bg-slate-100 border border-slate-200/60" />
            <span className="h-3 w-3 rounded-xs bg-purple-200 border border-purple-300" />
            <span className="h-3 w-3 rounded-xs bg-purple-400 border border-purple-500" />
            <span className="h-3 w-3 rounded-xs bg-purple-600 border border-purple-700" />
            <span className="h-3 w-3 rounded-xs bg-purple-800 border border-purple-950" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Commitment & Rest Day Summary Note */}
      {activity?.commitment && (
        <div className="rounded-xl bg-purple-50/50 p-4 border border-purple-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs w-full">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <IconTarget className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">
                Commitment Target: {activity.commitment.target}{' '}
                {activity.commitment.type === 'days' ? 'active days' : 'study minutes'}
              </span>
              <p className="text-slate-500 text-[11px] mt-0.5">
                {activity.evaluation?.text || 'Track your daily consistency without guilt.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-purple-200/60 shadow-2xs">
              Rest Day:{' '}
              {activity.restDayUsed ? 'Used' : `${activity.plannedRestDays} planned / allowed`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
