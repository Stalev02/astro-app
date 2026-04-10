// app/onboarding.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
};

export default function Onboarding() {
  const router = useRouter();

  const { tosAccepted, setTosAccepted, completeOnboarding } = useApp();

  // pages: 0..3
  const [page, setPage] = useState(0);
  const [tos, setTos] = useState<boolean>(false);

  // Guard: onboarding requires an authenticated session
  useEffect(() => {
    (async () => {
      try {
        const sb = await getSupabase();
        const { data } = await sb.auth.getSession();
        if (!data.session) router.replace('/auth/login');
      } catch {
        router.replace('/auth/login');
      }
    })();
  }, [router]);

  useEffect(() => {
  setTos(false);
  setTosAccepted(false);
}, [setTos, setTosAccepted]);

  const goProfile = () => router.push('/onboarding-profile');
  const goRect = () => router.push({ pathname: '/modal', params: { mode: 'rectification' } });

  const next = () => setPage((p) => Math.min(3, p + 1));
  const prev = () => setPage((p) => Math.max(0, p - 1));

  const handleTosChange = (value: boolean) => {
    setTos(value);
    setTosAccepted(value);
  };

  const finish = async () => {
    if (!tosAccepted) {
      Alert.alert('Условия', 'Прежде чем начать пользоваться приложением, нужно согласиться с условиями.');
      setPage(1);
      return;
    }

    // local flag
    completeOnboarding();

    // account flag (used by app/index.tsx gate)
    try {
      const sb = await getSupabase();
      await sb.auth.updateUser({ data: { onboarding_done: true } });
    } catch (e: any) {
      console.warn('[onboarding] updateUser failed', e?.message || e);
    }

    router.replace('/(tabs)/astro-map');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Progress step={page} />

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16 }}>
          {page === 0 && <ScreenUniverse />}
          {page === 1 && <ScreenTOS tos={tos} setTos={handleTosChange} />}
          {page === 2 && <ScreenProfile goProfile={goProfile} goRect={goRect} />}
          {page === 3 && <ScreenFinal />}
        </ScrollView>

        <View style={s.nav}>
          {page > 0 ? (
            <Pressable onPress={prev} style={[s.btn, s.ghost]}>
              <Text style={s.btnText}>Назад</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {page < 3 ? (
            <Pressable
              onPress={next}
              style={[s.btn, s.primary, page === 1 && !tos && { opacity: 0.5 }]}
              disabled={page === 1 && !tos}
            >
              <Text style={[s.btnText, { color: '#fff' }]}>
                {page === 1 ? 'Согласен • Далее' : 'Далее'}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={finish} style={[s.btn, s.primary]}>
              <Text style={[s.btnText, { color: '#fff' }]}>Начать</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ───────────────── Screens ───────────────── */

function ScreenUniverse() {
  return (
    <Card center>
      <Text style={s.huge}>Welcome to Cosmotell</Text>
      <Text style={[s.p, { textAlign: 'center', marginTop: 8 }]}>
        Let's set up your account in a few steps. We'll ask for your birth data to build your natal chart.
      </Text>
    </Card>
  );
}

function ScreenTOS({ tos, setTos }: { tos: boolean; setTos: (v: boolean) => void }) {
  return (
    <Card>
      <Text style={s.h1}>Пользовательское соглашение</Text>
      <Text style={s.p}>
        Используя приложение, ты даёшь согласие на обработку персональных данных и понимаешь, что информация носит
        консультативный характер.
      </Text>
      <Pressable onPress={() => WebBrowser.openBrowserAsync('https://example.com/terms')} style={[s.btn, s.outline]}>
        <Text style={s.btnText}>Открыть полную версию</Text>
      </Pressable>
      <View style={s.tosRow}>
        <Text style={{ color: C.text, flex: 1 }}>Я согласен с условиями</Text>
        <Switch value={tos} onValueChange={setTos} />
      </View>
    </Card>
  );
}

function ScreenProfile({ goProfile, goRect }: { goProfile: () => void; goRect: () => void }) {
  return (
    <Card>
      <Text style={s.h1}>Заполни анкету</Text>
      <Text style={s.p}>Чтобы ответы были точнее, укажи место, дату и время рождения.</Text>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Pressable onPress={goProfile} style={[s.btn, s.primary]}>
          <Text style={[s.btnText, { color: '#fff' }]}>Заполнить анкету</Text>
        </Pressable>
      </View>

      <Text style={[s.p, { color: C.dim, marginTop: 8 }]}>Если не знаешь точное время, пройди ректификацию.</Text>
    </Card>
  );
}

function ScreenFinal() {
  return (
    <Card center>
      <Text style={s.h1}>Добро пожаловать в Cosmotell 🌌</Text>
      <Text style={[s.p, { textAlign: 'center' }]}>
        Всё готово. Начинай пользоваться приложением. Чат учитывает твою карту автоматически.
      </Text>
    </Card>
  );
}

/* ───────────────── Helpers / Styles ───────────────── */

function Progress({ step }: { step: number }) {
  return (
    <View style={s.progressWrap}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[s.progressDot, step >= i && { backgroundColor: C.primary }]} />
      ))}
    </View>
  );
}

function Card({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <View style={[s.card, center && { alignItems: 'center' }]}>{children}</View>;
}

const s = StyleSheet.create({
  progressWrap: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginVertical: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },

  huge: { color: '#fff', fontWeight: '900', fontSize: 26, textAlign: 'center' },
  h1: { color: '#fff', fontWeight: '800', fontSize: 20 },
  p: { color: C.text, fontSize: 14, lineHeight: 20 },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: C.text, fontWeight: '700' },
  primary: { backgroundColor: C.primary, borderColor: C.primary },
  ghost: { backgroundColor: 'transparent' },
  outline: { borderWidth: 1, borderColor: C.primary, backgroundColor: 'transparent' },

  tosRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
