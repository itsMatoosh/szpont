import { DateTime } from 'luxon';

import { type GameSchedule } from '@/util/game-window/game-schedule.util';

/** Evaluates whether the current local time falls within a single schedule window. */
function isWindowActive(now: DateTime, schedule: GameSchedule): boolean {
  if (!schedule.enabled) return false;

  const currentDay = now.weekday % 7;
  const currentMinuteOfWeek = currentDay * 24 * 60 + now.hour * 60 + now.minute;
  const startMinuteOfWeek = schedule.start_day * 24 * 60 + schedule.start_hour * 60;
  const endMinuteOfWeek = schedule.end_day * 24 * 60 + schedule.end_hour * 60;

  // Equal endpoints would represent a zero-length window.
  if (startMinuteOfWeek === endMinuteOfWeek) return false;

  if (startMinuteOfWeek < endMinuteOfWeek) {
    return currentMinuteOfWeek >= startMinuteOfWeek && currentMinuteOfWeek < endMinuteOfWeek;
  }

  // Wrap-around window (e.g., Saturday 18:00 -> Sunday 03:00).
  return currentMinuteOfWeek >= startMinuteOfWeek || currentMinuteOfWeek < endMinuteOfWeek;
}

/**
 * Returns whether the game is active right now using server-defined schedules.
 * Day mapping is JS style: 0=Sunday ... 6=Saturday.
 */
export function isGameActive(schedules: GameSchedule[]): boolean {
  const now = DateTime.local();
  return schedules.some((schedule) => isWindowActive(now, schedule));
}
