import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { useGameActiveContext } from '@/hooks/game-active/game-active.context';
import { getNextGameStartDateTime } from '@/util/game-window/is-game-active.util';

const PROGRESS_TICK_MS = 30_000;

/** Formats the next start label shown in the inactive schedule card. */
function getStartsAtLabel(nextStart: DateTime | null, locale: string, fallbackLabel: string): string {
  if (nextStart == null) {
    return fallbackLabel;
  }
  return nextStart.setLocale(locale).toLocaleString({
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** Schedule card shown on the inactive game screen. */
export function GameInactiveCountdownCard() {
  const { t, i18n } = useTranslation();
  const { schedules } = useGameActiveContext();
  const [now, setNow] = useState<DateTime>(() => DateTime.local());

  useEffect(() => {
    // Keep the schedule text and fill in sync as wall-clock time advances.
    const interval = setInterval(() => {
      setNow(DateTime.local());
    }, PROGRESS_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const nextStart = useMemo(() => getNextGameStartDateTime(schedules, now), [schedules, now]);
  const startsAtLabel = useMemo(
    () =>
      getStartsAtLabel(
        nextStart,
        i18n.resolvedLanguage ?? 'en',
        t('gameInactiveView.scheduleUnavailable'),
      ),
    [i18n.resolvedLanguage, nextStart, t],
  );
  return (
    <View className="rounded-3xl bg-primary px-5 py-4">
      <Text className="text-xs text-on-primary" style={styles.nunitoSemi}>
        {t('gameInactiveView.nextGameStarts')}
      </Text>
      <Text className="text-3xl text-background font-bold capitalize" style={styles.nunitoExtraBold}>
        {startsAtLabel}
      </Text>
      <Text className="text-xs text-on-primary" style={styles.nunitoSemi}>
        {t('gameInactiveView.usersSignedUp', { count: 234 })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create<{
  nunitoSemi: TextStyle;
  nunitoExtraBold: TextStyle;
}>({
  nunitoSemi: {
    fontFamily: 'Nunito_600SemiBold',
  },
  nunitoExtraBold: {
    fontFamily: 'Nunito_800ExtraBold',
  },
});
