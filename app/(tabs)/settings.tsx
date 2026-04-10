// app/(tabs)/settings.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';


const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
};

const LABELS = {
  ru: {
    title: 'Настройки',
    forms: 'Анкеты',
    myForm: 'Изменить мою анкету',
    partnerForm: 'Анкета партнёра',
    account: 'Аккаунт',
    language: 'Язык / Language',
    logout: 'Выйти',
    logoutHint: 'Выход удалит текущую сессию на этом устройстве.',
  },
  en: {
    title: 'Settings',
    forms: 'Profiles',
    myForm: 'Edit my profile',
    partnerForm: 'Partner profile',
    account: 'Account',
    language: 'Язык / Language',
    logout: 'Log out',
    logoutHint: 'Logging out will end your session on this device.',
  },
};

export default function SettingsScreen() {
  const router = useRouter();
  const language = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  const t = LABELS[language];

  async function logout() {
    try {
      const sb = await getSupabase();
      await sb.auth.signOut();
    } catch (e: any) {
      console.warn('[logout]', e?.message || e);
    } finally {
      try {
        await AsyncStorage.removeItem('profiles-store');
      } catch {}

      router.replace('/');
    }
  }

  function openMyForm() {
    router.push({ pathname: '/modal', params: { mode: 'me' } });
  }

  function openPartnerForm() {
    router.push({ pathname: '/modal', params: { mode: 'other' } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.wrap}>
        <Text style={s.title}>{t.title}</Text>

        {/* Анкеты */}
        <View style={s.card}>
          <Text style={s.section}>{t.forms}</Text>

          <Pressable onPress={openMyForm} style={[s.btn, s.btnRow]}>
            <Ionicons name="person-circle-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>{t.myForm}</Text>
          </Pressable>

          <Pressable onPress={openPartnerForm} style={[s.btn, s.btnRow]}>
            <Ionicons name="people-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>{t.partnerForm}</Text>
          </Pressable>
        </View>

        {/* Язык */}
        <View style={s.card}>
          <Text style={s.section}>{t.language}</Text>
          <View style={s.langRow}>
            <Pressable
              onPress={() => setLanguage('ru')}
              style={[s.langBtn, language === 'ru' && s.langActive]}
            >
              <Text style={[s.langTxt, language === 'ru' && s.langActiveTxt]}>🇷🇺  Русский</Text>
            </Pressable>
            <Pressable
              onPress={() => setLanguage('en')}
              style={[s.langBtn, language === 'en' && s.langActive]}
            >
              <Text style={[s.langTxt, language === 'en' && s.langActiveTxt]}>🇬🇧  English</Text>
            </Pressable>
          </View>
        </View>

        {/* Аккаунт */}
        <View style={s.card}>
          <Text style={s.section}>{t.account}</Text>
          <Pressable onPress={logout} accessibilityRole="button" style={[s.btn, s.btnRow, s.danger]}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>{t.logout}</Text>
          </Pressable>
          <Text style={s.hint}>{t.logoutHint}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}


const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  section: { color: '#cfd2da', fontSize: 13, fontWeight: '700' },

  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.border,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnTxt: { color: '#fff', fontWeight: '700' },

  danger: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  hint: { color: C.dim, fontSize: 12, marginTop: 4 },

  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  langActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  langTxt: { color: C.dim, fontWeight: '700' },
  langActiveTxt: { color: '#fff' },
});
