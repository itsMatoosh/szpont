import { Image } from 'expo-image';
import { Text, View } from 'react-native';

interface AvatarProps {
  /** Remote image URL (e.g. from Google/Apple sign-in metadata). */
  uri?: string;
  /** Display name used to derive a single-letter fallback initial. */
  name: string;
  /** Diameter in points. Defaults to 80. */
  size?: number;
}

/** Circular avatar that shows a remote image or falls back to the first initial. */
export function Avatar({ uri, name, size = 80 }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      className="items-center justify-center bg-accent"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text
        className="font-bold text-on-accent"
        style={{ fontSize: size * 0.4 }}
      >
        {initial}
      </Text>
    </View>
  );
}
