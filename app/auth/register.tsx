// app/auth/register.tsx
import { getSupabase } from '@/src/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
  err: '#ef4444',
};

export default function Register() {
  const router = useRouter();

  // ВАЖНО: добавь этот redirectUri в Supabase → Auth → Redirect URLs
  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        scheme: 'cosmotell',
        path: 'auth',
      }),
    []
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // Если пользователь вернулся из OAuth и сессия уже есть — идём на онбординг
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const sb = getSupabase();
      const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          router.replace('/onboarding');
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    } catch {
      // Supabase не сконфигурирован — пропускаем
    }
    return () => unsub?.();
  }, [router]);

  async function signUpEmail() {
    try {
      const sb = getSupabase();
      const em = email.trim().toLowerCase();
      if (!em || !password) {
        return Alert.alert('Регистрация', 'Заполни email и пароль');
      }
      if (password.length < 6) {
        return Alert.alert('Пароль', 'Минимум 6 символов');
      }
      if (password !== confirm) {
        return Alert.alert('Пароль', 'Пароли не совпадают');
      }

      setLoading(true);

      // 1) создаём аккаунт
      const { error: e1 } = await sb.auth.signUp({ email: em, password });
      if (e1) throw e1;

      // 2) пробуем сразу войти (если email confirmation ОТКЛЮЧЕН)
      const { error: e2 } = await sb.auth.signInWithPassword({
        email: em,
        password,
      });
      if (!e2) {
        // вошли успешно → сразу на онбординг
        router.replace('/onboarding');
        return;
      }

      // если требуется подтверждение почты — просим подтвердить и возвращаемся
      Alert.alert(
        'Подтверди почту',
        'Мы отправили письмо. После подтверждения войди в приложении.'
      );
      router.back();
    } catch (e: any) {
      Alert.alert(
        'Ошибка регистрации',
        e?.message || 'Не удалось создать аккаунт'
      );
    } finally {
      setLoading(false);
    }
  }

  async function signUpWith(provider: 'google' | 'apple') {
    try {
      const sb = getSupabase();
      setLoading(true);
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUri },
      });
      if (error) throw error;
      // После возврата SDK сохранит сессию, а onAuthStateChange переведёт на онбординг
    } catch (e: any) {
      Alert.alert('OAuth', e?.message || 'Не удалось войти через провайдера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <Text style={s.h1}>Регистрация</Text>

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
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            // iOS: корректная роль поля "новый пароль" без навязчивой плашки
            textContentType="newPassword"
            // Если у какого-то устройства всё ещё всплывает «Automatic Strong Password» и мешает вводу,
            // раскомментируй следующую строку — она полностью отключает подсказку (iOS-хак):
            // textContentType="oneTimeCode"
            placeholder="••••••••"
            placeholderTextColor="#8b8e97"
            style={s.input}
          />
        </View>

        <View style={s.row}>
          <Text style={s.label}>Повтори пароль</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="newPassword"
            // Альтернатива для проблемных устройств (см. комментарий выше):
            // textContentType="oneTimeCode"
            placeholder="••••••••"
            placeholderTextColor="#8b8e97"
            style={s.input}
          />
        </View>

        <Pressable
          onPress={signUpEmail}
          disabled={loading}
          style={[s.btn, s.primary]}
        >
          <Text style={[s.btnTxt, { color: '#fff' }]}>
            {loading ? 'Создаём…' : 'Зарегистрироваться'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Pressable
            onPress={() => signUpWith('google')}
            disabled={loading}
            style={[s.btn, s.outline, { flex: 1 }]}
          >
            <Text style={s.btnTxt}>Google</Text>
          </Pressable>
          <Pressable
            onPress={() => signUpWith('apple')}
            disabled={loading}
            style={[s.btn, s.outline, { flex: 1 }]}
          >
            <Text style={s.btnTxt}>Apple</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.back()}
          disabled={loading}
          style={[s.link]}
        >
          <Text style={[s.btnTxt, { color: C.dim }]}>
            Уже есть аккаунт? Войти
          </Text>
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
  outline: {
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: 'transparent',
  },
  link: { marginTop: 10, alignItems: 'center' },
});
