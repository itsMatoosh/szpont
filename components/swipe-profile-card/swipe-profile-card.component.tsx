import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Image as RNImage,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { SwipeProfile } from '@/hooks/swipe-deck/use-swipe-feed.hook';
import { SafeAreaView } from 'react-native-safe-area-context';

const nunitoSemi = { fontFamily: 'Nunito_600SemiBold' } as const;
const nunitoRegular = { fontFamily: 'Nunito_400Regular' } as const;

interface SwipeProfileCardProps {
  profile: SwipeProfile;
  /** Optional wrapper style (e.g. absolute stack offsets). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Hide text/buttons on background cards in the stack. */
  showForeground?: boolean;
  /** Extra bottom clearance for tab bar + safe area. */
  bottomInset?: number;
  /** Actions row rendered below bio (e.g. Skip / Like). */
  footerActions?: ReactNode;
}

/** Two-layer discover card: full-card blurred backdrop + centered 2:3 sharp portrait. */
export function SwipeProfileCard({
  profile,
  containerStyle,
  showForeground = true,
  bottomInset = 0,
  footerActions,
}: SwipeProfileCardProps) {
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  const portraitSize = useMemo(() => {
    if (cardSize.width <= 0 || cardSize.height <= 0) {
      return { width: 0, height: 0 };
    }
    const maxWidthByHeight = (cardSize.height * 2) / 3;
    const width = Math.min(cardSize.width, maxWidthByHeight);
    const height = width * 1.5;
    return { width, height };
  }, [cardSize.height, cardSize.width]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardSize((prev) => {
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={[styles.card, containerStyle]} onLayout={handleLayout}>
        <RNImage source={{ uri: profile.imageUri }} style={StyleSheet.absoluteFill} blurRadius={28} />

        <View style={styles.centerLayer} pointerEvents="none">
          {portraitSize.width > 0 && (
            <View
              style={[
                styles.portraitFrame,
                {
                  width: portraitSize.width,
                  height: portraitSize.height,
                },
              ]}
            >
              <Image source={{ uri: profile.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          )}
        </View>

        {showForeground && (
          <View style={styles.foregroundLayer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.32)', 'rgba(0,0,0,0.65)']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.foregroundContent, { paddingBottom: bottomInset }]}>
              <Text className="text-3xl text-foreground" style={nunitoSemi} numberOfLines={1}>
                {profile.displayName}
              </Text>
              <Text className="text-lg mt-1" style={[nunitoRegular, styles.ageText]}>
                {profile.age}
              </Text>
              <Text className="text-base mt-3" style={[nunitoRegular, styles.bioText]} numberOfLines={3}>
                {profile.bio}
              </Text>
              {footerActions ? <View className="mt-4">{footerActions}</View> : null}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
    borderRadius: 48,
  },
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitFrame: {
    overflow: 'hidden',
  },
  foregroundLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  foregroundContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  ageText: {
    color: 'rgba(245,245,245,0.9)',
  },
  bioText: {
    color: 'rgba(245,245,245,0.85)',
  },
});
