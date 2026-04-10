// app/(tabs)/astro-map.tsx
import { useApp } from '@/src/store/app';
import { useProfiles } from '@/src/store/profiles';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

const LABELS = {
  ru: {
    title: 'Моя Астро-Карта',
    loading: 'Строим карту…',
    noProfile: 'Заполни анкету в настройках, чтобы построить карту.',
    error: 'Не удалось загрузить карту',
    retry: 'Потяните вниз, чтобы обновить',
  },
  en: {
    title: 'My Astro Chart',
    loading: 'Building your chart…',
    noProfile: 'Fill in your profile in settings to build your chart.',
    error: 'Failed to load chart',
    retry: 'Pull down to refresh',
  },
};

/* ==================== SVG sanitize ==================== */
function sanitizeSvg(xml: string): string {
  let s = xml;
  const styleBlocks = [...s.matchAll(/<style[\s\S]*?<\/style>/gi)].map((m) => m[0]);
  const themeVars: Record<string, string> = {};
  for (const block of styleBlocks) {
    const varRegex = /--(kerykeion-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = varRegex.exec(block)) !== null) {
      const key = m[1].trim().toLowerCase();
      const raw = m[2].replace(/!important/gi, '').trim();
      themeVars[key] = raw;
    }
  }
  const DEFAULTS: Record<string, string> = {
    'kerykeion-color-black': '#000000',
    'kerykeion-color-white': '#ffffff',
    'kerykeion-color-base-100': '#0b0b0c',
    'kerykeion-color-base-200': '#1a1b1f',
    'kerykeion-color-base-300': '#2a2c31',
    'kerykeion-color-base-content': '#e5e7eb',
    'kerykeion-color-neutral': '#a3a6ae',
    'kerykeion-color-neutral-content': '#cfd2da',
    'kerykeion-color-primary': '#4f46e5',
    'kerykeion-color-secondary': '#6b7280',
    'kerykeion-color-accent': '#22c55e',
    'kerykeion-color-warning': '#f59e0b',
    'kerykeion-color-success': '#22c55e',
    'kerykeion-color-error': '#ef4444',
    'kerykeion-chart-color-paper-0': '#000000',
    'kerykeion-chart-color-paper-1': '#0b0b0c',
  };
  const cache: Record<string, string> = {};
  function resolveVar(value: string, depth = 0): string {
    if (!/var\(--kerykeion-[^)]+\)/i.test(value)) return value;
    if (depth > 10) return value;
    return value.replace(/var\(--(kerykeion-[a-z0-9-]+)\)/gi, (_m, fullKey: string) => {
      const k = fullKey.toLowerCase();
      if (cache[k]) return cache[k];
      let v = themeVars[k] ?? DEFAULTS[k] ?? '#888888';
      if (/var\(--kerykeion-[^)]+\)/i.test(v)) v = resolveVar(v, depth + 1);
      cache[k] = v;
      return v;
    });
  }
  for (const block of styleBlocks) s = s.replace(block, '');
  let guard = 0;
  while (/var\(--kerykeion-[^)]+\)/i.test(s) && guard < 12) {
    s = resolveVar(s);
    guard++;
  }
  s = s.replace(/<\?xml[^>]*\?>/gi, '');
  s = s.replace(/>\s*'\s*</g, '><');
  s = s.replace(/'\s*<\/svg>/g, '</svg>');
  s = s.replace(/\u00A0|\uFEFF/g, ' ');
  return s;
}

/* ==================== Screen ==================== */
export default function AstroMapScreen() {
  const { width } = useWindowDimensions();
  const chartSize = Math.min(width - 32, 360);

  const language = useApp((s) => s.language);
  const t = LABELS[language];

  const deviceId = useProfiles((s) => s.deviceId);
  const me = useProfiles((s) => s.me);
  const chart = useProfiles((s) => s.chart);
  const reloadChart = useProfiles((s) => s.reloadChart);
  const loading = useProfiles((s) => s.loading);
  const error = useProfiles((s) => s.error);

  const [refreshing, setRefreshing] = useState(false);

  // Initial load — attempt up to 5 times with 8s gap while no chart exists
  const attemptsRef = useRef(0);
  useEffect(() => {
    attemptsRef.current = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const attempt = async () => {
      if (cancelled || attemptsRef.current >= 5) return;
      attemptsRef.current++;
      try { await reloadChart(); } catch {}
      if (cancelled) return;
      if (!useProfiles.getState().chart?.chart_svg && attemptsRef.current < 5) {
        timer = setTimeout(attempt, 8000);
      }
    };

    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deviceId, reloadChart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    attemptsRef.current = 0;
    try { await reloadChart(); } catch {}
    setRefreshing(false);
  }, [reloadChart]);

  const chartSvg = chart?.chart_svg ? sanitizeSvg(chart.chart_svg) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
      >
        <Text style={styles.title}>{t.title}</Text>

        <View style={styles.card}>
          {/* Chart area */}
          <View style={[styles.chartWrap, { width: chartSize, height: chartSize }]}>
            {chartSvg ? (
              <SvgXml xml={chartSvg} width="100%" height="100%" />
            ) : (
              <View style={styles.placeholder}>
                {loading ? (
                  <>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.placeholderText}>{t.loading}</Text>
                  </>
                ) : !me ? (
                  <>
                    <Ionicons name="person-circle-outline" size={40} color="#4f46e5" />
                    <Text style={styles.placeholderText}>{t.noProfile}</Text>
                  </>
                ) : error ? (
                  <>
                    <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
                    <Text style={[styles.placeholderText, { color: '#ef4444' }]}>{t.error}</Text>
                    <Text style={[styles.placeholderText, { fontSize: 12, marginTop: 4 }]}>{t.retry}</Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text style={styles.placeholderText}>{t.loading}</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===== Styles ===== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  chartWrap: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  placeholderText: {
    color: '#c7c9d1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
