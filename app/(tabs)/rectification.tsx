// app/(tabs)/rectification.tsx
import React, { useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
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
  pos: '#22c55e',
  warn: '#f59e0b',
};

type EventItem = { id: string; date: string; kind: string };

// -------- Mock scoring engine (эвристика) --------
// Мы делим сутки на 24 слота по часу и держим баллы по каждому.
type Scores = number[]; // length 24

function emptyScores(): Scores { return new Array(24).fill(0); }

function addScoreRange(scores: Scores, fromHour: number, toHour: number, weight = 1) {
  for (let h = fromHour; h <= toHour; h++) scores[h % 24] += weight;
}

function estimate(scores: Scores, baseFrom?: number, baseTo?: number) {
  // ограничим базовым диапазоном, если задан
  const mask = new Array(24).fill(0);
  for (let h = 0; h < 24; h++) {
    const inside = baseFrom == null || baseTo == null ? true
      : baseFrom <= baseTo
        ? h >= baseFrom && h <= baseTo
        : h >= baseFrom || h <= baseTo; // если диапазон через полночь
    mask[h] = inside ? 1 : 0.4; // за пределами диапазона уменьшаем вес
  }
  const weighted = scores.map((v, i) => v * mask[i]);
  const max = Math.max(...weighted);
  const best = weighted.findIndex(v => v === max);
  const conf = Math.min(1, max / (weighted.reduce((a, b) => a + b, 0) / 24 + 0.0001));
  // вернём центр часа как hh:mm
  const hh = best.toString().padStart(2, '0');
  return { hhmm: `${hh}:30`, hour: best, confidence: Math.round(conf * 100) };
}

// -------- Screen --------

export default function RectificationScreen() {
  // базовый диапазон (часы)
  const [knowRange, setKnowRange] = useState(false);
  const [from, setFrom] = useState('09'); // строка "HH"
  const [to, setTo] = useState('12');

  // ответы (мультивыбор) и события
  const [traits, setTraits] = useState<string[]>([]);
  const [style, setStyle] = useState<string | null>(null);
  const [speed, setSpeed] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);

  // расчёт
  const result = useMemo(() => {
    const s = emptyScores();

    // эвристики — просто для шаблона UI:
    // черты внешности/впечатления
    if (traits.includes('атлетичный')) addScoreRange(s, 6, 10, 1.2);
    if (traits.includes('хрупкий')) addScoreRange(s, 0, 3, 1.1);
    if (traits.includes('плотный')) addScoreRange(s, 16, 21, 1.15);
    if (traits.includes('проникающий взгляд')) addScoreRange(s, 22, 23, 1.2);
    if (traits.includes('мягкая мимика')) addScoreRange(s, 11, 15, 1.1);

    // социальная манера
    if (style === 'спокойный') addScoreRange(s, 3, 6, 1.1);
    if (style === 'директивный') addScoreRange(s, 9, 11, 1.2);
    if (style === 'общительный') addScoreRange(s, 12, 15, 1.15);
    if (style === 'отстранённый') addScoreRange(s, 18, 21, 1.1);

    // скорость
    if (speed === 'быстрая') addScoreRange(s, 5, 9, 1.1);
    if (speed === 'средняя') addScoreRange(s, 10, 14, 1.05);
    if (speed === 'медленная') addScoreRange(s, 20, 23, 1.1);

    // жизненные события (очень условно “якорим” в разные часы)
    for (const ev of events) {
      const hash = (ev.date + ev.kind).length % 24;
      addScoreRange(s, (hash + 23) % 24, (hash + 1) % 24, 1.25);
    }

    const baseFrom = knowRange ? parseInt(from, 10) : undefined;
    const baseTo = knowRange ? parseInt(to, 10) : undefined;
    const est = estimate(s, baseFrom, baseTo);
    return { est, scores: s };
  }, [traits, style, speed, events, knowRange, from, to]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        ListHeaderComponent={
          <>
            <Text style={st.title}>Ректификация (уточнение времени)</Text>
            <View style={st.card}>
              <Text style={st.p}>
                Если точного времени нет — мы сузим диапазон по ответам. Это ориентир, а не медицинский факт.
              </Text>
            </View>

            {/* Базовый диапазон */}
            <View style={st.card}>
              <Row>
                <Text style={st.cardTitle}>Мой базовый диапазон</Text>
                <Pressable
                  onPress={() => setKnowRange(!knowRange)}
                  style={[st.switch, knowRange && st.switchOn]}
                  accessibilityRole="button"
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{knowRange ? 'Задан' : 'Не знаю'}</Text>
                </Pressable>
              </Row>

              {knowRange && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <Field label="От (часы)" value={from} onChangeText={setFrom} placeholder="09" />
                  <Field label="До (часы)" value={to} onChangeText={setTo} placeholder="12" />
                </View>
              )}
            </View>

            {/* A. Черты */}
            <Section title="A. Внешность и первое впечатление (Асцендент)">
              <TagGrid
                options={['атлетичный','хрупкий','плотный','проникающий взгляд','мягкая мимика']}
                values={traits}
                onToggle={(v) =>
                  setTraits((prev) => (prev.includes(v) ? prev.filter(x => x!==v) : [...prev, v]))
                }
              />
            </Section>

            {/* B. Социальная манера + скорость */}
            <Section title="B. Манера и темп">
              <Text style={st.dim}>Социальная манера</Text>
              <BtnRow
                options={['спокойный','директивный','общительный','отстранённый']}
                value={style}
                onSelect={setStyle}
              />
              <Text style={[st.dim, { marginTop: 8 }]}>Скорость походки/жестикуляции</Text>
              <BtnRow
                options={['быстрая','средняя','медленная']}
                value={speed}
                onSelect={setSpeed}
              />
            </Section>

            {/* C. События */}
            <Section title="C. Яркие события (дата + тип)">
              <EventEditor
                items={events}
                onAdd={(e) => setEvents((prev) => [{ id: String(Date.now()), ...e }, ...prev])}
                onRemove={(id) => setEvents((prev) => prev.filter(x => x.id !== id))}
              />
            </Section>

            {/* Визуальная шкала и результат */}
            <Section title="Оценка времени">
              <HeatBar scores={result.scores} base={knowRange ? { from: parseInt(from,10), to: parseInt(to,10) } : null} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <Text style={st.est}>Оценка: {result.est.hhmm}</Text>
                <Badge text={`Уверенность ${result.est.confidence}%`} />
              </View>
              <Text style={st.pSmall}>
                Точность повысится, если добавить ещё 1–2 события или отметить больше черт.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Primary onPress={() => Alert.alert('Сохранено', 'Оценка сохранена локально (мок).')} text="Сохранить оценку" />
                <Ghost onPress={() => Alert.alert('Поделиться', 'Шеринг добавим позже.')} text="Поделиться" />
              </View>
            </Section>
          </>
        }
        data={[]}
        renderItem={null}
      />
    </SafeAreaView>
  );
}

/* ------------ UI helpers / components ------------ */

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>{children}</View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.card}>
      <Text style={st.cardTitle}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (t: string) => void; placeholder?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.dim}>{label}</Text>
      <TextInput
        style={st.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa0aa"
        keyboardType="number-pad"
        maxLength={2}
      />
    </View>
  );
}

function TagGrid({ options, values, onToggle }: { options: string[]; values: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <Pressable key={opt} onPress={() => onToggle(opt)} style={[st.tag, active && st.tagOn]}>
            <Text style={{ color: active ? '#fff' : C.text, fontWeight: '600' }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BtnRow({ options, value, onSelect }: { options: string[]; value: string | null; onSelect: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable key={opt} onPress={() => onSelect(opt)} style={[st.btn, active && st.btnOn]}>
            <Text style={{ color: active ? '#fff' : C.text, fontWeight: '600' }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EventEditor({ items, onAdd, onRemove }: { items: EventItem[]; onAdd: (e: Omit<EventItem, 'id'>) => void; onRemove: (id: string) => void }) {
  const [date, setDate] = useState('');
  const [kind, setKind] = useState('');
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={st.dim}>Дата (ГГГГ-ММ-ДД)</Text>
          <TextInput style={st.input} placeholder="2018-06-10" placeholderTextColor="#9aa0aa" value={date} onChangeText={setDate} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.dim}>Тип события</Text>
          <TextInput style={st.input} placeholder="переезд / брак / травма ..." placeholderTextColor="#9aa0aa" value={kind} onChangeText={setKind} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Primary
          text="Добавить"
          onPress={() => {
            if (!date || !kind) return Alert.alert('Заполните дату и тип события');
            onAdd({ date, kind });
            setDate(''); setKind('');
          }}
        />
      </View>

      {!!items.length && (
        <View style={{ marginTop: 10, gap: 6 }}>
          {items.map((ev) => (
            <View key={ev.id} style={st.evRow}>
              <Text style={st.evText}>• {ev.date} — {ev.kind}</Text>
              <Pressable onPress={() => onRemove(ev.id)}><Text style={{ color: C.dim }}>Удалить</Text></Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function HeatBar({ scores, base }: { scores: number[]; base: { from: number; to: number } | null }) {
  const max = Math.max(...scores, 1);
  return (
    <View accessible accessibilityLabel="Тепловая полоса вероятности времени" style={{ borderRadius: 10, overflow: 'hidden', borderColor: C.border, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row' }}>
        {scores.map((v, i) => {
          const intensity = v / max;
          const inBase = !base || (base.from <= base.to ? i >= base.from && i <= base.to : i >= base.from || i <= base.to);
          const bg = inBase ? C.primary : '#313244';
          return <View key={i} style={{ height: 18, width: `${100/24}%` as any, backgroundColor: bg, opacity: Math.max(0.25, intensity) }} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 }}>
        <Text style={st.tick}>00</Text><Text style={st.tick}>06</Text><Text style={st.tick}>12</Text><Text style={st.tick}>18</Text><Text style={st.tick}>24</Text>
      </View>
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: 'rgba(79,70,229,0.2)', borderColor: C.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

function Primary({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.primary}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}
function Ghost({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.ghost}>
      <Text style={{ color: '#fff', fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}

/* ------------ styles ------------ */
const st = StyleSheet.create({
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10 },
  p: { color: C.text, fontSize: 14, lineHeight: 20 },
  pSmall: { color: C.dim, fontSize: 12, marginTop: 6 },

  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 6 },
  dim: { color: C.dim, fontSize: 13 },

  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#fff', marginTop: 4 },

  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  tagOn: { backgroundColor: C.primary, borderColor: C.primary },

  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  btnOn: { backgroundColor: C.primary, borderColor: C.primary },

  switch: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.border },
  switchOn: { backgroundColor: C.primary, borderColor: C.primary },

  est: { color: '#fff', fontSize: 18, fontWeight: '800' },

  evRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomColor: C.border, borderBottomWidth: StyleSheet.hairlineWidth },
  evText: { color: C.text, fontSize: 14 },

  tick: { color: C.dim, fontSize: 10 },

  primary: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  ghost: { borderColor: C.border, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
});
