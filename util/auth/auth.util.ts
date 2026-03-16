import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { getBackgroundLocationAdapter } from '@/util/background-location/background-location.adapter';
import { unregisterDevice } from '@/util/device/device.util';
import { supabase } from '@/util/supabase/supabase.util';

/**
 * Initiates native Google Sign-In, then exchanges the returned ID token for a
 * Supabase session via `signInWithIdToken`.
 */
export async function signInWithGoogle() {
  // Configure lazily so the app doesn't crash when client IDs are not yet set
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  const hasPlayServices = await GoogleSignin.hasPlayServices();
  if (!hasPlayServices) {
    throw new Error('Google Play Services are not available on this device');
  }

  const response = await GoogleSignin.signIn();

  // User-initiated cancellations should not show an error
  if (response.type === 'cancelled') return;

  // Check if the response contains an ID token
  if (!response.data.idToken) {
    throw new Error('Google Sign-In did not return an ID token');
  }

  // Exchange the ID token for a Supabase session
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: response.data.idToken,
  });

  if (error) throw error;
}

/**
 * Initiates native Apple Sign-In with a SHA-256 hashed nonce, then exchanges
 * the returned identity token for a Supabase session.
 */
export async function signInWithApple() {
  // Generate a random nonce for the Apple Sign-In
  const rawNonce = Crypto.getRandomValues(new Uint8Array(32)).reduce(
    (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
    '',
  );
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  // Initiate the Apple Sign-In
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e: unknown) {
    // User dismissed the native prompt — not an error
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') {
      return;
    }
    throw e;
  }

  // Check if the credential contains an identity token
  if (!credential.identityToken) {
    throw new Error('Apple Sign-In did not return an identity token');
  }

  // Exchange the identity token for a Supabase session
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;
}

/** Signs the current user out, stops background tracking, unregisters the device, and clears the local Supabase session. */
export async function signOut() {
  await getBackgroundLocationAdapter().stop().catch(() => {});
  await unregisterDevice().catch(() => {});

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
