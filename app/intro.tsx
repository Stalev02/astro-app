// app/intro.tsx
import { useApp } from '@/src/store/app';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
};

export default function IntroScreen() {
  const router = useRouter();
  const { introSeen, setIntroSeen } = useApp();

  // Если интро уже было, сразу уходим на логин
  useEffect(() => {
    if (introSeen) {
      router.replace('/auth/login');
    }
  }, [introSeen, router]);

  const onContinue = () => {
    setIntroSeen(true);
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.card}>
        <Text style={s.huge}>UNIVERSE HAS A MESSAGE FOR YOU</Text>
        <Text style={[s.h1, { color: C.dim, marginTop: 8 }]}>Are you ready?</Text>
        <Pressable onPress={onContinue} style={[s.btn, s.primary, { marginTop: 16 }]}>
          <Text style={[s.btnText, { color: '#fff' }]}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    margin: 16,
    gap: 10,
  },
  huge: { color: '#fff', fontWeight: '900', fontSize: 26, textAlign: 'center' },
  h1: { color: '#fff', fontWeight: '800', fontSize: 20, textAlign: 'center' },
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
});
