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
        const sb = getSupabase();
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
          const accountOnboardingDone =
            !!session.user?.user_metadata?.onboarding_done;

          if (!accountOnboardingDone) {
            setTarget('/onboarding');          // онбординг один раз на аккаунт
          } else {
            setTarget('/(tabs)/astro-map');    // всё пройдено → основное приложение
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