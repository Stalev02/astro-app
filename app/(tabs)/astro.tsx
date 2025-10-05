// app/(tabs)/astro.tsx
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import React, { useMemo, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

/* ================== CONFIG ================== */
const BACKEND = 'http://127.0.0.1:3000';           // 👈 ЗАМЕНИТЕ НА СВОЙ IP
const SPEECH_URL = `${BACKEND}/speech`;
const CHAT_URL   = `${BACKEND}/chat`;

/* ================== TYPES ================== */

type AstroStats = {
  sun: string;
  moon: string;
  asc: string;
  elements: { fire: number; earth: number; air: number; water: number };
  modalities: { cardinal: number; fixed: number; mutable: number };
  aspects: { harmonious: number; tense: number; total: number };
};

type Msg = { id: string; role: 'user' | 'bot'; text: string; ts: number };

/* ================== MOCK DATA ================== */
function useMockStats(): AstroStats {
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

/* ================== SCREEN ================== */

export default function AstroScreen() {
  const { width } = useWindowDimensions();
  const chartSize = Math.min(width - 32, 360);
  const stats = useMockStats();

  /* CHAT STATE */
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'm1', role: 'bot', text: 'Привет! Спроси что-нибудь по своей карте 🌌', ts: Date.now() },
  ]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Msg>>(null);

  /* VOICE STATE */
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false); // чтобы не спамили запросами

  const scrollToEnd = () =>
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  /* --- TEXT SEND (кнопка "Отправить") --- */
  const sendText = async (textIn: string) => {
    const text = textIn.trim();
    if (!text || isBusy) return;

    const user: Msg = { id: String(Date.now()), role: 'user', text, ts: Date.now() };
    setMessages(prev => [...prev, user, { id: user.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 }]);
    setDraft('');
    scrollToEnd();

    try {
      setIsBusy(true);
      const r = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const ct = r.headers.get('content-type') || '';
let botText = '';
if (ct.includes('application/json')) {
  const data = await r.json();
  botText = data?.reply ?? data?.text ?? 'Ок.';
} else {
  botText = await r.text();
}

      // заменить "…" на ответ
      setMessages(prev =>
        prev.map(m => (m.id === user.id + ':wait' ? { ...m, text: String(botText) } : m))
      );
      scrollToEnd();

      // TTS ответа
      if (botText) {
        Speech.speak(String(botText), {
          language: 'ru-RU',
          pitch: 1.0,
          rate: 0.98,
        });
      }
    } catch (e) {
      console.error('chat error', e);
      setMessages(prev =>
        prev.map(m => (m.id === user.id + ':wait' ? { ...m, text: 'Ошибка связи с чат-сервером' } : m))
      );
    } finally {
      setIsBusy(false);
    }
  };

  const onPressSend = () => sendText(draft);

  /* --- VOICE: start --- */
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Микрофон', 'Разрешите доступ к микрофону в настройках');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: 1,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();

      setRecording(rec);
      setIsRecording(true);
    } catch (e) {
      console.error('startRecording error', e);
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  /* --- VOICE: stop, STT, chat, TTS --- */
  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      setIsRecording(false);

      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      // отправка аудио на /speech
      const fd = new FormData();
      fd.append('audio', {
        // @ts-ignore – RN form-data файл
        uri,
        name: 'voice.m4a',
        type: 'audio/m4a',
      });

      setIsBusy(true);
      const sttResp = await fetch(SPEECH_URL, { method: 'POST', body: fd });
      const stt = await sttResp.json();
      const text = (stt?.text || '').trim();

      if (!text) {
        Alert.alert('Речь', 'Не удалось распознать голос');
        setIsBusy(false);
        return;
      }

      // показать как пользовательское сообщение и отправить в чат
      const userMsg: Msg = { id: String(Date.now()), role: 'user', text, ts: Date.now() };
      setMessages(prev => [...prev, userMsg, { id: userMsg.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 }]);
      scrollToEnd();

      const r = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const ct = r.headers.get('content-type') || '';
      const botText = ct.includes('application/json')
        ? (await r.json())?.reply ?? (await r.json())?.text ?? 'Ок.'
        : await r.text();

      setMessages(prev =>
        prev.map(m => (m.id === userMsg.id + ':wait' ? { ...m, text: String(botText) } : m))
      );
      scrollToEnd();

      // озвучить ответ
      if (botText) {
        Speech.speak(String(botText), { language: 'ru-RU', pitch: 1.0, rate: 0.98 });
      }
    } catch (e) {
      console.error('stopRecording error', e);
      Alert.alert('Ошибка', 'Проблема с отправкой голоса');
    } finally {
      setIsBusy(false);
    }
  };

  /* UI */

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListHeaderComponent={
            <>
              <Text style={styles.title}>Моя Астро-Карта</Text>

              {/* карточка с астрокартой */}
              <View style={styles.card}>
                <View style={[styles.chartWrap, { width: chartSize, height: chartSize }]}>
                  <Image
                    source={{
                      uri: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Astrological_chart_-_natal_chart_example.png',
                    }}
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%' }}
                    accessible
                    accessibilityLabel="Астрологическая карта пользователя"
                  />
                </View>

                <View style={styles.row}>
                  <Pill icon="sunny-outline" label={stats.sun} />
                  <Pill icon="moon-outline" label={stats.moon} />
                </View>
                <View style={styles.row}>
                  <Pill icon="compass-outline" label={stats.asc} />
                  <Pill icon="star-outline" label={`Аспекты: ${stats.aspects.harmonious} / ${stats.aspects.tense}`} />
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

              <Text style={styles.subtitle}>Чат по карте</Text>
            </>
          }
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble item={item} />}
        />

        {/* input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Напишите вопрос…"
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Поле ввода сообщения"
          />

          {/* Кнопка микрофона */}
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.iconBtn, isRecording && { backgroundColor: '#ef4444' }]}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Остановить запись' : 'Начать запись'}
            disabled={isBusy}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
          </Pressable>

          {/* Кнопка Отправить */}
          <Pressable
            onPress={onPressSend}
            style={styles.sendBtn}
            accessibilityRole="button"
            accessibilityLabel="Отправить"
            disabled={isBusy}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ============= UI bits ============= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function Pill({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
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

function Bubble({ item }: { item: Msg }) {
  const me = item.role === 'user';
  return (
    <View style={[styles.bubbleWrap, me ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
      <View style={[styles.bubble, me ? styles.me : styles.bot]}>
        {!me && <Ionicons name="star-outline" size={14} color="#4f46e5" style={{ marginRight: 6 }} />}
        <Text style={[styles.bubbleText, me && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  );
}

/* ============= styles ============= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 8 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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

  bubbleWrap: { paddingVertical: 4 },
  bubble: {
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  me: { backgroundColor: '#4f46e5' },
  bot: { backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleText: { color: '#e5e7eb', fontSize: 15 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0b0b0c',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    fontSize: 15,
  },
  sendBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    backgroundColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
