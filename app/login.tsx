import AntDesign from '@expo/vector-icons/AntDesign';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Alert, Platform, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth-button/auth-button.component';
import { signInWithApple, signInWithGoogle } from '@/util/auth/auth.util';

const introVideo = require('@/assets/videos/intro_movie.mp4');

/** Runs a sign-in function, shows a localized alert on failure, never propagates. */
async function handleSignIn(title: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert(title, message);
  }
}

/** Full-screen login gate with Google and Apple sign-in options. */
export default function LoginScreen() {
  const { t } = useTranslation();
  const failedTitle = t('auth.signInFailed');

  // Asset is already cached by the root layout, so playback starts instantly
  const player = useVideoPlayer(introVideo, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View className="flex-1">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={false}
        contentFit="cover"
      />

      {/* Logo & subtitle */}
      <View className="flex-1 items-center justify-center px-12 pt-16">
        <Image
          source={require('@/assets/svgs/szpont-logo.svg')}
          contentFit="contain"
          style={{ width: '100%', aspectRatio: 2642 / 512 }}
        />
      </View>

      {/* Sign-in buttons & disclaimer */}
      <View className="items-center px-6 pb-16 gap-2">
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={16}
            style={{ width: '100%', height: 52 }}
            onPress={() => handleSignIn(failedTitle, signInWithApple)}
          />
        )}
        {Platform.OS === 'android' && (
          <AuthButton
            dark={true}
            label={t('auth.signInWithGoogle')}
            icon={<AntDesign name="google" size={20} className="text-black" />}
            onPress={() => handleSignIn(failedTitle, signInWithGoogle)}
          />
        )}
        <Text className="text-white/60 text-xs text-center">
          {t('auth.disclaimer')}
        </Text>
      </View>
    </View>
  );
}
