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
  const { weeks, monthLabels } = useMemo(() => {
    const now = new Date();
    // Use UTC date boundary to match backend
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const daysToShow = compact ? 84 : activeFilter; // 12 weeks for compact, or activeFilter

    // We start from `today - daysToShow` days, aligned to start of week (Sunday)
    const startDate = new Date(today.getTime() - (daysToShow - 1) * 24 * 60 * 60 * 1000);
    const dayOfWeek = startDate.getUTCDay(); // 0 = Sunday
    startDate.setUTCDate(startDate.getUTCDate() - dayOfWeek);

    const generatedWeeks: Array<Array<{ dateStr: string; dateObj: Date; inRange: boolean }>> = [];
    const months: Array<{ label: string; weekIndex: number }> = [];

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
        months.push({
          label: cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
          weekIndex: weekIdx,
        });
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

    return { weeks: generatedWeeks, monthLabels: months };
  }, [activeFilter, compact]);

  const getIntensityClass = (minutes: number) => {
    if (minutes <= 0) return 'bg-slate-100/80 border-slate-200/50 hover:border-slate-300';
    if (minutes < 15)
      return 'bg-purple-200 border-purple-300/70 hover:ring-2 hover:ring-purple-300';
    if (minutes < 30)
      return 'bg-purple-400 border-purple-500/70 hover:ring-2 hover:ring-purple-400';
    if (minutes < 60)
      return 'bg-purple-600 border-purple-700/70 hover:ring-2 hover:ring-purple-500';
    return 'bg-purple-800 border-purple-950/70 hover:ring-2 hover:ring-purple-600';
  };

  const activeDay = selectedDay || hoveredDay;

  return (
    <div className="flex flex-col gap-5">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
            Recorded daily practice duration across drills and diagnostic sessions.
          </p>
        </div>

        {!compact && (
          <div className="flex items-center gap-1 rounded-full bg-slate-100/90 p-1 border border-slate-200/80 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleFilterClick(30)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === 30
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick(180)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === 180
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 6 Months
            </button>
            <button
              type="button"
              onClick={() => handleFilterClick(365)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === 365
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Year
            </button>
          </div>
        )}
      </div>

      {/* Summary Statistics Bar */}
      {activity && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Study Hours
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalStudyHours}h
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Active Days
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.activeDaysCount}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Current Streak
            </span>
            <span className="text-xl font-bold tracking-tight text-purple-700 mt-1 flex items-center gap-1">
              {activity.currentStreak}d
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Longest Streak
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.longestStreak}d
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Sessions
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalSessions}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Questions
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.totalQuestions}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50/60 p-3 border border-purple-100/80 flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Avg / Active Day
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 mt-1">
              {activity.averageDailyMinutes}m
            </span>
          </div>
        </div>
      )}

      {/* Heatmap Contribution Grid Container */}
      <div className="rounded-2xl bg-white/70 p-4 sm:p-5 border border-purple-100/80 shadow-xs flex flex-col gap-3 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading study heatmap…</div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-fit">
              {/* Month Labels Row */}
              <div className="flex text-[11px] font-medium text-slate-400 pl-8 pb-1.5 h-5">
                {monthLabels.map((m, i) => (
                  <span
                    key={`${m.label}-${i}`}
                    style={{
                      position: 'relative',
                      left: `${m.weekIndex * 15}px`,
                      marginRight: '-10px',
                    }}
                    className="whitespace-nowrap"
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Grid: 7 Rows (Sun-Sat) x N Columns */}
              <div className="flex gap-1 items-start">
                {/* Weekday Labels (Mon, Wed, Fri) */}
                <div className="flex flex-col gap-1 text-[10px] text-slate-400 pr-1 select-none pt-0.5">
                  <span className="h-3 leading-3">Sun</span>
                  <span className="h-3 leading-3 font-semibold text-slate-500">Mon</span>
                  <span className="h-3 leading-3">Tue</span>
                  <span className="h-3 leading-3 font-semibold text-slate-500">Wed</span>
                  <span className="h-3 leading-3">Thu</span>
                  <span className="h-3 leading-3 font-semibold text-slate-500">Fri</span>
                  <span className="h-3 leading-3">Sat</span>
                </div>

                {/* Weekly Columns */}
                <div className="flex gap-1">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                      {week.map((day) => {
                        const act = activityMap.get(day.dateStr);
                        const minutes = act ? Math.round(act.activeSeconds / 60) : 0;
                        const isSelected = selectedDay?.date === day.dateStr;

                        return (
                          <button
                            key={day.dateStr}
                            type="button"
                            disabled={!day.inRange}
                            onMouseEnter={() => {
                              if (day.inRange) {
                                setHoveredDay(
                                  act || {
                                    date: day.dateStr,
                                    activeSeconds: 0,
                                    questionsAnswered: 0,
                                    sessionCount: 0,
                                    topics: [],
                                    isRestDay: false,
                                  },
                                );
                              }
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                            onClick={() => {
                              if (day.inRange) {
                                setSelectedDay(
                                  act || {
                                    date: day.dateStr,
                                    activeSeconds: 0,
                                    questionsAnswered: 0,
                                    sessionCount: 0,
                                    topics: [],
                                    isRestDay: false,
                                  },
                                );
                              }
                            }}
                            className={`h-3 w-3 rounded-xs border transition-all ${
                              day.inRange
                                ? getIntensityClass(minutes)
                                : 'opacity-0 pointer-events-none'
                            } ${
                              isSelected
                                ? 'ring-2 ring-purple-600 ring-offset-1 z-10 scale-125'
                                : ''
                            }`}
                            aria-label={`${day.dateStr}: ${minutes} mins studied`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend & Day Details Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-purple-100/50 text-xs text-slate-600">
          {/* Active / Hovered Day Details */}
          <div className="flex items-center gap-2 min-h-6">
            {activeDay ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900">
                  {new Date(activeDay.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                  :
                </span>
                <span className="font-medium text-purple-950">
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
              <span className="text-slate-400 text-[11px]">
                Hover or click any square to inspect actual recorded duration and questions.
              </span>
            )}
          </div>

          {/* Less -> More Legend */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto text-[11px] text-slate-500 font-medium">
            <span>Less</span>
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-100 border border-slate-200/50" />
            <span className="h-2.5 w-2.5 rounded-xs bg-purple-200 border border-purple-300" />
            <span className="h-2.5 w-2.5 rounded-xs bg-purple-400 border border-purple-500" />
            <span className="h-2.5 w-2.5 rounded-xs bg-purple-600 border border-purple-700" />
            <span className="h-2.5 w-2.5 rounded-xs bg-purple-800 border border-purple-950" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Commitment & Rest Day Summary Note */}
      {activity?.commitment && (
        <div className="rounded-xl bg-purple-50/50 p-4 border border-purple-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
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
