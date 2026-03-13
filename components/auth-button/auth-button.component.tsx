import RNBounceable from '@freakycoder/react-native-bounceable';
import { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface AuthButtonProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  dark?: boolean;
}

/**
 * Generic branded sign-in button with an icon, label, and bounce feedback.
 * Used for OAuth providers that need a custom-styled button (e.g. Google).
 */
export function AuthButton({ label, icon, onPress, dark = false }: AuthButtonProps) {
  return (
    <RNBounceable onPress={onPress}>
      <View className={`flex-row items-center justify-center gap-3 rounded-2xl px-6 ${dark ? 'bg-white' : 'bg-black'}`} style={{ height: 52 }}>
        {icon}
        <Text className={`text-xl font-semibold ${dark ? 'text-black' : 'text-white'}`}>{label}</Text>
      </View>
    </RNBounceable>
  );
}
