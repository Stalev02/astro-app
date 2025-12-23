/* eslint-disable import/order */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const anon = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

console.log('[supabase env]', { url: url || 'missing', anon: anon ? 'present' : 'missing' });

let client: SupabaseClient | null = null;

// One-time reset guard (per app launch)
let didResetBadSession = false;

if (url && anon) {
  client = createClient(url, anon, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} else {
  console.warn(
    '[supabase] Missing env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Auth disabled until you set them.'
  );
}

export const supabase = client;

/**
 * Returns initialized Supabase client.
 * If the stored refresh token is corrupted (common on device when keys/project changed),
 * we clear auth storage once so network calls do not crash.
 */
export async function getSupabase(): Promise<SupabaseClient> {
  if (!client) {
    throw new Error(
      'Supabase не сконфигурирован. Задай EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY и перезапусти (expo start -c).'
    );
  }

  if (!didResetBadSession) {
    didResetBadSession = true;
    try {
      // Try to read session once; if it throws or returns weird state, clear it.
      await client.auth.getSession();
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (/refresh token/i.test(msg) || /Invalid Refresh Token/i.test(msg)) {
        try {
          // Clear auth state (this removes the broken token from storage)
          await client.auth.signOut();
          console.log('[supabase] Cleared invalid refresh token from storage');
        } catch {
          // ignore
        }
      }
    }
  }

  return client;
}
