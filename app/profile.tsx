import Ionicons from '@expo/vector-icons/Ionicons';
import RNBounceable from '@freakycoder/react-native-bounceable';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar/avatar.component';
import { useAuth } from '@/hooks/auth/use-auth.hook';
import { useProfileContext } from '@/hooks/profile/profile.context';
import { supabase } from '@/util/supabase/supabase.util';

/** Computes age in full years from a YYYY-MM-DD date string. */
function getAge(dateOfBirth: string): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/** Formats a timestamptz string into a human-readable month + year, e.g. "March 2026". */
function formatJoinDate(createdAt: string, locale: string): string {
  const date = new Date(createdAt);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/** Profile screen presented as a formSheet showing the current user's info. */
export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { profile } = useProfileContext();

  const avatarUrl = session?.user.user_metadata?.avatar_url as string | undefined;

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert(error.message);
    }
  };

  if (!profile) return null;

  const age = getAge(profile.date_of_birth);
  const joinDate = formatJoinDate(profile.created_at, i18n.language);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-6 pb-12 pt-8"
    >
      {/* Header: avatar + friends stat */}
      <View className="flex-row items-center">
        <Avatar uri={avatarUrl} name={profile.display_name} size={88} />

        <View className="flex-1 items-center">
          <Text className="text-2xl font-bold text-foreground">0</Text>
          <Text className="text-sm text-muted">{t('profile.friends')}</Text>
        </View>
      </View>

      {/* Name, age, username */}
      <View className="mt-4">
        <Text className="text-lg font-bold text-foreground">
          {profile.display_name}, {age}
        </Text>
        <Text className="text-sm text-muted">@{profile.username}</Text>
      </View>

      {/* Bio */}
      {profile.bio.length > 0 && (
        <Text className="mt-2 text-base text-foreground">{profile.bio}</Text>
      )}

      {/* Edit profile button */}
      <RNBounceable onPress={() => router.push('/edit-profile')} className="mt-4">
        <View className="items-center rounded-xl border border-border py-2">
          <Text className="text-sm font-semibold text-foreground">
            {t('profile.editProfile')}
          </Text>
        </View>
      </RNBounceable>

      {/* Member since */}
      <Text className="mt-6 text-center text-sm text-muted">
        {t('profile.memberSince', { date: joinDate })}
      </Text>

      {/* Sign out */}
      <RNBounceable onPress={handleSignOut} className="mt-8">
        <View className="flex-row items-center justify-center gap-2 rounded-xl bg-surface py-3">
          <Ionicons name="log-out-outline" size={20} color="#8E8E8E" />
          <Text className="text-base font-semibold text-muted">
            {t('profile.signOut')}
          </Text>
        </View>
      </RNBounceable>
    </ScrollView>
  );
}
