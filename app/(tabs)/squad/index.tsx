import { useCallback, useLayoutEffect } from 'react';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';

import { SquadMember } from '@/components/squad-member/squad-member.component';
import { useSelectedZoneContext } from '@/hooks/selected-zone/selected-zone.context';
import { useSquad } from '@/hooks/squad/use-squad.hook';

/** Squad grid for the selected map zone (or city-wide) with a dynamic native header. */
export default function SquadTabScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    selectedZoneId,
    selectedZoneName,
    currentCityName,
    activeZoneId,
    clearSelectedZone,
  } = useSelectedZoneContext();
  const { members, loadMore, hasMore } = useSquad(selectedZoneId);

  const title = selectedZoneName ?? currentCityName ?? t('sheet.squadTitle');

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerLeft:
        selectedZoneId && activeZoneId == null
          ? () => (
              <RNBounceable onPress={clearSelectedZone}>
                <View className="pb-1 pr-1">
                  <Text className="text-3xl text-foreground">{'\u2039'}</Text>
                </View>
              </RNBounceable>
            )
          : undefined,
    });
  }, [activeZoneId, clearSelectedZone, navigation, selectedZoneId, title]);

  /** Loads more members when the end of the list is reached. */
  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    loadMore();
  }, [hasMore, loadMore]);

  return (
    <View className="flex-1 bg-background pt-2">
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <SquadMember displayName={item.displayName} age={item.age} avatarUrl={item.avatarUrl} />
        )}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}
