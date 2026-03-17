import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useTranslation } from 'react-i18next';
import { Platform, Text, useColorScheme, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { AccentTitle } from '@/components/accent-title/accent-title.component';
import { useBackgroundLocationPermission } from '@/hooks/location/use-background-location-permission.hook';
import { useForegroundLocationPermission } from '@/hooks/location/use-foreground-location-permission.hook';
import { Colors } from '@/util/theme/theme.util';

const nunitoSemiBold = { fontFamily: 'Nunito_600SemiBold' } as const;
const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

/** Whether the Transistor background-location adapter is active. */
const IS_TRANSISTOR = process.env.EXPO_PUBLIC_BG_LOCATION_ADAPTER === 'transistor';

// ── Permission check row ────────────────────────────────────────────────

/** A tappable row showing a permission's granted state, title, and description. */
function PermissionCheckRow({
  granted,
  disabled,
  highlight,
  title,
  description,
  onPress,
}: {
  granted: boolean;
  disabled?: boolean;
  /** When true, the row background pulses with a highlight color. */
  highlight?: boolean;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const isLight = useColorScheme() === 'light';
  const highlightColor = isLight ? Colors.light.highlight : Colors.dark.highlight;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (highlight) {
      progress.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [highlight, progress]);

  const rowBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['transparent', highlightColor]),
  }));

  return (
    <RNBounceable onPress={onPress} disabled={disabled}>
      <Animated.View
        className="flex-row items-center gap-3 py-3 px-3 rounded-xl"
        style={[{ opacity: disabled ? 0.4 : 1 }, rowBgStyle]}
      >
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 28, height: 28, borderWidth: 2, borderColor: '#CCFF00', backgroundColor: granted ? '#CCFF00' : 'transparent' }}
        >
          {granted && <Ionicons name="checkmark" size={18} color="#262626" />}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-base font-semibold" style={nunitoSemiBold}>{title}</Text>
          <Text className="text-muted text-sm" style={nunitoRegular}>{description}</Text>
        </View>
      </Animated.View>
    </RNBounceable>
  );
}

// ── Slide component ─────────────────────────────────────────────────────

/** Slide 7 — location permissions: privacy card + interactive permission checklist with pulse on the next action. */
export function SlideLocation() {
  const { t } = useTranslation();
  const isLight = useColorScheme() === 'light';

  const fgPermission = useForegroundLocationPermission();
  const bgPermission = useBackgroundLocationPermission();

  const fgGranted = fgPermission.status === 'granted';
  const bgGranted = bgPermission.status === 'granted';

  // Determine which row is the topmost uncompleted one to highlight
  const highlightFg = !fgGranted;
  const highlightBg = fgGranted && !bgGranted;
  // Battery and motion highlight logic (always false for now since granted state is not tracked)
  const highlightBattery = fgGranted && bgGranted;
  const highlightMotion = fgGranted && bgGranted && Platform.OS !== 'android';

  return (
    <View className="flex-1 justify-center px-8">
      <AccentTitle
        before={t('welcome.slide6TitleBefore')}
        accent={t('welcome.slide6TitleAccent')}
        large
        outlined={isLight}
      />

      {/* Privacy card */}
      <View className="rounded-2xl px-5 py-4 mt-6 flex-row items-center gap-3" style={{ backgroundColor: isLight ? '#f0f0f0' : 'rgba(28,28,28,0.8)' }}>
        <Ionicons name="lock-closed" size={18} color="#888" />
        <Text className="text-muted text-base leading-relaxed flex-1" style={nunitoRegular}>
          {t('welcome.slide6Privacy')}
        </Text>
      </View>

      {/* Permission checklist */}
      <View className="mt-6">
        <PermissionCheckRow
          granted={fgGranted}
          highlight={highlightFg}
          title={t('welcome.slide6PermForeground')}
          description={t('welcome.slide6PermForegroundDesc')}
          onPress={fgPermission.request}
        />
        <PermissionCheckRow
          granted={bgGranted}
          disabled={!fgGranted}
          highlight={highlightBg}
          title={t('welcome.slide6PermBackground')}
          description={t('welcome.slide6PermBackgroundDesc')}
          onPress={bgPermission.request}
        />
        {Platform.OS === 'android' && (
          <PermissionCheckRow
            granted={false}
            highlight={highlightBattery}
            title={t('welcome.slide6PermBattery')}
            description={t('welcome.slide6PermBatteryDesc')}
            onPress={() => {/* TODO: expo-battery optimization request */ }}
          />
        )}
        {IS_TRANSISTOR && (
          <PermissionCheckRow
            granted={false}
            highlight={highlightMotion}
            title={t('welcome.slide6PermMotion')}
            description={t('welcome.slide6PermMotionDesc')}
            onPress={() => {/* TODO: Transistor motion permission request */ }}
          />
        )}
      </View>
    </View>
  );
}
