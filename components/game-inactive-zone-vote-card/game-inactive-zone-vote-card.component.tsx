import RNBounceable from '@freakycoder/react-native-bounceable';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

interface GameInactiveZoneVoteCardProps {
  zoneLabel: string;
  voteShare: number;
  isLeading: boolean;
  onVote: () => void;
}

/** Zone vote card shown in inactive game governance section. */
export function GameInactiveZoneVoteCard({ zoneLabel, voteShare, isLeading, onVote }: GameInactiveZoneVoteCardProps) {
  return (
    <View className="rounded-3xl border border-border bg-surface px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-xl text-foreground" style={styles.nunitoBold}>
            {zoneLabel}
          </Text>
          <View className="mt-3 flex-row items-center">
            <View className="h-2 flex-1 overflow-hidden rounded-full bg-highlight">
              <View
                className={`${isLeading ? 'bg-accent' : 'bg-muted/35'} h-full rounded-r-full`}
                style={{ width: `${voteShare}%` }}
              />
            </View>
            <Text className="ml-2 text-xs text-muted" style={styles.nunitoBold}>
              {voteShare}%
            </Text>
          </View>
        </View>

        <RNBounceable onPress={onVote}>
          <View className="rounded-full bg-accent px-5 py-3" collapsable={false}>
            <Text className="text-xs uppercase text-on-accent" style={styles.nunitoBold}>
              Vote
            </Text>
          </View>
        </RNBounceable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create<{ nunitoBold: TextStyle }>({
  nunitoBold: {
    fontFamily: 'Nunito_700Bold',
  },
});
