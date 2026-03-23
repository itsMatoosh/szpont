import { DateTime } from 'luxon';

import { type GameSchedule } from '@/util/game-window/game-schedule.util';

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_WEEK = DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR;

/** Returns minute-of-week using JS day mapping (0=Sunday..6=Saturday). */
function minuteOfWeek(day: number, hour: number): number {
  return day * HOURS_PER_DAY * MINUTES_PER_HOUR + hour * MINUTES_PER_HOUR;
}

/** Returns the current local minute-of-week. */
function currentMinuteOfWeek(now: DateTime): number {
  const currentDay = now.weekday % DAYS_PER_WEEK;
  return minuteOfWeek(currentDay, now.hour) + now.minute;
}

/** Returns enabled schedules only, so all derived helpers share one filter. */
function enabledSchedules(schedules: GameSchedule[]): GameSchedule[] {
  return schedules.filter((schedule) => schedule.enabled);
}

/** Evaluates whether the current local time falls within a single schedule window. */
function isWindowActive(now: DateTime, schedule: GameSchedule): boolean {
  const nowMinuteOfWeek = currentMinuteOfWeek(now);
  const startMinuteOfWeek = minuteOfWeek(schedule.start_day, schedule.start_hour);
  const endMinuteOfWeek = minuteOfWeek(schedule.end_day, schedule.end_hour);

  // Equal endpoints would represent a zero-length window.
  if (startMinuteOfWeek === endMinuteOfWeek) return false;

  if (startMinuteOfWeek < endMinuteOfWeek) {
    return nowMinuteOfWeek >= startMinuteOfWeek && nowMinuteOfWeek < endMinuteOfWeek;
  }

  // Wrap-around window (e.g., Saturday 18:00 -> Sunday 03:00).
  return nowMinuteOfWeek >= startMinuteOfWeek || nowMinuteOfWeek < endMinuteOfWeek;
}

/**
 * Returns whether the game is active right now using server-defined schedules.
 * Day mapping is JS style: 0=Sunday ... 6=Saturday.
 */
export function isGameActive(schedules: GameSchedule[]): boolean {
  const now = DateTime.local();
  return enabledSchedules(schedules).some((schedule) => isWindowActive(now, schedule));
}

/**
 * Returns the next schedule start in local time, or null when none are enabled.
 * Day mapping is JS style: 0=Sunday ... 6=Saturday.
 */
export function getNextGameStartDateTime(
  schedules: GameSchedule[],
  now: DateTime = DateTime.local(),
): DateTime | null {
  const nowMinuteOfWeek = currentMinuteOfWeek(now);
  const nextStartDeltaMinutes = enabledSchedules(schedules).reduce<number | null>(
    (closestDelta, schedule) => {
      const startMinute = minuteOfWeek(schedule.start_day, schedule.start_hour);
      const delta = startMinute >= nowMinuteOfWeek
        ? startMinute - nowMinuteOfWeek
        : MINUTES_PER_WEEK - (nowMinuteOfWeek - startMinute);
      if (closestDelta == null || delta < closestDelta) {
        return delta;
      }
      return closestDelta;
    },
    null,
  );

  if (nextStartDeltaMinutes == null) {
    return null;
  }
  return now.plus({ minutes: nextStartDeltaMinutes });
}

/**
 * Returns the most recent schedule end in local time, or null when none are enabled.
 * Day mapping is JS style: 0=Sunday ... 6=Saturday.
 */
export function getLastGameEndDateTime(
  schedules: GameSchedule[],
  now: DateTime = DateTime.local(),
): DateTime | null {
  const nowMinuteOfWeek = currentMinuteOfWeek(now);
  const elapsedSinceLastEnd = enabledSchedules(schedules).reduce<number | null>(
    (closestElapsed, schedule) => {
      const endMinute = minuteOfWeek(schedule.end_day, schedule.end_hour);
      const elapsed = nowMinuteOfWeek >= endMinute
        ? nowMinuteOfWeek - endMinute
        : MINUTES_PER_WEEK - (endMinute - nowMinuteOfWeek);
      if (closestElapsed == null || elapsed < closestElapsed) {
        return elapsed;
      }
      return closestElapsed;
    },
    null,
  );

  if (elapsedSinceLastEnd == null) {
    return null;
  }
  return now.minus({ minutes: elapsedSinceLastEnd });
}

/**
 * Returns inactive-phase progress toward the next game start.
 * Value is clamped to [0, 1], where 1 means the next start is reached.
 */
export function getInactiveProgressToNextStart(
  schedules: GameSchedule[],
  now: DateTime = DateTime.local(),
): number {
  const nextStart = getNextGameStartDateTime(schedules, now);
  const lastEnd = getLastGameEndDateTime(schedules, now);
  if (nextStart == null || lastEnd == null) {
    return 0;
  }

  const totalSeconds = nextStart.diff(lastEnd, 'seconds').seconds;
  if (totalSeconds <= 0) {
    return 0;
  }
  const elapsedSeconds = now.diff(lastEnd, 'seconds').seconds;
  return Math.min(1, Math.max(0, elapsedSeconds / totalSeconds));
}
