import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { useT } from '@/src/shared/i18n';
import { Redirect, useRootNavigationState } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';

export default function Index() {
  const navState = useRootNavigationState();
  const { hydrated, introSeen } = useApp();
  const t = useT();

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
          if (!introSeen) {
            setTarget('/intro');
          } else {
            setTarget('/auth/login');
          }
        } else {
          const adminEmail = (process.env.EXPO_PUBLIC_ADMIN_EMAIL || '').trim().toLowerCase();
          const isAdmin = adminEmail && (session.user?.email || '').toLowerCase() === adminEmail;
          const accountOnboardingDone = !!session.user?.user_metadata?.onboarding_done;
          const shouldForceOnboarding = isAdmin;

          if (shouldForceOnboarding || !accountOnboardingDone) {
            setTarget('/onboarding');
          } else {
            setTarget('/(tabs)/astro-map');
          }
        }
      } catch (e) {
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
          <Text style={{ color: '#c7c9d1', marginTop: 10 }}>{t.index.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return target ? <Redirect href={target as any} /> : null;
}
