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

const features = [
  { icon: '🌌', label: 'Personal natal chart built from your birth data' },
  { icon: '🤖', label: 'AI astrologer that knows your chart' },
  { icon: '🔮', label: 'Compatibility, forecasts & planetary transits' },
];

export default function IntroScreen() {
  const router = useRouter();
  const { introSeen, setIntroSeen } = useApp();

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
      <View style={s.wrap}>
        <View style={s.card}>
          <Text style={s.brand}>COSMOTELL</Text>
          <Text style={s.tagline}>Your personal AI astrologer</Text>

          <View style={s.featureList}>
            {features.map((f) => (
              <View key={f.icon} style={s.featureRow}>
                <Text style={s.featureIcon}>{f.icon}</Text>
                <Text style={s.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={onContinue} style={[s.btn, s.primary]}>
            <Text style={[s.btnText, { color: '#fff' }]}>Get started</Text>
          </Pressable>
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
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  brand: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 32,
    letterSpacing: 4,
    textAlign: 'center',
  },
  tagline: {
    color: C.dim,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  featureList: { width: '100%', gap: 12, marginVertical: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 22 },
  featureLabel: { color: C.text, fontSize: 15, flex: 1 },
  btn: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: C.text, fontWeight: '700', fontSize: 16 },
  primary: { backgroundColor: C.primary, borderColor: C.primary },
});
