// app/(tabs)/settings.tsx
import { getSupabase } from '@/src/lib/supabase';
import { useApp } from '@/src/store/app';
import { Ionicons } from '@expo/vector-icons';
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

export default function SettingsScreen() {
  const router = useRouter();
  const { testMode, disableTestMode } = useApp();

  async function logout() {
    try {
      const sb = getSupabase();      // если .env настроен
      await sb.auth.signOut();       // очищаем сессию Supabase
    } catch (e: any) {
      // если Supabase не сконфигурирован — просто идём на экран логина
      console.warn('[logout]', e?.message || e);
    } finally {
      router.replace('/auth/login'); // гарантированно возвращаем на "Вход"
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
        <Text style={s.title}>Настройки</Text>
        {testMode && (
          <View style={[s.card, { borderColor: '#4f46e5' }]}>
            <Text style={[s.section, { color: '#cfd2da' }]}>Тест-режим включен</Text>
            <Pressable onPress={() => disableTestMode()} style={[s.btn, s.btnRow]}>
              <Ionicons name="flask-outline" size={18} color="#fff" />
              <Text style={s.btnTxt}>Выключить тест-режим</Text>
            </Pressable>
          </View>
        )}

        {/* Анкеты */}
        <View style={s.card}>
          <Text style={s.section}>Анкеты</Text>

          <Pressable onPress={openMyForm} style={[s.btn, s.btnRow]}>
            <Ionicons name="person-circle-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>Изменить мою анкету</Text>
          </Pressable>

          <Pressable onPress={openPartnerForm} style={[s.btn, s.btnRow]}>
            <Ionicons name="people-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>Анкета партнёра</Text>
          </Pressable>
        </View>

        {/* Аккаунт */}
        <View style={s.card}>
          <Text style={s.section}>Аккаунт</Text>
          <Pressable onPress={logout} accessibilityRole="button" style={[s.btn, s.danger]}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={s.btnTxt}>Выйти</Text>
          </Pressable>
          <Text style={s.hint}>Выход удалит текущую сессию на этом устройстве.</Text>
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
  hint: { color: C.dim, fontSize: 12, marginTop: 6 },
});