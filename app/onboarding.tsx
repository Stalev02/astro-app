// app/onboarding.tsx
import { getSupabase } from '@/src/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
  ok: '#22c55e',
  warn: '#f59e0b',
  err: '#ef4444',
};

export default function Onboarding() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [tos, setTos] = useState(false);

  const next = () => setPage((p) => Math.min(4, p + 1));
  const prev = () => setPage((p) => Math.max(0, p - 1));

  const goProfile = () => router.push('/onboarding-profile');
  const goRect = () => router.push('/(tabs)/rectification');
  const finish = () => router.replace('/(tabs)/astro');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Progress step={page} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 16 }}>
          {page === 0 && <ScreenUniverse onNext={next} />}
          {page === 1 && <ScreenAuth onNext={next} />}
          {page === 2 && <ScreenTOS tos={tos} setTos={setTos} />}
          {page === 3 && <ScreenProfile goProfile={goProfile} goRect={goRect} />}
          {page === 4 && <ScreenFinal onStart={finish} />}
        </ScrollView>

        <View style={s.nav}>
          {page > 0 ? (
            <Pressable onPress={prev} style={[s.btn, s.ghost]}><Text style={s.btnText}>Назад</Text></Pressable>
          ) : <View />}

          {page < 4 ? (
            <Pressable
              onPress={next}
              style={[s.btn, s.primary, page === 2 && !tos && { opacity: 0.5 }]}
              disabled={page === 2 && !tos}
            >
              <Text style={[s.btnText, { color: '#fff' }]}>
                {page === 2 ? 'Согласен • Далее' : 'Далее'}
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

function ScreenUniverse({ onNext }: { onNext: () => void }) {
  return (
    <Card center>
      <Text style={s.huge}>UNIVERSE HAS A MESSAGE FOR YOU</Text>
      <Text style={[s.h1, { color: C.dim, marginTop: 8 }]}>Are you ready?</Text>
      <Pressable onPress={onNext} style={[s.btn, s.primary, { marginTop: 16 }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>Continue</Text>
      </Pressable>
    </Card>
  );
}

function ScreenAuth({ onNext }: { onNext: () => void }) {
  return (
    <Card>
      <Text style={s.h1}>Создай аккаунт или войди</Text>
      <LoginForm onSuccess={onNext} />
    </Card>
  );
}

function ScreenTOS({ tos, setTos }: { tos: boolean; setTos: (v: boolean) => void }) {
  return (
    <Card>
      <Text style={s.h1}>Пользовательское соглашение</Text>
      <Text style={s.p}>
        Используя приложение, ты даёшь согласие на обработку персональных данных
        и понимаешь, что информация носит консультативный характер.
      </Text>
      <Pressable
        onPress={() => WebBrowser.openBrowserAsync('https://example.com/terms')}
        style={[s.btn, s.outline]}
      >
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
        <Pressable onPress={goRect} style={[s.btn, s.ghost]}>
          <Text style={s.btnText}>Ректификация</Text>
        </Pressable>
      </View>
      <Text style={[s.p, { color: C.dim, marginTop: 8 }]}>Если не знаешь точное время — пройди ректификацию.</Text>
    </Card>
  );
}

function ScreenFinal({ onStart }: { onStart: () => void }) {
  return (
    <Card center>
      <Text style={s.h1}>Добро пожаловать в Cosmotell 🌌</Text>
      <Text style={[s.p, { textAlign: 'center' }]}>
        Всё готово — начинай пользоваться приложением. Чат учитывает твою карту автоматически.
      </Text>
      <Pressable onPress={onStart} style={[s.btn, s.primary, { marginTop: 12 }]}>
        <Text style={[s.btnText, { color: '#fff' }]}>Начать</Text>
      </Pressable>
    </Card>
  );
}

/* ───────────────── Login form ───────────────── */

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const router = useRouter();
  const redirectUri = useMemo(() => makeRedirectUri({ scheme: 'cosmotell', path: 'auth' }), []);
  console.log('[auth] redirectUri =', redirectUri);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInEmail() {
    try {
      const sb = getSupabase();
      const em = email.trim().toLowerCase();
      if (!em || !password) return Alert.alert('Вход', 'Заполни email и пароль');
      setLoading(true);
      const { error } = await sb.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      onSuccess();
    } catch (e: any) {
      Alert.alert('Ошибка входа', e.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  async function signInWith(provider: 'google' | 'apple') {
    try {
      const sb = getSupabase();
      setLoading(true);
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUri },
      });
      if (error) throw error;
      // после возврата SDK сохранит сессию
    } catch (e: any) {
      Alert.alert('OAuth', e.message || 'Не удалось войти через провайдера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.row}>
        <Text style={s.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@email.com"
          placeholderTextColor="#8b8e97"
          style={s.input}
        />
      </View>
      <View style={s.row}>
        <Text style={s.label}>Пароль</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#8b8e97"
          style={s.input}
        />
      </View>

      {/* Войти */}
      <Pressable onPress={signInEmail} disabled={loading} style={[s.btn, s.primary]}>
        <Text style={[s.btnText, { color: '#fff' }]}>{loading ? 'Входим…' : 'Войти'}</Text>
      </Pressable>

      {/* Регистрация — отдельный экран */}
      <Pressable onPress={() => router.push('/auth/register')} disabled={loading} style={[s.btn, s.ghost]}>
        <Text style={s.btnText}>Зарегистрироваться</Text>
      </Pressable>

      {/* Соц-входы */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => signInWith('google')} disabled={loading} style={[s.btn, s.outline, { flex: 1 }]}>
          <Text style={s.btnText}>Войти через Google</Text>
        </Pressable>
        <Pressable onPress={() => signInWith('apple')} disabled={loading} style={[s.btn, s.outline, { flex: 1 }]}>
          <Text style={s.btnText}>Войти через Apple</Text>
        </Pressable>
      </View>

      <Text style={[s.p, { color: C.dim, fontSize: 12 }]}>
        Мы не публикуем ничего и не используем почту для рассылок.
      </Text>
    </View>
  );
}

/* ───────────────── UI helpers ───────────────── */

function Progress({ step }: { step: number }) {
  return (
    <View style={s.progressWrap}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.progressDot, step >= i && { backgroundColor: C.primary }]} />
      ))}
    </View>
  );
}

function Card({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <View style={[s.card, center && { alignItems: 'center' }]}>{children}</View>;
}

const s = StyleSheet.create({
  progressWrap: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 6 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },

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

  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },

  row: { gap: 6 },
  label: { color: C.dim, fontSize: 13 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
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
