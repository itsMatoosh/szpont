import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SquadMemberProps {
  displayName: string;
  age: number;
  avatarUrl?: string;
}

/** Single 3-column grid item: circular 1:1 avatar with a compact name-and-age label. */
export function SquadMember({ displayName, age, avatarUrl }: SquadMemberProps) {
  const initial = displayName.charAt(0).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <View className="w-1/3 px-2 pb-4">
      <View
        className="w-full overflow-hidden rounded-full border border-white/15 bg-black/10"
        style={{ aspectRatio: 1 }}
      >
        {avatarUrl && !imageFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={200}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-accent">
            <Text className="text-4xl font-bold text-on-accent">{initial}</Text>
          </View>
        )}
      </View>
      <Text className="mt-2 text-center text-xs text-muted" numberOfLines={1} ellipsizeMode="tail">
        {`${displayName}, ${age}`}
      </Text>
    </View>
  );
}
