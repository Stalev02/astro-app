// app/(tabs)/astro-chat.tsx
import { getSupabase } from '@/src/lib/supabase';
import { ENDPOINTS } from '@/src/shared/config/api';
import { useProfiles } from '@/src/store/profiles';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

console.log('API_BASE', ENDPOINTS.health);

/* ==================== Types ==================== */
type Msg = { id: string; role: 'user' | 'bot'; text: string; ts: number };

/* ==================== Menu (prompts) ==================== */
type MenuNode =
  | {
      id: string;
      title: string;
      type: 'menu';
      nav?: { back?: boolean; home?: boolean };
      children: MenuNode[];
    }
  | { id: string; title: string; type: 'action'; action_id: keyof typeof PROMPTS }
  | { id: string; title: string; type: 'nav'; goto: 'compatibility' | 'forecast_transits' };

const PROMPTS = {
  destiny_overview:
    'Проанализируй натальную карту пользователя (знак Солнца, Асцендент, Середина Неба, планетарные аспекты с Юпитером, Сатурном и осью узлов) ...',
  career_type: 'Определи общий тип карьерного пути по MC, управителям 10/6 домов и сильным планетам.',
  fin_overview: 'Проанализируй 2-й/8-й дома, их управителей и аспекты к Юпитеру/Венере/Плутону.',
  compat_partner: 'Романтическая синастрия: ключевые аспекты и динамика.',
  forecast_week: 'Опиши темы недели по транзитам личных планет к натальной карте.',
} as const;

const MENU: MenuNode = {
  id: 'main',
  title: 'Быстрые вопросы',
  type: 'menu',
  nav: { back: false, home: false },
  children: [
    {
      id: 'my_chart',
      title: 'Моя карта',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'destiny_overview', title: 'Моё предназначение', type: 'action', action_id: 'destiny_overview' },
        { id: 'career_type', title: 'Карьерный тип', type: 'action', action_id: 'career_type' },
        { id: 'fin_overview', title: 'Финансы (обзор)', type: 'action', action_id: 'fin_overview' },
      ],
    },
    {
      id: 'compatibility',
      title: 'Совместимость',
      type: 'menu',
      nav: { back: true, home: true },
      children: [{ id: 'compat_partner', title: 'С партнёром', type: 'action', action_id: 'compat_partner' }],
    },
    {
      id: 'forecast',
      title: 'Прогнозы',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'forecast_week', title: 'Неделя', type: 'action', action_id: 'forecast_week' },
        { id: 'goto_forecasts', title: 'К экрану «Прогнозы»', type: 'nav', goto: 'forecast_transits' },
      ],
    },
  ],
};

/* ==================== Screen ==================== */
export default function AstroChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const deviceId = useProfiles((s) => s.deviceId);

  const [messages, setMessages] = useState<Msg[]>([
    { id: 'm1', role: 'bot', text: 'Привет! Спроси что-нибудь по своей карте 🌌', ts: Date.now() },
  ]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Msg>>(null);

  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  async function speak(text: string) {
    try {
      if (Speech.isSpeakingAsync && (await Speech.isSpeakingAsync())) Speech.stop();
    } catch {}
    Speech.speak(String(text), { language: 'ru-RU', pitch: 1.0, rate: 0.98 });
  }

  const [isBusy, setIsBusy] = useState(false);

  const sendText = async (textIn: string) => {
    const text = textIn.trim();
    if (!text || isBusy) return;

    const user: Msg = { id: String(Date.now()), role: 'user', text, ts: Date.now() };
    setMessages((prev) => [...prev, user, { id: user.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 }]);
    setDraft('');
    scrollToEnd();

    try {
      setIsBusy(true);

      let token: string | undefined;
      try {
        const sb = await getSupabase();
        const { data: sessionData } = await sb.auth.getSession();
        token = sessionData.session?.access_token;
      } catch {
        token = undefined;
      }

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 15000);
      let r: Response;
      try {
        r = await fetch(ENDPOINTS.aiQuery, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ deviceId, question: text }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`);

      const ct = r.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await r.json() : { reply: await r.text() };
      const botText = data?.reply ?? 'Ок.';

      setMessages((prev) => prev.map((m) => (m.id === user.id + ':wait' ? { ...m, text: String(botText) } : m)));
      scrollToEnd();
      if (botText) await speak(String(botText));
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Сервер не ответил (таймаут)' : (e?.message || 'Ошибка сети');
      setMessages((prev) =>
        prev.map((m) => (m.id === user.id + ':wait' ? { ...m, text: 'Ошибка связи с сервером' } : m))
      );
      Alert.alert('Чат', msg);
    } finally {
      setIsBusy(false);
    }
  };

  /* ====== Voice ====== */
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Микрофон', 'Разрешите доступ к микрофону');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(created.recording);
      setIsRecording(true);
    } catch {
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      setIsRecording(false);
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;

      setIsBusy(true);

      const uploadRes = await FileSystem.uploadAsync(ENDPOINTS.speech, uri, {
        fieldName: 'audio',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        mimeType: 'audio/m4a',
        parameters: {},
      });

      if (uploadRes.status !== 200) {
        throw new Error(`STT HTTP ${uploadRes.status}: ${uploadRes.body?.slice(0, 200) || ''}`);
      }

      let stt: any = {};
      try {
        stt = JSON.parse(uploadRes.body);
      } catch {}
      const text = (stt?.text || '').trim();
      if (!text) {
        Alert.alert('Речь', 'Не удалось распознать голос');
        return;
      }

      const userMsg: Msg = { id: String(Date.now()), role: 'user', text, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg, { id: userMsg.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 }]);
      scrollToEnd();

      let token: string | undefined;
      try {
        const sb = await getSupabase();
        const { data: sessionData } = await sb.auth.getSession();
        token = sessionData.session?.access_token;
      } catch {
        token = undefined;
      }

      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 15000);
      let r: Response;
      try {
        r = await fetch(ENDPOINTS.aiQuery, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ deviceId, question: text }),
          signal: ac2.signal,
        });
      } finally {
        clearTimeout(timeout2);
      }

      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`);

      const ct = r.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await r.json() : { reply: await r.text() };
      const botText = data?.reply ?? 'Ок.';

      setMessages((prev) => prev.map((m) => (m.id === userMsg.id + ':wait' ? { ...m, text: String(botText) } : m)));
      scrollToEnd();
      if (botText) await speak(String(botText));
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Сервер не ответил (таймаут)' : (e?.message || 'Проблема с отправкой голоса');
      Alert.alert('Ошибка', msg);
    } finally {
      setIsBusy(false);
    }
  };

  /* ====== Keyboard menu (Telegram style) ====== */
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [path, setPath] = useState<string[]>(['main']);

  const curNode = useMemo<MenuNode>(() => {
    let node: MenuNode = MENU;
    for (let i = 1; i < path.length; i++) {
      const id = path[i];
      if (node.type !== 'menu') break;
      const next = node.children.find((c) => c.id === id);
      if (next) node = next;
    }
    return node;
  }, [path]);

  const goHome = () => setPath(['main']);
  const canGoBack = path.length > 1;
  const goBack = () => setPath((p) => (p.length > 1 ? p.slice(0, -1) : p));

  const routerGoto = (goto: 'compatibility' | 'forecast_transits') => {
    if (goto === 'compatibility') router.push('/(tabs)/compatibility' as any);
    if (goto === 'forecast_transits') router.push('/(tabs)/forecasts' as any);
    setMenuOpen(false);
  };

  const sendAction = (action_id: keyof typeof PROMPTS) => {
    const prompt = PROMPTS[action_id];
    if (prompt) sendText(prompt);
    setMenuOpen(false);
  };

  const children = curNode.type === 'menu' ? curNode.children : [];

  // Reserve enough bottom space so last messages are not hidden behind menu+input.
  const INPUT_BAR_H = 62;
  const MENU_DOCK_H = 76;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
  style={styles.flex}
  behavior="padding"
  keyboardVerticalOffset={
    Platform.OS === 'ios'
      ? 80 // <-- pushes up about ~1.5 input heights on iPhone
      : 90  // <-- Android also usually needs an offset
  }
>
        <FlatList
          ref={listRef}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: INPUT_BAR_H + MENU_DOCK_H + insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          data={messages}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={<Text style={styles.title}>Чат по карте</Text>}
          renderItem={({ item }) => <Bubble item={item} />}
        />

        {/* ===== Menu dock ===== */}
        <View style={styles.menuDock}>
          <View style={styles.menuHeader}>
            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              style={[styles.menuToggle, menuOpen && { backgroundColor: '#4f46e5' }]}
            >
              <Ionicons name="menu" size={16} color={menuOpen ? '#fff' : '#4f46e5'} />
              <Text style={[styles.menuToggleText, { color: menuOpen ? '#fff' : '#4f46e5' }]}>
                {menuOpen ? 'Скрыть' : 'Меню'}
              </Text>
            </Pressable>

            {menuOpen && curNode.type === 'menu' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {curNode.nav?.home && (
                  <Pressable onPress={goHome} style={styles.navChip}>
                    <Text style={styles.navChipText}>Домой</Text>
                  </Pressable>
                )}
                {canGoBack && curNode.nav?.back !== false && (
                  <Pressable onPress={goBack} style={styles.navChip}>
                    <Text style={styles.navChipText}>Назад</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {menuOpen && curNode.type === 'menu' && (
            <View style={styles.keyboardPanel}>
              {children.map((child) => (
                <Pressable
                  key={child.id}
                  onPress={() => {
                    if (child.type === 'menu') setPath((p) => [...p, child.id]);
                    else if (child.type === 'action') sendAction(child.action_id);
                    else if (child.type === 'nav') routerGoto(child.goto);
                  }}
                  style={styles.kbButton}
                >
                  <Text style={styles.kbText}>{child.title}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ===== Input bar ===== */}
        <View style={[styles.inputBar, { paddingBottom: 10 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Напишите вопрос…"
            placeholderTextColor="#8b8e97"
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Поле ввода сообщения"
          />
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.iconBtn, isRecording && { backgroundColor: '#ef4444' }, isBusy && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Остановить запись' : 'Начать запись'}
            disabled={isBusy}
          >
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => sendText(draft)}
            style={[styles.sendBtn, isBusy && { opacity: 0.6 }]}
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

/* ===== UI bits ===== */
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

/* ===== Styles ===== */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  flex: { flex: 1 },

  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },

  listContent: { padding: 16 },

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

  // Input bar is now in normal layout flow so KeyboardAvoidingView can lift it.
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
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

  // Menu dock is also in normal flow, above the input bar.
  menuDock: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  menuToggleText: { fontWeight: '800' },

  navChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  navChipText: { color: '#e5e7eb', fontWeight: '700' },

  keyboardPanel: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  kbButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 6,
  },
  kbText: { color: '#1f2937', fontWeight: '800', fontSize: 15 },
});
