// app/auth/login.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useProfiles } from '@/src/store/profiles';
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
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // If auth state changes to signed in, go to the gate
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const sb = await getSupabase();
        const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    useProfiles.getState().applyAuthUser(session.user.id);
    router.replace('/');
  }
});

        unsub = () => sub.subscription.unsubscribe();
      } catch {
        // ignore
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

      router.replace('/');
    } catch (e: any) {
      Alert.alert('Ошибка входа', e?.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  async function signUpEmail() {
    try {
      const em = email.trim().toLowerCase();
      if (!em || !password) return Alert.alert('Регистрация', 'Заполни email и пароль');
      if (password.length < 6) return Alert.alert('Пароль', 'Минимум 6 символов');
      if (password !== confirm) return Alert.alert('Пароль', 'Пароли не совпадают');

      setLoading(true);
      const sb = await getSupabase();

      const { error: e1 } = await sb.auth.signUp({ email: em, password });
      if (e1) throw e1;

      // Try immediate sign-in (works when email confirmation is off)
      const { error: e2 } = await sb.auth.signInWithPassword({ email: em, password });
if (!e2) {
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id;

  if (uid) {
    useProfiles.getState().applyAuthUser(uid);
  }

  router.replace('/');
  return;
}


      Alert.alert('Подтверди почту', 'Мы отправили письмо. После подтверждения войди в приложении.');
      setCreating(false);
    } catch (e: any) {
      Alert.alert('Ошибка регистрации', e?.message || 'Не удалось создать аккаунт');
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

      // onAuthStateChange will route to '/'
    } catch (e: any) {
      Alert.alert('OAuth', e?.message || 'Не удалось войти через провайдера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <View style={s.card}>
          <Text style={s.h1}>{creating ? 'Регистрация' : 'Вход'}</Text>

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

          {creating && (
            <View style={s.row}>
              <Text style={s.label}>Повтори пароль</Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor="#8b8e97"
                style={s.input}
              />
            </View>
          )}

          {creating ? (
            <Pressable onPress={signUpEmail} disabled={loading} style={[s.btn, s.primary]}>
              <Text style={[s.btnText, { color: '#fff' }]}>
                {loading ? 'Создаём…' : 'Зарегистрироваться'}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={signInEmail} disabled={loading} style={[s.btn, s.primary]}>
              <Text style={[s.btnText, { color: '#fff' }]}>{loading ? 'Входим…' : 'Войти'}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setCreating((v) => !v)}
            disabled={loading}
            style={[s.btn, s.ghost]}
          >
            <Text style={s.btnText}>{creating ? 'У меня уже есть аккаунт' : 'Создать аккаунт'}</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => signInWith('google')}
              disabled={loading}
              style={[s.btn, s.outline, { flex: 1 }]}
            >
              <Text style={s.btnText}>Google</Text>
            </Pressable>
            <Pressable
              onPress={() => signInWith('apple')}
              disabled={loading}
              style={[s.btn, s.outline, { flex: 1 }]}
            >
              <Text style={s.btnText}>Apple</Text>
            </Pressable>
          </View>

          <Text style={[s.p, { color: C.dim, fontSize: 12 }]}>
            Мы не публикуем ничего и не используем почту для рассылок.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, justifyContent: 'center' },

  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },

  h1: { color: '#fff', fontWeight: '800', fontSize: 20 },
  p: { color: C.text, fontSize: 14, lineHeight: 20 },

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
});
