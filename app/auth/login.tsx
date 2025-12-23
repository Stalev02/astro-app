// app/auth/login.tsx
import { getSupabase } from '@/src/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
};

export default function Login() {
  const router = useRouter();

  const redirectUri = useMemo(
    () => makeRedirectUri({ scheme: 'cosmotell', path: 'auth' }),
    []
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // After OAuth returns (or any auth state change), bounce to the gate.
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const sb = await getSupabase();
        const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            router.replace('/'); // let / (index gate) decide destination
          }
        });
        unsub = () => sub.subscription.unsubscribe();
      } catch {
        // Supabase not configured — ignore.
      }
    })();

    return () => unsub?.();
  }, [router]);

  async function signInEmail() {
    try {
      const em = email.trim().toLowerCase();
      if (!em || !password) return Alert.alert('Вход', 'Заполни email и пароль');

      setLoading(true);

      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email: em, password });
      if (error) throw error;

      // Do not navigate to tabs here — just return to the gate.
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Ошибка входа', e?.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  async function signInWith(provider: 'google' | 'apple') {
    try {
      setLoading(true);

      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUri },
      });
      if (error) throw error;
      // When OAuth completes, onAuthStateChange above will fire and send us to the gate.
    } catch (e: any) {
      Alert.alert('OAuth', e?.message || 'Не удалось войти через провайдера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <Text style={s.h1}>Вход</Text>

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

        <Pressable onPress={signInEmail} disabled={loading} style={[s.btn, s.primary]}>
          <Text style={[s.btnTxt, { color: '#fff' }]}>{loading ? 'Входим…' : 'Войти'}</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Pressable
            onPress={() => signInWith('google')}
            disabled={loading}
            style={[s.btn, s.outline, { flex: 1 }]}
          >
            <Text style={s.btnTxt}>Google</Text>
          </Pressable>
          <Pressable
            onPress={() => signInWith('apple')}
            disabled={loading}
            style={[s.btn, s.outline, { flex: 1 }]}
          >
            <Text style={s.btnTxt}>Apple</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/auth/register')} disabled={loading} style={[s.link]}>
          <Text style={[s.btnTxt, { color: C.dim }]}>Нет аккаунта? Зарегистрируйся</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 10 },
  h1: { color: '#fff', fontWeight: '800', fontSize: 22, marginBottom: 6 },
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
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: C.primary },
  btnTxt: { color: C.text, fontWeight: '700' },
  outline: { borderWidth: 1, borderColor: C.primary, backgroundColor: 'transparent' },
  link: { marginTop: 10, alignItems: 'center' },
});
