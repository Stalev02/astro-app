// app/auth/login.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

const C = {
  bg: '#0b0b0c', card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb', dim: '#c7c9d1', primary: '#4f46e5'
};

(async () => {
  try {
    const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    console.log("➡️ auth health:", base + "/auth/v1/health");
    const r = await fetch(base + "/auth/v1/health");
    console.log("✅ auth health:", r.status, await r.text());
  } catch (e: any) {
    console.log("❌ auth health failed:", e?.message || e);
  }
})();

// ------- deep network probes (temporary) -------
(async () => {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const logErr = (tag: string, e: any) =>
    console.log(tag, e?.message || e, e?.name || '', e?.stack ? String(e.stack).slice(0, 300) : '');

  try {
    // 0) Print exactly what we use
    console.log('🧭 SUPABASE', { base, anon_present: !!anon, anon_prefix: anon?.slice(0, 6) });

    // 1) Generic HTTPS reachability (should ALWAYS succeed)
    try {
      const r = await fetch('https://httpbin.org/get');
      console.log('✅ httpbin', r.status);
    } catch (e) {
      logErr('❌ httpbin', e);
    }

    // 2) Your Supabase /auth/v1/health (simple GET)
    try {
      const r = await fetch(base + '/auth/v1/health');
      console.log('✅ supabase health', r.status, await r.text());
    } catch (e) {
      logErr('❌ supabase health', e);
    }

    // 3) DNS probe via Google DNS-over-HTTPS for your exact host (no CORS in RN)
    try {
      const host = new URL(base).host;
      const r = await fetch('https://dns.google/resolve?name=' + host + '&type=A');
      console.log('✅ dns doh', r.status, await r.text());
    } catch (e) {
      logErr('❌ dns doh', e);
    }

    // 4) Raw password grant (POST) without SDK — proves auth path openness
    //    Use a known test email/password that exists in your Supabase project.
    try {
      const r = await fetch(base + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': anon,
          'Authorization': `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'not-the-real-pass' }),
      });
      const body = await r.text();
      console.log('🧪 raw login status', r.status, body.slice(0, 200));
    } catch (e) {
      logErr('❌ raw login', e);
    }
  } catch (e) {
    logErr('❌ probes crashed', e);
  }
})();


export default function Login() {
  const router = useRouter();
  const { onboardingDone } = useApp();

  const redirectUri = useMemo(
    () => makeRedirectUri({ scheme: 'cosmotell', path: 'auth' }),
    []
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // если сессия уже есть — отправляем дальше по флоу
  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const sb = getSupabase();
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          router.replace(onboardingDone ? '/(tabs)/astro' : '/onboarding');
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    } catch {
      // supabase не сконфигурирован — пропускаем
    }
    return () => unsub?.();
  }, [router, onboardingDone]);

  async function signInEmail() {
    try {
      const sb = getSupabase();
      const em = email.trim().toLowerCase();
      if (!em || !password) return Alert.alert('Вход', 'Заполни email и пароль');
      setLoading(true);
      const { error } = await sb.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      // подстраховка, если событие не сработало
      router.replace(onboardingDone ? '/(tabs)/astro' : '/onboarding');
    } catch (e: any) {
      Alert.alert('Ошибка входа', e?.message || 'Не удалось войти');
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
      // после возврата SDK сохранит сессию, а onAuthStateChange отработает
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
          <Pressable onPress={() => signInWith('google')} disabled={loading} style={[s.btn, s.outline, { flex: 1 }]}>
            <Text style={s.btnTxt}>Google</Text>
          </Pressable>
          <Pressable onPress={() => signInWith('apple')} disabled={loading} style={[s.btn, s.outline, { flex: 1 }]}>
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
