// app/onboarding-profile.tsx
import { searchPlaces } from '@/src/shared/api/profiles';
import { PersonProfile, useProfiles } from '@/src/store/profiles';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

const C = {
  bg: '#0b0b0c',
  card: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
  text: '#e5e7eb',
  dim: '#c7c9d1',
  primary: '#4f46e5',
  err: '#ef4444',
};

const TOP_OFFSET = 80;

type PickedGeo = {
  id: string;
  city: string;
  nation: string | null;
  lat: number;
  lng: number;
  tz: string | null;
  displayName: string;
};

type StepKey =
  | 'name'         // имя + пол
  | 'birthDate'
  | 'birthTime'    // + ректификация
  | 'birthPlace'   // место рождения + проживание
  | 'final';

const genders: Array<{ key: PersonProfile['gender'] | 'na'; label: string }> = [
  { key: 'male', label: 'Мужской' },
  { key: 'female', label: 'Женский' },
  { key: 'other', label: 'Другое' },
  { key: 'na', label: 'Не указывать' },
];

export default function OnboardingProfileWizard() {
  const router = useRouter();
  const submitOnboarding = useProfiles((s) => s.submitOnboarding);
  const loading = useProfiles((s) => s.loading);

  const [name, setName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');

  const [timeKnown, setTimeKnown] = useState<boolean>(true);
  const [birthTime, setBirthTime] = useState<string>('');
  const [seconds, setSeconds] = useState<string>('00');

  const [placeQuery, setPlaceQuery] = useState<string>('');
  const [pickedGeo, setPickedGeo] = useState<PickedGeo | null>(null);
  const [suggest, setSuggest] = useState<PickedGeo[]>([]);
  const [showSuggest, setShowSuggest] = useState<boolean>(false);

  const [livesElsewhere, setLivesElsewhere] = useState<boolean>(false);
  const [currentCity, setCurrentCity] = useState<string>('');

  const [gender, setGender] = useState<PersonProfile['gender'] | 'na'>('na');

  const [step, setStep] = useState<StepKey>('name');

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const q = placeQuery.trim();
    if (step !== 'birthPlace') return;
    if (q.length >= 2) {
      t = setTimeout(async () => {
        try {
          const res = await searchPlaces(q);
          const items: PickedGeo[] = (res.items || []).map((it: any) => ({
            id: it.id,
            city: it.city,
            nation: it.nation || null,
            lat: it.lat,
            lng: it.lng,
            tz: it.tz || null,
            displayName: it.displayName,
          }));
          setSuggest(items);
          setShowSuggest(true);
        } catch {
          setSuggest([]);
          setShowSuggest(false);
        }
      }, 250);
    } else {
      setSuggest([]);
      setShowSuggest(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [placeQuery, step]);

  useEffect(() => {
    if (!pickedGeo) return;
    const normalized = `${pickedGeo.city}${pickedGeo.nation ? ', ' + pickedGeo.nation : ''}`;
    if (placeQuery.trim() !== pickedGeo.displayName && placeQuery.trim() !== normalized) {
      setPickedGeo(null);
    }
  }, [placeQuery, pickedGeo]);

  const order: StepKey[] = ['name', 'birthDate', 'birthTime', 'birthPlace', 'final'];
  const idx = order.indexOf(step);
  const canPrev = idx > 0;

  const goPrev = () => setStep(order[Math.max(0, idx - 1)]);
  const goNext = () => setStep(order[Math.min(order.length - 1, idx + 1)]);

  function validateAndNext() {
    switch (step) {
      case 'name':
        if (!name.trim()) return Alert.alert('Имя', 'Укажи имя.');
        return goNext();
      case 'birthDate':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return Alert.alert('Дата', 'Формат ГГГГ-ММ-ДД.');
        return goNext();
      case 'birthTime':
        if (!timeKnown) return goNext();
        if (!/^\d{2}:\d{2}$/.test(birthTime)) return Alert.alert('Время', 'Формат ЧЧ:ММ.');
        if (!/^\d{2}$/.test(seconds)) return Alert.alert('Секунды', '00–59.');
        return goNext();
      case 'birthPlace':
        if (!pickedGeo) return Alert.alert('Место рождения', 'Выбери место из подсказок.');
        if (livesElsewhere && !currentCity.trim())
          return Alert.alert('Проживание', 'Укажи текущий город или отключи «Проживаю в другом месте».');
        return goNext();
      default:
        return;
    }
  }

  async function saveProfile() {
    try {
      if (!name.trim()) return Alert.alert('Имя', 'Укажи имя.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return Alert.alert('Дата', 'Формат ГГГГ-ММ-ДД.');
      if (timeKnown && !/^\d{2}:\d{2}$/.test(birthTime)) return Alert.alert('Время', 'Формат ЧЧ:ММ.');
      if (!pickedGeo) return Alert.alert('Место рождения', 'Выбери место из подсказок.');

      const input: Partial<PersonProfile> = {
        name: name.trim(),
        date: birthDate,
        time: timeKnown ? birthTime : undefined,
        place: placeQuery,
        birthDateISO: birthDate,
        timeKnown,
        seconds: timeKnown ? Number(seconds) : undefined,
        birthPlace: placeQuery,
        livesElsewhere,
        currentCity: livesElsewhere ? currentCity.trim() : undefined,
        gender: gender === 'na' ? undefined : (gender as any),
        fullDateTimeISO: timeKnown ? `${birthDate}T${birthTime}:${seconds || '00'}` : undefined,
        coords: pickedGeo ? { lat: pickedGeo.lat, lng: pickedGeo.lng } : undefined,
        tz: pickedGeo?.tz || undefined,
      };

      await submitOnboarding(input);
      router.replace('/(tabs)/astro');
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Не удалось сохранить анкету');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16 }}>
          <Header step={idx + 1} total={order.length} onBack={canPrev ? goPrev : undefined} />
          <View style={{ flex: 1, marginTop: 8 }}>
            {step === 'name' && (
              <ScreenNameGender
                name={name}
                setName={setName}
                gender={gender}
                setGender={(g: PersonProfile['gender'] | 'na') => setGender(g)}
              />
            )}
            {step === 'birthDate' && <ScreenBirthDate value={birthDate} setValue={setBirthDate} />}
            {step === 'birthTime' && (
              <ScreenBirthTime
                timeKnown={timeKnown}
                setTimeKnown={setTimeKnown}
                birthTime={birthTime}
                setBirthTime={setBirthTime}
                seconds={seconds}
                setSeconds={(t: string) => setSeconds(t.replace(/\D/g, '').slice(0, 2))}
              />
            )}
            {step === 'birthPlace' && (
              <ScreenBirthPlaceWithLive
                placeQuery={placeQuery}
                setPlaceQuery={(t: string) => setPlaceQuery(t)}
                pickedGeo={pickedGeo}
                setPickedGeo={(g: PickedGeo | null) => setPickedGeo(g)}
                suggest={suggest}
                showSuggest={showSuggest}
                setShowSuggest={(v: boolean) => setShowSuggest(v)}
                livesElsewhere={livesElsewhere}
                setLivesElsewhere={(v: boolean) => setLivesElsewhere(v)}
                currentCity={currentCity}
                setCurrentCity={(t: string) => setCurrentCity(t)}
              />
            )}
            {step === 'final' && <ScreenReview onRect={() => router.push({ pathname: '/modal', params: { mode: 'rectification' } })} />}
          </View>

          <View style={s.nav}>
            {step !== 'final' ? (
              <Pressable onPress={validateAndNext} style={[s.btn, s.primary, { flex: 1 }]}>
                <Text style={[s.btnText, { color: '#fff' }]}>{loading ? 'Загружаю…' : 'Продолжить'}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={saveProfile} disabled={loading} style={[s.btn, s.primary, { flex: 1, opacity: loading ? 0.7 : 1 }]}>
                <Text style={[s.btnText, { color: '#fff' }]}>{loading ? 'Сохраняю…' : 'Сохранить анкету'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ────────── ШАГИ ────────── */

function Header({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {onBack ? (
        <Pressable onPress={onBack} style={[s.btn, s.ghost, { paddingVertical: 8 }]}>
          <Text style={s.btnText}>Назад</Text>
        </Pressable>
      ) : (
        <View style={{ width: 80 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={s.progressWrap}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[s.progressDot, i < step ? { backgroundColor: C.primary } : null]} />
          ))}
        </View>
        <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center' }}>Шаг {step} из {total}</Text>
      </View>
      <View style={{ width: 80 }} />
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.h1}>{title}</Text>
      <View style={{ marginTop: 8, gap: 8 }}>{children}</View>
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} style={[s.input, props.style]} placeholderTextColor="#8b8e97" />;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: C.dim, fontSize: 12 }}>{children}</Text>;
}

function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, style]}>{children}</View>;
}

/* Имя + Пол */
function ScreenNameGender({
  name,
  setName,
  gender,
  setGender,
}: {
  name: string;
  setName: (t: string) => void;
  gender: PersonProfile['gender'] | 'na';
  setGender: (g: PersonProfile['gender'] | 'na') => void;
}) {
  return (
    <Card title="Как тебя зовут?">
      <Input value={name} onChangeText={(t: string) => setName(t)} placeholder="Имя" autoFocus />
      <Hint>Выбери пол (необязательно)</Hint>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {genders.map((g) => {
          const active = gender === g.key;
          return (
            <Pressable key={g.key} onPress={() => setGender(g.key)} style={[s.tag, active && s.tagOn]}>
              <Text style={{ color: active ? '#fff' : C.text, fontWeight: '600' }}>{g.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

/* Дата рождения — продвинутый выбор */
function ScreenBirthDate({ value, setValue }: { value: string; setValue: (t: string) => void }) {
  const now = new Date();
  const CY = now.getFullYear();
  const CM = now.getMonth() + 1;
  const CD = now.getDate();

  const { width: sw, height: sh } = useWindowDimensions();
  const MODAL_PAD = 14;
  const modalWidth = Math.min(sw - 32, 360);
  const innerGap = 8;
  const contentWidth = modalWidth - MODAL_PAD * 2;
  const colWidth = Math.floor((contentWidth - innerGap * 2) / 3);
  const listHeight = Math.min(300, Math.max(220), Math.floor(sh * 0.45));

  const [open, setOpen] = useState<boolean>(false);
  const [y, setY] = useState<number>(() => (value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ? Number(value.slice(0, 4)) : CY));
  const [m, setM] = useState<number>(() => (value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ? Number(value.slice(5, 7)) : CM));
  const [d, setD] = useState<number>(() => (value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ? Number(value.slice(8, 10)) : CD));

  const [tmpY, setTmpY] = useState<number>(y);
  const [tmpM, setTmpM] = useState<number>(m);
  const [tmpD, setTmpD] = useState<number>(d);

  const years = useMemo<number[]>(() => {
    const arr: number[] = [];
    for (let i = CY; i >= 1900; i--) arr.push(i);
    return arr;
  }, [CY]);

  const allMonths = useMemo(
    () => [
      { n: 1, title: 'Январь' }, { n: 2, title: 'Февраль' }, { n: 3, title: 'Март' },
      { n: 4, title: 'Апрель' },  { n: 5, title: 'Май' },     { n: 6, title: 'Июнь' },
      { n: 7, title: 'Июль' },    { n: 8, title: 'Август' },  { n: 9, title: 'Сентябрь' },
      { n: 10, title: 'Октябрь' },{ n: 11, title: 'Ноябрь' }, { n: 12, title: 'Декабрь' },
    ],
    []
  );
  const months = useMemo(() => {
    const maxM = tmpY === CY ? CM : 12;
    return allMonths.filter((it) => it.n <= maxM);
  }, [allMonths, tmpY, CY, CM]);

  const days = useMemo<number[]>(() => {
    const monthDays = new Date(tmpY, tmpM, 0).getDate();
    const limit = tmpY === CY && tmpM === CM ? Math.min(monthDays, CD) : monthDays;
    return Array.from({ length: limit }, (_, i) => i + 1);
  }, [tmpY, tmpM, CY, CM, CD]);

  useEffect(() => {
    const maxM = tmpY === CY ? CM : 12;
    if (tmpM > maxM) setTmpM(maxM);
  }, [tmpY, CY, CM, tmpM]);

  useEffect(() => {
    const lastDay = days[days.length - 1] || 1;
    if (tmpD > lastDay) setTmpD(lastDay);
  }, [days, tmpD]);

  function openPicker() {
    setTmpY(y); setTmpM(m); setTmpD(d);
    setOpen(true);
  }
  function confirm() {
    const lastDay = days[days.length - 1] || 1;
    const finalD = Math.min(tmpD, lastDay);
    setY(tmpY); setM(tmpM); setD(finalD);
    const mm = String(tmpM).padStart(2, '0');
    const dd = String(finalD).padStart(2, '0');
    setValue(`${tmpY}-${mm}-${dd}`);
    setOpen(false);
  }

  const friendly = value || `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <Card title="Дата рождения">
      <Pressable onPress={openPicker} style={[s.chip]}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{friendly}</Text>
      </Pressable>
      <Hint>Нажми, чтобы выбрать год / месяц / день</Hint>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.modalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={[s.modalCard, { width: modalWidth, marginTop: TOP_OFFSET }]}>
            <Text style={[s.h1, { marginBottom: 8 }]}>Выбери дату</Text>
            <View style={[s.pickerRow, { gap: innerGap }]}>
              <PickerColumnNumber title="Год" data={years} selected={tmpY} onSelect={(n) => setTmpY(n)} style={{ width: colWidth }} listHeight={listHeight} />
              <PickerColumnMonth  title="Месяц" data={months} selected={tmpM} onSelect={(n) => setTmpM(n)} style={{ width: colWidth }} listHeight={listHeight} />
              <PickerColumnNumber title="День" data={days}  selected={tmpD} onSelect={(n) => setTmpD(n)} style={{ width: colWidth }} listHeight={listHeight} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setOpen(false)} style={[s.btn, s.ghost, { flex: 1 }]}><Text style={s.btnText}>Отмена</Text></Pressable>
              <Pressable onPress={confirm} style={[s.btn, s.primary, { flex: 1 }]}><Text style={[s.btnText, { color: '#fff' }]}>Готово</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

/* Время рождения — с кнопкой Ректификация */
function ScreenBirthTime({
  timeKnown,
  setTimeKnown,
  birthTime,
  setBirthTime,
  seconds,
  setSeconds,
}: {
  timeKnown: boolean;
  setTimeKnown: (v: boolean) => void;
  birthTime: string;
  setBirthTime: (t: string) => void;
  seconds: string;
  setSeconds: (t: string) => void;
}) {
  const router = useRouter();
  const { width: sw, height: sh } = useWindowDimensions();
  const MODAL_PAD = 14;
  const modalWidth = Math.min(sw - 32, 360);
  const innerGap = 8;
  const contentWidth = modalWidth - MODAL_PAD * 2;
  const colWidth = Math.floor((contentWidth - innerGap * 2) / 3);
  const listHeight = Math.min(300, Math.max(220), Math.floor(sh * 0.45));

  const [open, setOpen] = useState<boolean>(false);

  const curH = /^\d{2}:\d{2}$/.test(birthTime) ? Number(birthTime.slice(0, 2)) : new Date().getHours();
  const curM = /^\d{2}:\d{2}$/.test(birthTime) ? Number(birthTime.slice(3, 5)) : new Date().getMinutes();
  const curS = /^\d{2}$/.test(seconds) ? Number(seconds) : 0;

  const [tmpH, setTmpH] = useState<number>(curH);
  const [tmpM, setTmpM] = useState<number>(curM);
  const [tmpS, setTmpS] = useState<number>(curS);

  const hours = useMemo<number[]>(() => Array.from({ length: 24 }, (_, i) => i), []);
  const mins  = useMemo<number[]>(() => Array.from({ length: 60 }, (_, i) => i), []);
  const secs  = mins;

  function openPicker() { setTmpH(curH); setTmpM(curM); setTmpS(curS); setOpen(true); }
  function confirm() {
    const HH = String(tmpH).padStart(2, '0');
    const MM = String(tmpM).padStart(2, '0');
    const SS = String(tmpS).padStart(2, '0');
    setBirthTime(`${HH}:${MM}`);
    setSeconds(SS);
    setOpen(false);
  }

  const chipTime = timeKnown && /^\d{2}:\d{2}$/.test(birthTime)
    ? `${birthTime}:${seconds?.padStart(2, '0') || '00'}`
    : 'Выбери время';

  return (
    <Card title="Время рождения">
      {/* Выбор времени показываем, только если время известно */}
      {timeKnown ? (
        <>
          <Pressable onPress={openPicker} style={[s.chip]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{chipTime}</Text>
          </Pressable>
          <Hint>Нажми, чтобы выбрать ЧЧ / ММ / СС</Hint>

          <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <View style={s.modalWrap}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
              <View style={[s.modalCard, { width: modalWidth, marginTop: 80 }]}>
                <Text style={[s.h1, { marginBottom: 8 }]}>Выбери время</Text>
                <View style={[s.pickerRow, { gap: innerGap }]}>
                  <PickerColumnNumber title="Часы"   data={hours} selected={tmpH} onSelect={(n) => setTmpH(n)} style={{ width: colWidth }} listHeight={listHeight} format={(n) => String(n).padStart(2, '0')} />
                  <PickerColumnNumber title="Минуты" data={mins}  selected={tmpM} onSelect={(n) => setTmpM(n)} style={{ width: colWidth }} listHeight={listHeight} format={(n) => String(n).padStart(2, '0')} />
                  <PickerColumnNumber title="Секунды" data={secs} selected={tmpS} onSelect={(n) => setTmpS(n)} style={{ width: colWidth }} listHeight={listHeight} format={(n) => String(n).padStart(2, '0')} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable onPress={() => setOpen(false)} style={[s.btn, s.ghost, { flex: 1 }]}><Text style={s.btnText}>Отмена</Text></Pressable>
                  <Pressable onPress={confirm} style={[s.btn, s.primary, { flex: 1 }]}><Text style={[s.btnText, { color: '#fff' }]}>Готово</Text></Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : (
        <Hint>Если не знаешь точное время, просто продолжай — можно уточнить позже.</Hint>
      )}

      {/* Переключатель под блоком выбора времени */}
      {/* Переключатель под блоком выбора времени — компактный и кликабельный всей строкой */}
<Pressable
  onPress={() => setTimeKnown(!timeKnown)}
  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6 }}
  hitSlop={8}
>
  <Text style={[s.label, { fontSize: 15, fontWeight: '700' }]}>
    Не знаю точное время
  </Text>
  <Switch
    value={!timeKnown}
    onValueChange={(v) => setTimeKnown(!v)}
    ios_backgroundColor="rgba(255,255,255,0.2)"
    trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4f46e5' }}
    thumbColor={'#ffffff'}
    style={{ marginLeft: 12, transform: [{ scaleX: 0.96 }, { scaleY: 0.96 }] }}
  />
</Pressable>


      {/* Кнопка ректификации */}
      <View style={{ height: 10 }} />
      <Pressable
        onPress={() => router.push({ pathname: '/modal', params: { mode: 'rectification' } })}
        style={[s.btn, s.outline, { alignSelf: 'flex-start' }]}
      >
        <Text style={s.btnText}>Ректификация</Text>
      </Pressable>
    </Card>
  );
}


/* Место рождения + Проживание */
function ScreenBirthPlaceWithLive(props: {
  placeQuery: string;
  setPlaceQuery: (t: string) => void;
  pickedGeo: PickedGeo | null;
  setPickedGeo: (g: PickedGeo | null) => void;
  suggest: PickedGeo[];
  showSuggest: boolean;
  setShowSuggest: (v: boolean) => void;
  livesElsewhere: boolean;
  setLivesElsewhere: (v: boolean) => void;
  currentCity: string;
  setCurrentCity: (t: string) => void;
}) {
  const {
    placeQuery, setPlaceQuery, pickedGeo, setPickedGeo,
    suggest, showSuggest, setShowSuggest,
    livesElsewhere, setLivesElsewhere, currentCity, setCurrentCity
  } = props;

  const listRef = useRef<FlatList<PickedGeo>>(null);

  // ── Локальные стейты для автодополнения «Проживание»
  const [liveSuggest, setLiveSuggest] = useState<PickedGeo[]>([]);
  const [showLiveSuggest, setShowLiveSuggest] = useState<boolean>(false);
  const liveSeqRef = useRef(0);

  // Дебаунс-поиск для поля «Проживание»
  useEffect(() => {
    if (!livesElsewhere) {
      setLiveSuggest([]);
      setShowLiveSuggest(false);
      return;
    }
    let t: ReturnType<typeof setTimeout> | null = null;
    const q = currentCity.trim();
    if (q.length >= 2) {
      t = setTimeout(async () => {
        const mySeq = ++liveSeqRef.current;
        try {
          const res = await searchPlaces(q);
          if (mySeq !== liveSeqRef.current) return;
          const items: PickedGeo[] = (res.items || []).map((it: any) => ({
            id: it.id,
            city: it.city,
            nation: it.nation || null,
            lat: it.lat,
            lng: it.lng,
            tz: it.tz || null,
            displayName: it.displayName,
          }));
          setLiveSuggest(items);
          setShowLiveSuggest(true);
        } catch {
          if (mySeq !== liveSeqRef.current) return;
          setLiveSuggest([]);
          setShowLiveSuggest(false);
        }
      }, 250);
    } else {
      setLiveSuggest([]);
      setShowLiveSuggest(false);
    }
    return () => { if (t) clearTimeout(t); };
  }, [currentCity, livesElsewhere]);

  return (
    <Card title="Место рождения и проживание">
      {/* Место рождения */}
      <Input
        value={placeQuery}
        onChangeText={(t: string) => { setPlaceQuery(t); setPickedGeo(null); }}
        placeholder="Начни вводить (пример: Москва, RU)"
        onFocus={() => placeQuery.trim().length >= 2 && setShowSuggest(true)}
        onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
      />
      {showSuggest && suggest.length > 0 && (
        <View style={s.suggestBox}>
          <FlatList
            ref={listRef}
            keyboardShouldPersistTaps="handled"
            data={suggest}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setPlaceQuery(item.displayName);
                  setPickedGeo(item);
                  setShowSuggest(false);
                }}
                style={s.suggestItem}
              >
                <Text style={{ color: '#fff' }}>{item.displayName}</Text>
                <Text style={{ color: '#9aa0aa', fontSize: 12 }}>
                  {item.lat.toFixed(4)}, {item.lng.toFixed(4)} {item.tz ? `• ${item.tz}` : ''}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
      <Hint>Выбери вариант из подсказок.</Hint>

      {/* Проживание */}
      <View style={{ height: 12 }} />
      <Text style={s.h1}>Проживание</Text>

      {/* Тумблер в стиле "Не знаю точное время" */}
      <Pressable
        onPress={() => setLivesElsewhere(!livesElsewhere)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 10,
          paddingVertical: 6,
        }}
        hitSlop={8}
      >
        <Text style={[s.label, { fontSize: 15, fontWeight: '700' }]}>
          Проживаю в другом месте
        </Text>
        <Switch
          value={livesElsewhere}
          onValueChange={(v) => setLivesElsewhere(v)}
          ios_backgroundColor="rgba(255,255,255,0.2)"
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#4f46e5' }}
          thumbColor={'#ffffff'}
          style={{ marginLeft: 12, transform: [{ scaleX: 0.96 }, { scaleY: 0.96 }] }}
        />
      </Pressable>

      {livesElsewhere && (
        <View style={{ position: 'relative', marginTop: 6 }}>
          <Input
            value={currentCity}
            onChangeText={(t: string) => setCurrentCity(t)}
            placeholder="Текущий город (например: Стамбул, TR)"
            onFocus={() => currentCity.trim().length >= 2 && setShowLiveSuggest(true)}
            onBlur={() => setTimeout(() => setShowLiveSuggest(false), 120)}
          />
          {showLiveSuggest && liveSuggest.length > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 48,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(20,20,22,0.98)',
                borderColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderRadius: 8,
                maxHeight: 240,
                overflow: 'hidden',
                zIndex: 20,
                elevation: 12,
              }}
            >
              <FlatList
                keyboardShouldPersistTaps="handled"
                data={liveSuggest}
                keyExtractor={(it) => it.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      setCurrentCity(item.displayName);
                      setShowLiveSuggest(false);
                    }}
                    style={s.suggestItem}
                  >
                    <Text style={{ color: '#fff' }}>{item.displayName}</Text>
                    <Text style={{ color: '#9aa0aa', fontSize: 12 }}>
                      {item.lat.toFixed(4)}, {item.lng.toFixed(4)} {item.tz ? `• ${item.tz}` : ''}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>
      )}
    </Card>
  );
}



/* Финал */
function ScreenReview({ onRect }: { onRect: () => void }) {
  return (
    <Card title="Финальный шаг">
      <Text style={s.p}>Если не знаешь точное время рождения — можно уточнить.</Text>
      <Pressable onPress={onRect} style={[s.btn, s.ghost, { alignSelf: 'flex-start' }]}>
        <Text style={s.btnText}>Пройти ректификацию</Text>
      </Pressable>
      <Hint>Нажми «Сохранить анкету», чтобы завершить мастер.</Hint>
    </Card>
  );
}

/* ────────── Пикеры ────────── */

function PickerColumnNumber({
  title,
  data,
  selected,
  onSelect,
  flex = 1,
  style,
  listHeight,
  format,
}: {
  title: string;
  data: number[];
  selected: number;
  onSelect: (n: number) => void;
  flex?: number;
  style?: any;
  listHeight?: number;
  format?: (n: number) => string;
}) {
  return (
    <View style={[s.col, style, { flex }]}>
      <Text style={s.colTitle}>{title}</Text>
      <FlatList
        data={data}
        keyExtractor={(n) => String(n)}
        style={[s.colList, listHeight ? { height: listHeight } : null]}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        renderToHardwareTextureAndroid
        removeClippedSubviews
        renderItem={({ item }) => {
          const active = item === selected;
          const text = format ? format(item) : String(item);
          return (
            <Pressable onPress={() => onSelect(item)} style={[s.colItem, active && s.colItemActive]}>
              <Text style={[s.colItemText, active && s.colItemTextActive]}>{text}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function PickerColumnMonth({
  title,
  data,
  selected,
  onSelect,
  flex = 1,
  style,
  listHeight,
}: {
  title: string;
  data: Array<{ n: number; title: string }>;
  selected: number;
  onSelect: (n: number) => void;
  flex?: number;
  style?: any;
  listHeight?: number;
}) {
  return (
    <View style={[s.col, style, { flex }]}>
      <Text style={s.colTitle}>{title}</Text>
      <FlatList
        data={data}
        keyExtractor={(x) => String(x.n)}
        style={[s.colList, listHeight ? { height: listHeight } : null]}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        renderToHardwareTextureAndroid
        removeClippedSubviews
        renderItem={({ item }) => {
          const active = item.n === selected;
          return (
            <Pressable onPress={() => onSelect(item.n)} style={[s.colItem, active && s.colItemActive]}>
              <Text numberOfLines={1} style={[s.colItemText, active && s.colItemTextActive]}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        s.tag,
        value && s.tagOn,
        { paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
      ]}
    >
      <Text style={{ color: value ? '#fff' : C.text, fontWeight: '700' }}>
        {value ? 'Да' : 'Нет'}
      </Text>
    </Pressable>
  );
}


/* ────────── Стили ────────── */

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  h1: { color: '#fff', fontWeight: '800', fontSize: 20 },
  p: { color: C.text, fontSize: 14, lineHeight: 20 },

  nav: { flexDirection: 'row', gap: 10, marginTop: 16 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: C.text, fontWeight: '700' },
  primary: { backgroundColor: C.primary, borderColor: C.primary },
  ghost: { backgroundColor: 'transparent' },
  outline: { borderWidth: 1, borderColor: C.primary, backgroundColor: 'transparent' },

  progressWrap: { flexDirection: 'row', gap: 6, marginBottom: 6, justifyContent: 'center' },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: C.border,
  },
  tagOn: { backgroundColor: C.primary, borderColor: C.primary },

  suggestBox: {
    position: 'absolute',
    top: 86,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,22,0.98)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 20,
  },
  suggestItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },

  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
  },
  modalCard: {
    backgroundColor: C.bg,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignSelf: 'center',
  },

  pickerRow: { flexDirection: 'row' },

  col: {
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  colTitle: {
    color: C.dim,
    fontSize: 12,
    paddingVertical: 6,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  colList: { height: 280 },
  colItem: { paddingVertical: 10, paddingHorizontal: 12 },
  colItemActive: { backgroundColor: 'rgba(79,70,229,0.18)' },
  colItemText: { color: C.text, fontSize: 16 },
  colItemTextActive: { color: '#fff', fontWeight: '800' },

  label: { color: C.text, fontSize: 13, fontWeight: '500' },
});
