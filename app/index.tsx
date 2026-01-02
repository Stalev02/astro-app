import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { Redirect, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';

export default function Index() {
  const navState = useRootNavigationState();
  const { hydrated, introSeen } = useApp();

  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    (async () => {
      try {
        const sb = await getSupabase();
const {
  data: { session },
} = await sb.auth.getSession();


        if (!session) {
          // не залогинен
          if (!introSeen) {
            setTarget('/intro');        // сначала интро (один раз на девайс)
          } else {
            setTarget('/auth/login');   // потом всегда логин
          }
        } else {
          // есть сессия → смотрим флаг онбординга в аккаунте
          const adminEmail = (process.env.EXPO_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
const isAdmin = adminEmail && (session.user?.email || '').toLowerCase() === adminEmail;

// normal onboarding flag
      const accountOnboardingDone = !!session.user?.user_metadata?.onboarding_done;

      // admin override
      const shouldForceOnboarding = isAdmin;

      if (shouldForceOnboarding || !accountOnboardingDone) {
        setTarget('/onboarding');
      } else {
        setTarget('/(tabs)/astro-map');
      }

        }
      } catch (e) {
        // если Supabase не настроен — просто логин
        setTarget('/auth/login');
      } finally {
        setReady(true);
      }
    })();
  }, [hydrated, introSeen]);

  if (!navState?.key || !ready || !hydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b0c' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ color: '#c7c9d1', marginTop: 10 }}>Загрузка…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return target ? <Redirect href={target as any} /> : null;
}