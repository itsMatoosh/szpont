import RNBounceable from '@freakycoder/react-native-bounceable';
import { GlassView } from 'expo-glass-effect';
import { StyleSheet, Text, View } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ZoneHeaderProps {
  cityName: string | undefined;
  zoneName: string | undefined;
  /** Safe-area top inset used to position the header below the status bar. */
  topInset: number;
  onBack: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/** Back button + zone/city name header shown when viewing a single zone. */
export function ZoneHeader({ cityName, zoneName, topInset, onBack }: ZoneHeaderProps) {
  return (
    <>
      <View style={[styles.backButton, { top: topInset + 12 }]}>
        <RNBounceable onPress={onBack}>
          <GlassView style={styles.backButtonInner}>
            <Text style={styles.backChevron}>‹</Text>
          </GlassView>
        </RNBounceable>
      </View>
      <GlassView style={[styles.zoneHeader, { top: topInset + 12 }]}>
        {cityName && <Text style={styles.zoneCityText}>{cityName}</Text>}
        {zoneName && <Text style={styles.zoneNameText}>{zoneName}</Text>}
      </GlassView>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  zoneHeader: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  zoneCityText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  zoneNameText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    marginLeft: -2,
  },
});
