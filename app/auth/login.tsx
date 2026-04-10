// app/auth/login.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useT } from '@/src/shared/i18n';
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
  const t = useT();

  const redirectUri = useMemo(
    () => makeRedirectUri({ scheme: 'cosmotell', path: 'auth' }),
    []
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const sb = await getSupabase();
        const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            (async () => {
              const uid = session.user.id;
              useProfiles.getState().applyAuthUser(uid);
              await useProfiles.getState().loadMeFromServer();
              router.replace('/');
            })().catch((e) => console.error('[auth] onAuthStateChange handler failed:', e));
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
      if (!em || !password) return Alert.alert(t.auth.alertLogin, t.auth.fillEmailPassword);

      setLoading(true);

      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email: em, password });
      if (error) throw error;

      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;

      if (uid) {
        useProfiles.getState().applyAuthUser(uid);
        await useProfiles.getState().loadMeFromServer();
      }

      router.replace('/');
    } catch (e: any) {
      Alert.alert(t.auth.loginError, e?.message || t.auth.loginFailed);
    } finally {
      setLoading(false);
    }
  }

  async function signUpEmail() {
    try {
      const em = email.trim().toLowerCase();
      if (!em || !password) return Alert.alert(t.auth.alertRegister, t.auth.fillEmailPassword);
      if (password.length < 6) return Alert.alert(t.auth.alertPassword, t.auth.passwordMin);
      if (password !== confirm) return Alert.alert(t.auth.alertPassword, t.auth.passwordMismatch);

      setLoading(true);
      const sb = await getSupabase();

      const { error: e1 } = await sb.auth.signUp({ email: em, password });
      if (e1) throw e1;

      const { error: e2 } = await sb.auth.signInWithPassword({ email: em, password });
      if (!e2) {
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user?.id;

        if (uid) {
          useProfiles.getState().applyAuthUser(uid);
          await useProfiles.getState().loadMeFromServer();
        }

        setCreating(false);
        router.replace('/');
        return;
      }

      Alert.alert(t.auth.confirmEmail, t.auth.confirmEmailMsg);
      setCreating(false);
    } catch (e: any) {
      Alert.alert(t.auth.registerError, e?.message || t.auth.registerFailed);
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
    } catch (e: any) {
      Alert.alert('OAuth', e?.message || t.auth.oauthError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <View style={s.card}>
          <Text style={s.h1}>{creating ? t.auth.titleRegister : t.auth.titleLogin}</Text>

          <View style={s.row}>
            <Text style={s.label}>{t.auth.email}</Text>
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
            <Text style={s.label}>{t.auth.password}</Text>
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
              <Text style={s.label}>{t.auth.confirmPassword}</Text>
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
                {loading ? t.auth.signingUp : t.auth.signUp}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={signInEmail} disabled={loading} style={[s.btn, s.primary]}>
              <Text style={[s.btnText, { color: '#fff' }]}>{loading ? t.auth.signingIn : t.auth.signIn}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setCreating((v) => !v)}
            disabled={loading}
            style={[s.btn, s.ghost]}
          >
            <Text style={s.btnText}>{creating ? t.auth.haveAccount : t.auth.createAccount}</Text>
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

          <Text style={[s.p, { color: C.dim, fontSize: 12 }]}>{t.auth.disclaimer}</Text>
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
