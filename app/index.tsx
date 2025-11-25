// app/index.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { Redirect, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';

export default function Index() {
  const navState = useRootNavigationState();
  const { onboardingDone, hydrated } = useApp();

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

        if (!onboardingDone) {
          // Первый запуск или незавершённый онбординг
          setTarget('/onboarding');
        } else if (!session) {
          // Онбординг уже был, но сессии нет → на экран логина
          setTarget('/auth/login');
        } else {
          // Всё ок: пользователь залогинен и онбординг завершён
          setTarget('/(tabs)/astro-map');
        }
      } catch (e) {
        // Если Supabase не сконфигурирован или произошла ошибка — отправляем на логин
        setTarget('/auth/login');
      } finally {
        setReady(true);
      }
    })();
  }, [onboardingDone, hydrated]);

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
