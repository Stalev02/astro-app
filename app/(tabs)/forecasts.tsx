// app/(tabs)/forecasts.tsx
import { addDays, format, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    VictoryAxis,
    VictoryChart,
    VictoryScatter,
    VictoryTooltip,
    VictoryVoronoiContainer,
} from 'victory-native';

/** ---------- Мок-движок (детерминированный) ---------- */
type Influence = 'positive' | 'challenge' | 'transformative';
type TransitEvent = { id: string; date: Date; title: string; influence: Influence; intensity: number };

function seededRandom(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function genTransits(rangeStart: Date, rangeEnd: Date): TransitEvent[] {
  const seed = `${rangeStart.toISOString().slice(0,10)}-${rangeEnd.toISOString().slice(0,10)}`;
  const rnd = seededRandom(seed);
  const days = Math.max(1, Math.ceil((+rangeEnd - +rangeStart)/86400000));
  const names = ['Сильная энергия','Вдохновение','Испытание','Рост','Переоценка','Новый цикл'];
  const out: TransitEvent[] = [];
  for (let i = 0; i < days; i++) {
    if (rnd() > 0.45) {
      const infPick = rnd();
      const influence: Influence = infPick > 0.7 ? 'positive' : infPick < 0.3 ? 'challenge' : 'transformative';
      out.push({
        id: `t-${i}`,
        date: addDays(rangeStart, i),
        title: names[Math.floor(rnd()*names.length)],
        influence,
        intensity: Math.round(rnd()*100)/100,
      });
    }
  }
  return out;
}

/** ---------- Цвета ---------- */
const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  pos: '#22c55e',
  neg: '#ef4444',
  trn: '#f59e0b',
  primary: '#4f46e5',
};

type PeriodKey = 'week' | 'month' | 'year' | 'custom';

export default function ForecastsScreen() {
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [custom, setCustom] = useState<{ from: Date; to: Date } | null>(null);
  const today = startOfDay(new Date());

  const range = useMemo(() => {
    switch (period) {
      case 'week':  return { from: today, to: addDays(today, 7) };
      case 'month': return { from: today, to: addDays(today, 30) };
      case 'year':  return { from: today, to: addDays(today, 365) };
      case 'custom': return custom ?? { from: today, to: addDays(today, 14) };
    }
  }, [period, custom]);

  const events = useMemo(() => genTransits(range.from, range.to), [range.from, range.to]);

  const scatterData = events.map(e => ({
    x: e.date, y: e.intensity,
    label: `${format(e.date, 'd MMM', { locale: ru })}\n${e.title}`,
    _color: e.influence === 'positive' ? C.pos : e.influence === 'challenge' ? C.neg : C.trn,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <>
            <Text style={s.title}>Прогнозы и транзиты</Text>

            {/* Периоды */}
            <View style={s.tabsRow}>
              <TabBtn text="Неделя" active={period==='week'} onPress={()=>setPeriod('week')} />
              <TabBtn text="Месяц" active={period==='month'} onPress={()=>setPeriod('month')} />
              <TabBtn text="Год" active={period==='year'} onPress={()=>setPeriod('year')} />
              <TabBtn text="Свой период" active={period==='custom'} onPress={()=>{
                setPeriod('custom');
                Alert.alert('Свой период', 'Пока заглушка: установлены 2 недели от сегодня.');
                setCustom({ from: today, to: addDays(today, 14) });
              }} />
              <Pressable onPress={()=>setPeriod('week')} style={[s.todayBtn]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Сегодня</Text>
              </Pressable>
            </View>

            {/* Диапазон дат */}
            <Text style={s.rangeText}>
              {format(range.from,'d MMM yyyy', { locale: ru })} — {format(range.to,'d MMM yyyy', { locale: ru })}
            </Text>

            {/* Легенда */}
            <View style={s.legend}>
              <Dot color={C.pos} label="Позитив" />
              <Dot color={C.neg} label="Вызов" />
              <Dot color={C.trn} label="Трансформация" />
            </View>

            {/* График */}
            <View style={s.card}>
              <VictoryChart
                height={240}
                padding={{ top: 10, bottom: 40, left: 40, right: 16 }}
                containerComponent={<VictoryVoronoiContainer />}
                domain={{ y: [0, 1] }}
              >
                <VictoryAxis
                  tickFormat={(t) => format(new Date(t), 'd MMM', { locale: ru })}
                  style={{
                    axis: { stroke: C.border },
                    tickLabels: { fill: C.dim, fontSize: 10 },
                    ticks: { stroke: C.border },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickFormat={(t) => `${Math.round(t*100)}%`}
                  style={{
                    axis: { stroke: C.border },
                    tickLabels: { fill: C.dim, fontSize: 10 },
                    grid: { stroke: 'rgba(255,255,255,0.08)' },
                  }}
                />
                <VictoryScatter
                  data={scatterData}
                  size={({ datum }) => 4 + datum.y * 6}
                  style={{ data: { fill: ({ datum }: any) => datum._color } }}
                  labels={({ datum }) => datum.label}
                  labelComponent={
                    <VictoryTooltip
                      flyoutStyle={{ fill: 'rgba(0,0,0,0.8)', stroke: C.border }}
                      style={{ fill: '#fff', fontSize: 10 }}
                    />
                  }
                />
              </VictoryChart>
            </View>

            {/* Краткая сводка */}
            <View style={{ gap: 10, marginTop: 10 }}>
              <Summary title="Основные темы периода">
                <Text style={s.p}>Энергия обновления, переоценка целей, усиление внимания к коммуникациям.</Text>
              </Summary>
              <Summary title="Пики влияний (3–5 дат)">
                {events.slice(0, 4).map(e => (
                  <Text key={e.id} style={s.p}>
                    • {format(e.date,'d MMM', { locale: ru })} — {e.title} ({humanInfluence(e.influence)})
                  </Text>
                ))}
              </Summary>
            </View>

            <Text style={[s.title, { marginTop: 14 }]}>События периода</Text>
          </>
        }
        data={events}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <EventRow e={item} />}
      />
    </SafeAreaView>
  );
}

/** ---------- UI bits ---------- */
function humanInfluence(i: Influence) {
  return i === 'positive' ? 'позитив' : i === 'challenge' ? 'вызов' : 'трансформация';
}

function TabBtn({ text, active, onPress }: { text: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.tab, active && s.tabActive]}>
      <Text style={[s.tabText, active && { color: '#fff' }]}>{text}</Text>
    </Pressable>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: C.text }}>{label}</Text>
    </View>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function EventRow({ e }: { e: TransitEvent }) {
  const color = e.influence === 'positive' ? C.pos : e.influence === 'challenge' ? C.neg : C.trn;
  return (
    <View style={s.row}>
      <View style={[s.badge, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{format(e.date, 'd MMM yyyy', { locale: ru })} — {e.title}</Text>
        <Text style={s.rowSub}>Интенсивность: {Math.round(e.intensity*100)}% • {humanInfluence(e.influence)}</Text>
      </View>
    </View>
  );
}

/** ---------- styles ---------- */
const s = StyleSheet.create({
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  p: { color: C.text, fontSize: 14, lineHeight: 20 },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { color: C.text, fontWeight: '600' },

  todayBtn: { marginLeft: 'auto', backgroundColor: C.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },

  rangeText: { color: C.dim, marginBottom: 8 },

  legend: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 8 },

  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 12 },

  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomColor: C.border, borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { width: 6, height: 24, borderRadius: 3 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.dim, fontSize: 13 },
});
