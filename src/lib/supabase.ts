
/* eslint-disable import/order */ 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';




const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log("[supabase env]", { url, anon: anon ? "present" : "missing" });


let client: SupabaseClient | null = null;

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
    '[supabase] Missing env: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Auth disabled until you set them.'
  );
}

// оставляем экспорт (может быть null — вдруг захочешь проверять вручную)
export const supabase = client;

/** Возвращает инициализированный клиент (не null). Бросает ошибку, если .env не задан. */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase не сконфигурирован. Задай EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY и перезапусти (expo start -c).'
    );
  }
  return client;
}
