// app/modal.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { newId, PersonProfile, useProfiles } from '../src/store/profiles';

function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ gap: 6 }, style]}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor="#8b8e97"
    />
  );
}

const genders = [
  { key: 'male', label: 'Мужской' },
  { key: 'female', label: 'Женский' },
  { key: 'other', label: 'Другое' },
  { key: 'na', label: 'Не указывать' },
] as const;

export default function ProfileModal() {
  const { mode } = useLocalSearchParams<{ mode?: 'me' | 'other' }>();
  const isMe = mode === 'me';

  const { me, other, setMe, setOther } = useProfiles();
  const initial = useMemo<PersonProfile | null>(() => (isMe ? me : other), [isMe, me, other]);

  // --- form state
  const [name, setName] = useState(initial?.name ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDateISO ?? ''); // YYYY-MM-DD
  const [timeKnown, setTimeKnown] = useState(initial?.timeKnown ?? true);
  const [birthTime, setBirthTime] = useState(initial?.time ?? '');          // HH:mm
  const [useSeconds, setUseSeconds] = useState(!!initial?.seconds);
  const [seconds, setSeconds] = useState(initial?.seconds ? String(initial.seconds).padStart(2, '0') : '');
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? initial?.place ?? '');
  const [livesElsewhere, setLivesElsewhere] = useState(initial?.livesElsewhere ?? false);
  const [currentCity, setCurrentCity] = useState(initial?.currentCity ?? '');
  const [gender, setGender] = useState<PersonProfile['gender']>(initial?.gender ?? 'na');
  const [email, setEmail] = useState(initial?.email ?? '');

  const router = useRouter();

  const validate = () => {
    if (!name.trim()) {
      Alert.alert('Проверьте поля', 'Имя обязательно.');
      return false;
    }
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Проверьте поля', 'Дата рождения в формате ГГГГ-ММ-ДД обязательна.');
      return false;
    }
    if (timeKnown) {
      if (!birthTime.match(/^\d{2}:\d{2}$/)) {
        Alert.alert('Проверьте поля', 'Время рождения в формате ЧЧ:ММ обязательно (или отключите переключатель «Не знаю время»).');
        return false;
      }
      if (useSeconds) {
        const s = Number(seconds);
        if (!(seconds.match(/^\d{2}$/) && s >= 0 && s <= 59)) {
          Alert.alert('Проверьте поля', 'Секунды — от 00 до 59.');
          return false;
        }
      }
    }
    if (!birthPlace.trim()) {
      Alert.alert('Проверьте поля', 'Место рождения обязательно.');
      return false;
    }
    if (livesElsewhere && !currentCity.trim()) {
      Alert.alert('Проверьте поля', 'Укажите текущий город проживания или отключите «Проживаю в другом месте».');
      return false;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Проверьте поля', 'Email указан в неверном формате.');
      return false;
    }
    return true;
  };

  const submit = () => {
    if (!validate()) return;

    const payload: PersonProfile = {
      id: initial?.id ?? newId(),
      name: name.trim(),
      // базовые (обратная совместимость)
      date: birthDate,                // оставим старые поля, если где-то используются
      time: timeKnown ? birthTime : undefined,
      place: birthPlace,
      // новые
      birthDateISO: birthDate,
      timeKnown,
      seconds: timeKnown && useSeconds ? Number(seconds) : undefined,
      birthPlace,
      livesElsewhere,
      currentCity: livesElsewhere ? currentCity : undefined,
      gender,
      email: email.trim() || undefined,
      // удобный full timestamp (если есть точное время)
      fullDateTimeISO:
        timeKnown
          ? `${birthDate}T${birthTime}:${useSeconds ? seconds : '00'}`
          : undefined,
    };

    isMe ? setMe(payload) : setOther(payload);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isMe ? 'Астрологическая анкета' : 'Анкета (другой человек)',
          presentation: 'modal',
        }}
      />
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={styles.caption}>
            Укажите данные рождения. Позже можно будет включить автоподсказки городов и автоматический часовой пояс.
          </Text>

          <Row>
            <Label>Имя *</Label>
            <Input value={name} onChangeText={setName} placeholder="Иван / Анна" />
          </Row>

          <Row>
            <Label>Дата рождения (ГГГГ-ММ-ДД) *</Label>
            <Input
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="1995-06-15"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          </Row>

          <View style={styles.switchLine}>
            <Label>Не знаю время рождения</Label>
            <Switch value={!timeKnown} onValueChange={(v) => setTimeKnown(!v)} />
          </View>

          {timeKnown && (
            <>
              <Row>
                <Label>Время рождения (ЧЧ:ММ) *</Label>
                <Input
                  value={birthTime}
                  onChangeText={setBirthTime}
                  placeholder="14:05"
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </Row>

              <View style={styles.switchLine}>
                <Label>Указать секунды</Label>
                <Switch value={useSeconds} onValueChange={setUseSeconds} />
              </View>

              {useSeconds && (
                <Row style={{ width: 120 }}>
                  <Label>Секунды</Label>
                  <Input
                    value={seconds}
                    onChangeText={(t) => setSeconds(t.replace(/\D/g, '').slice(0, 2))}
                    placeholder="00"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={2}
                  />
                </Row>
              )}
            </>
          )}

          <Row>
            <Label>Место рождения *</Label>
            <Input
              value={birthPlace}
              onChangeText={setBirthPlace}
              placeholder="Город, страна (пример: Москва, Россия)"
            />
          </Row>

          <View style={styles.checkboxLine}>
            <Text style={styles.label}>Проживаю в другом месте</Text>
            <Switch value={livesElsewhere} onValueChange={setLivesElsewhere} />
          </View>

          {livesElsewhere && (
            <Row>
              <Label>Город проживания *</Label>
              <Input
                value={currentCity}
                onChangeText={setCurrentCity}
                placeholder="Текущий город (пример: Стамбул, Турция)"
              />
            </Row>
          )}

          <Row>
            <Label>Пол *</Label>
            <View style={styles.genderWrap}>
              {genders.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  style={[styles.genderBtn, gender === g.key && styles.genderBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.genderText, gender === g.key && styles.genderTextActive]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          </Row>

          <Row>
            <Label>Email (необязательно)</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Row>

          <Pressable style={styles.primaryBtn} onPress={submit} accessibilityRole="button">
            <Text style={styles.primaryText}>Сохранить</Text>
          </Pressable>

          <Text style={styles.helper}>
            Позже можно добавить автопоиск мест (Nominatim/Places), выбор часового пояса и проверку даты/времени виджетами.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
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
  genderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  genderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  genderBtnActive: {
    backgroundColor: 'rgba(79,70,229,0.18)',
    borderColor: 'rgba(79,70,229,0.35)',
  },
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
});
