// app/modal.tsx
import { searchPlaces } from '@/src/shared/api/profiles';
import { useT } from '@/src/shared/i18n';
import { newId, PersonProfile, useProfiles } from '@/src/store/profiles';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

/* ────────── Small UI helpers ────────── */
function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ gap: 6 }, style]}>{children}</View>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#8b8e97" />;
}

const genderKeys = ['male', 'female', 'other', 'na'] as const;

type ModeParam = 'me' | 'other' | 'rectification' | undefined;

type PickedGeo = {
  id: string;
  city: string;
  nation: string | null;
  lat: number;
  lng: number;
  tz: string | null;
  displayName: string;
};

export default function RootModal() {
  const { mode } = useLocalSearchParams<{ mode?: ModeParam }>();
  const t = useT();
  const headerTitle =
    mode === 'rectification' ? t.modal.titleRect : mode === 'other' ? t.modal.titleOther : t.modal.titleMe;

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          presentation: 'modal',
          headerShown: true,
          headerStyle: { backgroundColor: '#0e0f12' },
          headerTitleStyle: { color: '#fff', fontWeight: '700' },
          headerTintColor: '#fff',
        }}
      />
      <SafeAreaView style={styles.safe}>
        {mode === 'rectification' ? <RectificationBody /> : <ProfileBody mode={mode} />}
      </SafeAreaView>
    </>
  );
}

/* ────────── Rectification modal (wizard) ────────── */
type SignSlice = {
  id: string;
  fromISO: string;
  toISO: string;
  what: 'SUN_SIGN' | 'MOON_SIGN' | 'ASC_SIGN';
  aLabel: string;
  bLabel: string;
  aDesc: string;
  bDesc: string;
};

type PredispositionCode =
  | 'early_marriage'
  | 'late_child'
  | 'music_success'
  | 'law_success'
  | 'religion_success'
  | 'foreign_marriage'
  | 'imprisonment'
  | 'water_extreme';

type Likert = 1 | 2 | 3 | 4 | 5;

type PredAnswer = { code: PredispositionCode; value: Likert; enabled: boolean };

type LifeEventKind = 'MARRIAGE' | 'DIVORCE' | 'CHILD_BIRTH' | 'RELATIVE_DEATH' | 'HOSPITAL' | 'INJURY' | 'EXTREME';

type LifeEvent = { id: string; kind: LifeEventKind; month: string; year: string };

function RectificationBody() {
  const router = useRouter();
  const t = useT();
  const me = useProfiles((s) => s.me);
  const loading = useProfiles((s) => s.loading);
  const submitOnboarding = useProfiles((s) => s.submitOnboarding);

  const safeBack = (fallback: string) => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };

  // ---- guard: no profile
  if (!me) {
    return (
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.caption}>{t.modal.noProfileMsg}</Text>
          <Pressable onPress={() => safeBack('/(tabs)/settings')} style={[styles.primaryBtn, { backgroundColor: '#6b7280' }]}>
            <Text style={styles.primaryText}>{t.common.ok}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const birthDate = me.birthDateISO ?? me.date;

  // ---- guard: no birthDate
  if (!birthDate) {
    return (
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.caption}>{t.modal.noBirthDateMsg}</Text>
          <Pressable onPress={() => safeBack('/(tabs)/settings')} style={[styles.primaryBtn, { backgroundColor: '#6b7280' }]}>
            <Text style={styles.primaryText}>{t.common.ok}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  /* ── Steps ── */
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const initTime = (me.time ?? '12:00').split(':');
  const [centerH, setCenterH] = useState<number>(+initTime[0] || 12);
  const [centerM, setCenterM] = useState<number>(+initTime[1] || 0);
  const [rangeMin, setRangeMin] = useState<number>(me.time ? 40 : 12 * 60);
  const fmt2 = (n: number) => String(Math.max(0, Math.min(59, n))).padStart(2, '0');

  const [slices, setSlices] = useState<SignSlice[]>([]);
  const [slicePick, setSlicePick] = useState<Record<string, 'A' | 'B' | null>>({});

  const [ascPick, setAscPick] = useState<{
    sign?: string;
    psychology?: string;
    appearance?: string;
    altruism?: string;
    values?: string;
  }>({});

  const allPreds: PredAnswer[] = [
    { code: 'early_marriage', value: 3, enabled: true },
    { code: 'late_child', value: 3, enabled: true },
    { code: 'music_success', value: 3, enabled: true },
    { code: 'law_success', value: 3, enabled: true },
    { code: 'religion_success', value: 3, enabled: true },
    { code: 'foreign_marriage', value: 3, enabled: true },
    { code: 'imprisonment', value: 3, enabled: true },
    { code: 'water_extreme', value: 3, enabled: true },
  ];
  const [preds, setPreds] = useState<PredAnswer[]>(allPreds);

  const baseEvents: LifeEvent[] = [
    { id: 'e1', kind: 'MARRIAGE', month: '', year: '' },
    { id: 'e2', kind: 'DIVORCE', month: '', year: '' },
    { id: 'e3', kind: 'CHILD_BIRTH', month: '', year: '' },
    { id: 'e4', kind: 'RELATIVE_DEATH', month: '', year: '' },
    { id: 'e5', kind: 'HOSPITAL', month: '', year: '' },
    { id: 'e6', kind: 'INJURY', month: '', year: '' },
    { id: 'e7', kind: 'EXTREME', month: '', year: '' },
  ];
  const [events, setEvents] = useState<LifeEvent[]>(baseEvents);

  const [candidates, setCandidates] = useState<{ iso: string; score: number; reasons: string[] }[]>([]);
  const [saving, setSaving] = useState(false);

  async function apiRectifyInit() {
    const date = birthDate;
    const base = `${date}T${fmt2(centerH)}:${fmt2(centerM)}:00Z`;
    const mock: SignSlice[] = [
      {
        id: 's1',
        fromISO: base,
        toISO: base,
        what: 'SUN_SIGN',
        aLabel: 'Солнце (вариант A)',
        bLabel: 'Солнце (вариант B)',
        aDesc: 'Экстраверсия, прямолинейность.',
        bDesc: 'Сдержанность, структура, долг.',
      },
      {
        id: 's2',
        fromISO: base,
        toISO: base,
        what: 'ASC_SIGN',
        aLabel: 'ASC вариант 1',
        bLabel: 'ASC вариант 2',
        aDesc: 'Психология: импульс; интересы: спорт/борьба.',
        bDesc: 'Психология: анализ; интересы: порядок/сервис.',
      },
    ];
    setSlices(mock);
    setSlicePick(Object.fromEntries(mock.map((s) => [s.id, null])));
  }

  async function apiRectifyAscCommit() {
    return true;
  }

  async function apiScoreAll() {
    const date = birthDate;
    const base = (hh: number, mm: number) => `${date}T${fmt2(hh)}:${fmt2(mm)}:00`;
    const s = (code: PredispositionCode) => preds.find((p) => p.code === code)?.value ?? 3;

    const score1 = 10 + (slicePick['s1'] === 'A' ? 3 : 0) + (slicePick['s2'] === 'A' ? 3 : 0) + s('music_success') + s('early_marriage');
    const score2 = 10 + (slicePick['s1'] === 'B' ? 3 : 0) + (slicePick['s2'] === 'B' ? 3 : 0) + s('law_success') + s('late_child');

    const res = [
      { iso: base(centerH, Math.max(0, centerM - 5)), score: score1, reasons: ['Солнце: вариант A', 'ASC: вариант A', 'Музыка/ранний брак'] },
      { iso: base(centerH, Math.min(59, centerM + 7)), score: score2, reasons: ['Солнце: вариант B', 'ASC: вариант B', 'Юриспруденция/поздний ребёнок'] },
    ].sort((a, b) => b.score - a.score);

    setCandidates(res);
  }

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const fmtH = (n: number) => String(clamp(n, 0, 23)).padStart(2, '0');

  const next0 = async () => {
    if (!me?.coords || !me?.tz) {
      Alert.alert(t.modal.titleRect, t.modal.rectCoordsMissing);
      return;
    }
    await apiRectifyInit();
    setStep(1);
  };

  const next1 = () => {
    const any = Object.values(slicePick).some((v) => v != null);
    if (!any && slices.length > 0) {
      Alert.alert(t.modal.rectStep1Title, t.modal.rectChooseVariant);
      return;
    }
    setStep(2);
  };

  const next2 = async () => {
    await apiRectifyAscCommit();
    setStep(3);
  };

  const next3 = () => setStep(4);

  const next4 = async () => {
    await apiScoreAll();
    setStep(5);
  };

  const saveCandidate = async (iso: string) => {
    try {
      setSaving(true);
      const HH = iso.slice(11, 13);
      const MM = iso.slice(14, 16);
      const SS = '00';

      await submitOnboarding({
        ...me,
        timeKnown: true,
        time: `${HH}:${MM}`,
        seconds: Number(SS),
        fullDateTimeISO: `${birthDate}T${HH}:${MM}:${SS}`,
      });

      safeBack('/(tabs)/astro-map');
    } catch (e: any) {
      Alert.alert(t.modal.saveSuccess, e?.message || t.modal.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: 24 }]}>
        <Text style={styles.caption}>{t.modal.rectStep(step + 1)}</Text>

        {step === 0 && (
          <>
            <Text style={[styles.label, { marginTop: 6 }]}>{t.modal.rectCenterTime}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 80 }}>
                <Label>{t.profileWizard.hours}</Label>
                <Input
                  value={fmtH(centerH)}
                  maxLength={2}
                  keyboardType="number-pad"
                  onChangeText={(v) => setCenterH(clamp(parseInt((v || '0').replace(/\D/g, ''), 10) || 0, 0, 23))}
                />
              </View>
              <View style={{ width: 80 }}>
                <Label>{t.profileWizard.minutes}</Label>
                <Input
                  value={fmt2(centerM)}
                  maxLength={2}
                  keyboardType="number-pad"
                  onChangeText={(v) => setCenterM(clamp(parseInt((v || '0').replace(/\D/g, ''), 10) || 0, 0, 59))}
                />
              </View>
            </View>

            <View style={{ height: 8 }} />
            <Label>{t.modal.rectRange}</Label>
            <Input
              value={String(rangeMin)}
              keyboardType="number-pad"
              onChangeText={(v) => setRangeMin(Math.max(1, parseInt(v.replace(/\D/g, '') || '0', 10)))}
              placeholder={t.modal.rectRangePlaceholder}
            />

            <Pressable onPress={next0} style={[styles.primaryBtn, { backgroundColor: '#4f46e5' }]}>
              <Text style={styles.primaryText}>{t.common.continue}</Text>
            </Pressable>

            <Text style={styles.helper}>{t.modal.rectRangeHint}</Text>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={[styles.label, { marginBottom: 6 }]}>{t.modal.rectStep1Title}</Text>
            {slices.length === 0 && <Text style={styles.caption}>{t.modal.rectStep1NoTransits}</Text>}
            {slices.map((sl) => (
              <View key={sl.id} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#cfd3dc', marginBottom: 6, fontWeight: '700' }}>
                  {sl.what === 'SUN_SIGN' ? t.modal.rectSunSign : sl.what === 'MOON_SIGN' ? t.modal.rectMoonSign : t.modal.rectAscSign}
                </Text>

                <ToggleAB
                  aTitle={sl.aLabel}
                  bTitle={sl.bLabel}
                  aDesc={sl.aDesc}
                  bDesc={sl.bDesc}
                  value={slicePick[sl.id]}
                  onChange={(v) => setSlicePick((p) => ({ ...p, [sl.id]: v }))}
                />
              </View>
            ))}
            <WizardNav onBack={() => setStep(0)} onNext={next1} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[styles.label, { marginBottom: 6 }]}>{t.modal.rectStep2Title}</Text>
            <Text style={styles.helper}>{t.modal.rectStep2Hint}</Text>

            <Row>
              <Label>{t.modal.rectStep2Psychology}</Label>
              <Input value={ascPick.psychology ?? ''} onChangeText={(v) => setAscPick((p) => ({ ...p, psychology: v }))} placeholder="…" />
            </Row>
            <Row>
              <Label>{t.modal.rectStep2Appearance}</Label>
              <Input value={ascPick.appearance ?? ''} onChangeText={(v) => setAscPick((p) => ({ ...p, appearance: v }))} placeholder="…" />
            </Row>
            <Row>
              <Label>{t.modal.rectStep2Altruism}</Label>
              <Input value={ascPick.altruism ?? ''} onChangeText={(v) => setAscPick((p) => ({ ...p, altruism: v }))} placeholder="…" />
            </Row>
            <Row>
              <Label>{t.modal.rectStep2Values}</Label>
              <Input value={ascPick.values ?? ''} onChangeText={(v) => setAscPick((p) => ({ ...p, values: v }))} placeholder="…" />
            </Row>

            <WizardNav onBack={() => setStep(1)} onNext={next2} />
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[styles.label, { marginBottom: 6 }]}>{t.modal.rectStep3Title}</Text>
            <Text style={styles.helper}>{t.modal.rectStep3Scale}</Text>
            {preds.map((p, idx) => (
              <View key={p.code} style={{ marginBottom: 10 }}>
                <Text style={{ color: '#cfd3dc', marginBottom: 6 }}>
                  {t.modal.predispositions[p.code]}
                </Text>
                <LikertRow
                  value={p.value as Likert}
                  likert={t.modal.likert as unknown as string[]}
                  onChange={(v) =>
                    setPreds((prev) => {
                      const copy = [...prev];
                      copy[idx] = { ...p, value: v };
                      return copy;
                    })
                  }
                />
              </View>
            ))}
            <WizardNav onBack={() => setStep(2)} onNext={next3} />
          </>
        )}

        {step === 4 && (
          <>
            <Text style={[styles.label, { marginBottom: 6 }]}>{t.modal.rectStep4Title}</Text>
            <Text style={styles.helper}>{t.modal.rectStep4Hint}</Text>

            <View style={{ gap: 10 }}>
              {events.map((ev, i) => (
                <EventRow
                  key={ev.id}
                  label={t.modal.eventKinds[ev.kind]}
                  }
                  month={ev.month}
                  year={ev.year}
                  onChange={(m, y) => {
                    setEvents((arr) => {
                      const copy = [...arr];
                      copy[i] = { ...ev, month: m, year: y };
                      return copy;
                    });
                  }}
                />
              ))}
            </View>

            <WizardNav onBack={() => setStep(3)} onNext={next4} />
          </>
        )}

        {step === 5 && (
          <>
            <Text style={[styles.label, { marginBottom: 8 }]}>{t.modal.rectStep5Title}</Text>
            {candidates.length === 0 ? (
              <Text style={styles.caption}>{t.modal.noCandidates}</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {candidates.map((c) => (
                  <View key={c.iso} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 4 }}>
                      {new Date(c.iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={{ color: '#9aa0aa', marginBottom: 6 }}>{t.modal.rectScore} {c.score}</Text>
                    {c.reasons.map((r, ri) => (
                      <Text key={ri} style={{ color: '#c7c9d1' }}>
                        • {r}
                      </Text>
                    ))}
                    <Pressable
                      onPress={() => saveCandidate(c.iso)}
                      disabled={saving || loading}
                      style={[styles.primaryBtn, { marginTop: 10, backgroundColor: '#4f46e5', opacity: saving || loading ? 0.7 : 1 }]}
                    >
                      <Text style={styles.primaryText}>{saving ? t.modal.saving : t.modal.selectTime}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 8 }} />
            <Pressable onPress={() => setStep(0)} style={[styles.primaryBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.primaryText}>{t.modal.finish}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Wizard helpers ───────────────────────────────── */
function WizardNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const t = useT();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
      <Pressable onPress={onBack} style={[styles.primaryBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <Text style={styles.primaryText}>{t.modal.back}</Text>
      </Pressable>
      <Pressable onPress={onNext} style={[styles.primaryBtn, { backgroundColor: '#4f46e5', flex: 1 }]}>
        <Text style={styles.primaryText}>{t.modal.forward}</Text>
      </Pressable>
    </View>
  );
}

function ToggleAB(props: {
  aTitle: string;
  bTitle: string;
  aDesc: string;
  bDesc: string;
  value: 'A' | 'B' | null;
  onChange: (v: 'A' | 'B') => void;
}) {
  const { aTitle, bTitle, aDesc, bDesc, value, onChange } = props;
  const Btn = ({ title, desc, active, onPress }: { title: string; desc: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={[
        { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
        {
          borderColor: active ? 'rgba(79,70,229,0.6)' : 'rgba(255,255,255,0.12)',
          backgroundColor: active ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
        },
      ]}
    >
      <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: '#c7c9d1' }}>{desc}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <Btn title={aTitle} desc={aDesc} active={value === 'A'} onPress={() => onChange('A')} />
      <Btn title={bTitle} desc={bDesc} active={value === 'B'} onPress={() => onChange('B')} />
    </View>
  );
}

function LikertRow({ value, likert, onChange }: { value: Likert; likert: string[]; onChange: (v: Likert) => void }) {
  const labels = likert;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Pressable
          key={v}
          onPress={() => onChange(v as Likert)}
          style={[
            { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
            {
              borderColor: value === v ? 'rgba(79,70,229,0.6)' : 'rgba(255,255,255,0.12)',
              backgroundColor: value === v ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
            },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{labels[v - 1]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EventRow({ label, month, year, onChange }: { label: string; month: string; year: string; onChange: (m: string, y: string) => void }) {
  const t = useT();
  return (
    <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 10 }}>
      <Text style={{ color: '#cfd3dc', marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Label>{t.modal.rectEventMonth}</Label>
          <Input value={month} keyboardType="number-pad" placeholder="MM" maxLength={2} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 2), year)} />
        </View>
        <View style={{ flex: 1 }}>
          <Label>{t.modal.rectEventYear}</Label>
          <Input value={year} keyboardType="number-pad" placeholder="YYYY" maxLength={4} onChangeText={(v) => onChange(month, v.replace(/\D/g, '').slice(0, 4))} />
        </View>
      </View>
    </View>
  );
}

/* ────────── Profile modal ────────── */
function ProfileBody({ mode }: { mode: ModeParam }) {
  const isMe = mode !== 'other';
  const t = useT();
  const { me, other, setMe, setOther, sync } = useProfiles();
  const initial = useMemo<PersonProfile | null>(() => (isMe ? me : other), [isMe, me, other]);

  const router = useRouter();
  const safeBack = (fallback: string) => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as any);
  };

  const [name, setName] = useState<string>(initial?.name ?? '');
  const [birthDate, setBirthDate] = useState<string>(initial?.birthDateISO ?? initial?.date ?? '');
  const [timeKnown, setTimeKnown] = useState<boolean>(initial?.timeKnown ?? true);
  const [birthTime, setBirthTime] = useState<string>(initial?.time ?? '');
  const [useSeconds, setUseSeconds] = useState<boolean>(!!initial?.seconds);
  const [seconds, setSeconds] = useState<string>(initial?.seconds ? String(initial?.seconds).padStart(2, '0') : '');
  const [livesElsewhere, setLivesElsewhere] = useState<boolean>(initial?.livesElsewhere ?? false);
  const [currentCity, setCurrentCity] = useState<string>(initial?.currentCity ?? '');
  const [gender, setGender] = useState<PersonProfile['gender']>(initial?.gender ?? 'na');
  const [email, setEmail] = useState<string>(initial?.email ?? '');

  const [placeQuery, setPlaceQuery] = useState<string>(initial?.birthPlace ?? initial?.place ?? '');
  const [pickedGeo, setPickedGeo] = useState<PickedGeo | null>(
    initial?.coords && (initial?.tz || null)
      ? {
          id: 'init',
          city: (initial?.birthPlace || initial?.place || '').split(',')[0].trim() || '',
          nation: null,
          lat: initial.coords.lat,
          lng: initial.coords.lng,
          tz: initial.tz || null,
          displayName: initial?.birthPlace || initial?.place || '',
        }
      : null
  );
  const [suggest, setSuggest] = useState<PickedGeo[]>([]);
  const [showSuggest, setShowSuggest] = useState<boolean>(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const seqRef = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const q = placeQuery.trim();
    if (q.length >= 2) {
      t = setTimeout(async () => {
        const mySeq = ++seqRef.current;
        try {
          const res = await searchPlaces(q);
          if (mySeq !== seqRef.current) return;
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
          if (mySeq !== seqRef.current) return;
          setSuggest([]);
          setShowSuggest(false);
        }
      }, 250);
    } else {
      setSuggest([]);
      setShowSuggest(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [placeQuery]);

  useEffect(() => {
    if (!pickedGeo) return;
    const normalized = `${pickedGeo.city}${pickedGeo.nation ? ', ' + pickedGeo.nation : ''}`;
    if (placeQuery.trim() !== pickedGeo.displayName && placeQuery.trim() !== normalized) {
      setPickedGeo(null);
    }
  }, [placeQuery, pickedGeo]);

  const validate = () => {
    if (!name.trim()) {
      Alert.alert(t.modal.validCheck, t.modal.validName);
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      Alert.alert(t.modal.validCheck, t.modal.validBirthDate);
      return false;
    }
    if (timeKnown) {
      if (!/^\d{2}:\d{2}$/.test(birthTime)) {
        Alert.alert(t.modal.validCheck, t.modal.validBirthTime);
        return false;
      }
      if (useSeconds) {
        const sOk = /^\d{2}$/.test(seconds) && Number(seconds) >= 0 && Number(seconds) <= 59;
        if (!sOk) {
          Alert.alert(t.modal.validCheck, t.modal.validSecondsRange);
          return false;
        }
      }
    }

    if (!pickedGeo) {
      setPlaceError(t.modal.placeSelectError);
      Alert.alert(t.modal.placeLabel, t.modal.placeSelectError);
      return false;
    }

    const normalized = `${pickedGeo.city}${pickedGeo.nation ? ', ' + pickedGeo.nation : ''}`;
    const ok = placeQuery.trim() === pickedGeo.displayName || placeQuery.trim() === normalized;
    if (!ok) {
      setPlaceError(t.modal.placeChangedError);
      Alert.alert(t.modal.placeLabel, t.modal.placeChangedError);
      return false;
    }

    if (livesElsewhere && !currentCity.trim()) {
      Alert.alert(t.modal.validCheck, t.modal.validCurrentCity);
      return false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert(t.modal.validCheck, t.modal.validEmail);
      return false;
    }

    setPlaceError(null);
    return true;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload: PersonProfile = {
      id: initial?.id ?? newId(),
      name: name.trim(),
      date: birthDate,
      time: timeKnown ? birthTime : undefined,
      place: placeQuery,

      birthDateISO: birthDate,
      timeKnown,
      seconds: timeKnown && useSeconds ? Number(seconds) : undefined,
      birthPlace: placeQuery,
      livesElsewhere,
      currentCity: livesElsewhere ? currentCity : undefined,
      gender,
      email: email.trim() || undefined,
      fullDateTimeISO: timeKnown ? `${birthDate}T${birthTime}:${(useSeconds ? seconds : '00').toString().padStart(2, '0')}` : undefined,
      ...(pickedGeo ? { coords: { lat: pickedGeo.lat, lng: pickedGeo.lng }, tz: pickedGeo.tz || undefined } : {}),
    };

    isMe ? setMe(payload) : setOther(payload);

    try {
      await sync();
    } catch (e) {
      console.warn('[profiles] sync failed', e);
    }

    safeBack('/(tabs)/settings');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.caption}>{t.modal.formCaption}</Text>

        <Row>
          <Label>{t.modal.nameLabel}</Label>
          <Input value={name} onChangeText={setName} placeholder={t.modal.namePlaceholder} />
        </Row>

        <Row>
          <Label>{t.modal.birthDateLabel}</Label>
          <Input
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="1995-06-15"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
        </Row>

        <View style={styles.switchLine}>
          <Label>{t.modal.timeUnknown}</Label>
          <Switch value={!timeKnown} onValueChange={(v) => setTimeKnown(!v)} />
        </View>

        {timeKnown && (
          <>
            <Row>
              <Label>{t.modal.birthTimeLabel}</Label>
              <Input
                value={birthTime}
                onChangeText={setBirthTime}
                placeholder="14:05"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
              />
            </Row>

            <View style={styles.switchLine}>
              <Label>{t.modal.useSeconds}</Label>
              <Switch value={useSeconds} onValueChange={setUseSeconds} />
            </View>

            {useSeconds && (
              <Row style={{ width: 120 }}>
                <Label>{t.modal.secondsLabel}</Label>
                <Input
                  value={seconds}
                  onChangeText={(v) => setSeconds(v.replace(/\D/g, '').slice(0, 2))}
                  placeholder="00"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={2}
                />
              </Row>
            )}
          </>
        )}

        <AutocompletePlace
          placeQuery={placeQuery}
          setPlaceQuery={setPlaceQuery}
          pickedGeo={pickedGeo}
          setPickedGeo={setPickedGeo}
          suggest={suggest}
          setSuggest={setSuggest}
          showSuggest={showSuggest}
          setShowSuggest={setShowSuggest}
          placeError={placeError}
          setPlaceError={setPlaceError}
        />

        <View style={styles.checkboxLine}>
          <Text style={styles.label}>{t.modal.livesElsewhere}</Text>
          <Switch value={livesElsewhere} onValueChange={setLivesElsewhere} />
        </View>

        {livesElsewhere && (
          <Row>
            <Label>{t.modal.currentCityLabel}</Label>
            <Input value={currentCity} onChangeText={setCurrentCity} placeholder={t.modal.currentCityPlaceholder} />
          </Row>
        )}

        <Row>
          <Label>{t.modal.genderLabel}</Label>
          <View style={styles.genderWrap}>
            {genderKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => setGender(key)}
                style={[styles.genderBtn, gender === key && styles.genderBtnActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.genderText, gender === key && styles.genderTextActive]}>{t.modal.genders[key]}</Text>
              </Pressable>
            ))}
          </View>
        </Row>

        <Row>
          <Label>{t.modal.emailLabel}</Label>
          <Input value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
        </Row>

        <Pressable style={[styles.primaryBtn, (!pickedGeo || placeError) && { opacity: 0.6 }]} onPress={submit} disabled={!pickedGeo}>
          <Text style={styles.primaryText}>{t.modal.saveBtn}</Text>
        </Pressable>

        <Text style={styles.helper}>{t.modal.profileFormHelper}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ────────── Place autocomplete widget ────────── */
function AutocompletePlace(props: {
  placeQuery: string;
  setPlaceQuery: (t: string) => void;
  pickedGeo: PickedGeo | null;
  setPickedGeo: (g: PickedGeo | null) => void;
  suggest: PickedGeo[];
  setSuggest: (items: PickedGeo[]) => void;
  showSuggest: boolean;
  setShowSuggest: (v: boolean) => void;
  placeError: string | null;
  setPlaceError: (v: string | null) => void;
}) {
  const t = useT();
  const { placeQuery, setPlaceQuery, pickedGeo, setPickedGeo, suggest, setSuggest, showSuggest, setShowSuggest, placeError, setPlaceError } = props;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const q = placeQuery.trim();
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
    return () => {
      if (t) clearTimeout(t);
    };
  }, [placeQuery, setShowSuggest, setSuggest]);

  useEffect(() => {
    if (!pickedGeo) return;
    const normalized = `${pickedGeo.city}${pickedGeo.nation ? ', ' + pickedGeo.nation : ''}`;
    if (placeQuery.trim() !== pickedGeo.displayName && placeQuery.trim() !== normalized) {
      setPickedGeo(null);
    }
  }, [placeQuery, pickedGeo, setPickedGeo]);

  return (
    <Row>
      <Label>{t.modal.placeLabel}</Label>
      <View style={{ position: 'relative' }}>
        <Input
          value={placeQuery}
          onChangeText={(v) => {
            setPlaceQuery(v);
            setPickedGeo(null);
          }}
          placeholder={t.modal.placePlaceholder}
          onFocus={() => placeQuery.trim().length >= 2 && setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
        />
        {!!placeError && <Text style={{ color: '#f87171', marginTop: 4, fontSize: 12 }}>{placeError}</Text>}

        {showSuggest && suggest.length > 0 && (
          <View style={styles.suggestBox}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggest.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setPlaceQuery(item.displayName);
                    setPickedGeo(item);
                    setShowSuggest(false);
                    setPlaceError(null);
                  }}
                  style={styles.suggestItem}
                >
                  <Text style={{ color: '#fff' }}>{item.displayName}</Text>
                  <Text style={{ color: '#9aa0aa', fontSize: 12 }}>
                    {item.lat.toFixed(4)}, {item.lng.toFixed(4)} {item.tz ? `• ${item.tz}` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Row>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  scroll: { flex: 1, backgroundColor: '#0b0b0c' },
  content: { padding: 16, gap: 14 },

  caption: { color: '#c7c9d1', fontSize: 14, lineHeight: 20 },
  label: { color: '#e5e7eb', fontSize: 13 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  switchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkboxLine: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  genderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  genderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  genderBtnActive: { backgroundColor: 'rgba(79,70,229,0.18)', borderColor: 'rgba(79,70,229,0.35)' },
  genderText: { color: '#cfd3dc', fontSize: 13, fontWeight: '600' },
  genderTextActive: { color: '#fff' },

  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  helper: { color: '#9aa0aa', fontSize: 12, marginTop: 8 },

  suggestBox: {
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
  },
  suggestItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
});
