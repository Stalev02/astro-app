// app/(tabs)/astro-map.tsx
import { useProfiles } from '@/src/store/profiles';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

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

/* ==================== Mock stats ==================== */
function useMockStats() {
  return useMemo(
    () => ({
      sun: 'Солнце: Лев 17°',
      moon: 'Луна: Телец 25°',
      asc: 'Асцендент: Скорпион 10°',
      elements: { fire: 4, earth: 3, air: 2, water: 5 },
      modalities: { cardinal: 3, fixed: 5, mutable: 6 },
      aspects: { harmonious: 7, tense: 4, total: 11 },
    }),
    []
  );
}

/* ==================== Screen ==================== */
export default function AstroMapScreen() {
  const { width } = useWindowDimensions();
  const chartSize = Math.min(width - 32, 360);
  const stats = useMockStats();

  const deviceId = useProfiles((s) => s.deviceId);
  const chart = useProfiles((s) => s.chart);
  const reloadChart = useProfiles((s) => s.reloadChart);
  const loading = useProfiles((s) => s.loading);

  const chartSvg = useMemo(
    () => (chart?.chart_svg ? sanitizeSvg(chart.chart_svg) : null),
    [chart?.chart_svg]
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const tick = async () => {
      try {
        await reloadChart();
      } catch {}
      if (cancelled) return;
      const has = !!useProfiles.getState().chart?.chart_svg;
      timer = setTimeout(tick, has ? 15000 : 4000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deviceId, reloadChart]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <Text style={styles.title}>Моя Астро-Карта</Text>

        <View style={styles.card}>
          <View style={[styles.chartWrap, { width: chartSize, height: chartSize }]}>
            {chartSvg ? (
              <SvgXml xml={chartSvg} width="100%" height="100%" />
            ) : (
              <Image
                source={{
                  uri: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Astrological_chart_-_natal_chart_example.png',
                }}
                resizeMode="contain"
                style={{ width: '100%', height: '100%', opacity: loading ? 0.5 : 0.35 }}
                accessible
                accessibilityLabel="Заглушка: карта готовится"
              />
            )}
          </View>

          <View style={styles.row}>
            <Pill icon="sunny-outline" label={stats.sun} />
            <Pill icon="moon-outline" label={stats.moon} />
          </View>
          <View style={styles.row}>
            <Pill icon="compass-outline" label={stats.asc} />
            <Pill
              icon="star-outline"
              label={`Аспекты: ${stats.aspects.harmonious} / ${stats.aspects.tense}`}
            />
          </View>

          <Section title="Баланс стихий">
            <Bar label="Огонь" value={stats.elements.fire} max={8} />
            <Bar label="Земля" value={stats.elements.earth} max={8} />
            <Bar label="Воздух" value={stats.elements.air} max={8} />
            <Bar label="Вода" value={stats.elements.water} max={8} />
          </Section>

          <Section title="Модальности">
            <Bar label="Кардинальный" value={stats.modalities.cardinal} max={8} />
            <Bar label="Фиксированный" value={stats.modalities.fixed} max={8} />
            <Bar label="Мутабельный" value={stats.modalities.mutable} max={8} />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ===== UI helpers ===== */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}
function Pill({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={16} color="#4f46e5" />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View accessible accessibilityLabel={`${label} ${Math.round(pct * 100)} процентов`}>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
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
  },
  chartWrap: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  pillText: { color: '#e5e7eb', fontSize: 13 },
  sectionTitle: { color: '#c7c9d1', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { color: '#d1d5db', fontSize: 13 },
  barValue: { color: '#9ca3af', fontSize: 13 },
  barTrack: { height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 8, backgroundColor: '#4f46e5' },
});
