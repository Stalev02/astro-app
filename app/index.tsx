// app/index.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { Redirect, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';

export default function Index() {
  const navState = useRootNavigationState();
  const { onboardingDone, testMode } = useApp();
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const sb = getSupabase();
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (testMode) {
          // ТЕСТ-РЕЖИМ: всегда идём в онбординг (и дальше в рантайме можно открывать «первый вход» экраны)
          setTarget('/onboarding');
        } else if (!session) {
          // пользователь не вошёл → экран логина
          setTarget('/auth/login');
        } else if (!onboardingDone) {
          // вошёл, но не прошёл онбординг → на онбординг
          setTarget('/onboarding');
        } else {
          // всё готово → основное приложение
          setTarget('/(tabs)/astro');
        }
      } catch (e) {
        console.warn('[index] init error', e);
        setTarget('/auth/login');
      } finally {
        setReady(true);
      }
    };

    init();
  }, [onboardingDone, testMode]);

  // ждём, пока смонтируется навигатор
  if (!navState?.key || !ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0b0b0c' }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={{ color: '#c7c9d1', marginTop: 10 }}>Загрузка…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return target ? <Redirect href={target as any} /> : null;
}
