// app/(tabs)/compatibility.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useProfiles } from '../../src/store/profiles';

type CompatKey = 'partner' | 'boss' | 'parent' | 'child' | 'general';

type CompatItem = {
  key: CompatKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'] | React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconSet?: 'ion' | 'mci';
  prompt: string;
};

export default function CompatibilityScreen() {
  const [selected, setSelected] = useState<CompatKey | null>(null);
  const router = useRouter();
  const { me, other } = useProfiles();

  const items = useMemo<CompatItem[]>(
    () => [
      {
        key: 'partner',
        title: 'Совместимость с партнёром',
        subtitle: 'Романтическая пара',
        icon: 'heart-outline',
        prompt:
          'Требует данные о рождении обоих лиц. Выполни анализ синастрии, сосредоточившись на ключевых межпланетных аспектах между картой пользователя и картой партнера (Солнце-Луна, Венера-Марс, Асцендент, Десцендент, узловая ось, показатели композитной карты). Опиши области романтической гармонии, эмоциональной связи, потенциальных трений и кармических связей в их интимных отношениях.',
      },
      {
        key: 'boss',
        title: 'Совместимость с начальником/властью',
        subtitle: 'Босс и авторитетные фигуры',
        iconSet: 'mci',
        icon: 'briefcase-outline',
        prompt:
          'Требует данные о рождении обоих лиц (пользователя и авторитетной фигуры). Выполни анализ синастрии, сосредоточившись на ключевых межпланетных аспектах, относящихся к динамике власти, профессиональной иерархии и публичному/карьерному взаимодействию (например, Солнце-Сатурн, Марс-Сатурн, Солнце-Середина Неба, Марс-Середина Неба, управитель 10-го дома пользователя к планетам авторитетной фигуры). Опиши динамику власти, потенциал для поддержки или вызова, а также то, как власть воспринимается между ними.',
      },
      {
        key: 'parent',
        title: 'Совместимость с родителями',
        subtitle: 'Мама и/или Папа',
        icon: 'home-outline',
        prompt:
          'Требует данные о рождении обоих лиц (пользователя и родителя). Выполни анализ синастрии, сосредоточившись на ключевых межпланетных аспектах между картой пользователя и картой родителя (например, Солнце-Солнце/Луна, аспекты Сатурна, связи 4-го/10-го домов). Опиши основные динамики, эмоциональные паттерны, кармические связи и уроки, присутствующие в отношениях родитель-ребенок. Если предоставлены данные обоих родителей, проанализируй карту пользователя индивидуально по отношению к каждому родителю, выделяя различия в динамике.',
      },
      {
        key: 'child',
        title: 'Совместимость с детьми',
        subtitle: 'Ребёнок ↔ Родитель',
        icon: 'sparkles-outline',
        prompt:
          'Требует данные о рождении обоих лиц (родителя и ребенка). Выполни анализ синастрии, сосредоточившись на ключевых межпланетных аспектах между картой пользователя и картой ребенка (Луна-Луна, Солнце-Луна, аспекты Сатурна, аспекты Юпитера, узловые связи). Опиши родительскую динамику, области естественного понимания, потенциальные уроки роста для обоих, а также то, как карта ребенка влияет на опыт родителя.',
      },
      {
        key: 'general',
        title: 'Совместимость с любым человеком',
        subtitle: 'Коллега, друг, знакомый',
        icon: 'people-outline',
        prompt:
          'Требует данные о рождении обоих лиц. Выполни анализ синастрии, сосредоточившись на ключевых межпланетных аспектах, релевантных для общей межличностной динамики (например, Солнце-Солнце, Луна-Луна, Меркурий-Меркурий, Асцендент, Венера-Венера, Марс-Марс). Опиши области естественного понимания, стили общения, эмоциональный резонанс и потенциальные области трения или вызовов.',
      },
    ],
    []
  );

  const selectedItem = items.find((i) => i.key === selected) || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={styles.title}>Совместимость</Text>

        {/* Current profiles snapshot */}
        <View style={styles.snapshot}>
          <Text style={styles.snapTitle}>Мои данные</Text>
          <Text style={styles.snapText}>
            {me ? `${me.name} • ${me.date}${me.time ? ' ' + me.time : ''}${me.place ? ' • ' + me.place : ''}` : 'Не заполнено'}
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: '/modal', params: { mode: 'me' } })}
            style={styles.linkBtn}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.linkText}>Изменить мою анкету</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.snapTitle}>Другой человек</Text>
          <Text style={styles.snapText}>
            {other ? `${other.name} • ${other.date}${other.time ? ' ' + other.time : ''}${other.place ? ' • ' + other.place : ''}` : 'Не заполнено'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Pressable
              onPress={() => router.push({ pathname: '/modal', params: { mode: 'other' } })}
              style={styles.primaryBtn}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Анкета другого человека</Text>
            </Pressable>
          </View>
        </View>

        {/* Choice grid */}
        <Text style={styles.sectionTitle}>Выберите тип совместимости</Text>
        <View style={styles.grid}>
          {items.map((it) => (
            <CompatTile
              key={it.key}
              item={it}
              active={selected === it.key}
              onPress={() => setSelected(it.key)}
            />
          ))}
        </View>

        {/* Preview of n8n flow */}
        {selectedItem ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{selectedItem.title}</Text>
            <Text style={styles.previewSub}>Что сделаем после подключения n8n:</Text>

            <Step>Отправим в n8n: тип "{selectedItem.key}", данные пользователя и другого человека.</Step>
            <Step>Промпт для AI:</Step>
            <View style={styles.promptBox}><Text style={styles.prompt}>{selectedItem.prompt}</Text></View>
            <Step>Полученный ответ отрисуем в отчёте ниже с выводом сильных и слабых зон, рекомендаций.</Step>

            <Pressable
              onPress={() => {
                if (!me || !other) {
                  Alert.alert('Нужны анкеты', 'Заполните обе анкеты, чтобы смоделировать отчёт.');
                  return;
                }
                Alert.alert('Мок-отправка', 'Симуляция запроса в n8n завершена.');
              }}
              style={[styles.primaryBtn, { alignSelf: 'flex-start', marginTop: 8 }]}
            >
              <Ionicons name="sparkles-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>Смоделировать отчёт</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* UI helpers */

function Step({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 6 }}>
      <View style={{ width: 6, height: 6, backgroundColor: '#4f46e5', borderRadius: 3, marginTop: 8 }} />
      <Text style={{ color: '#e5e7eb', fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

function CompatTile({
  item,
  active,
  onPress,
}: {
  item: CompatItem;
  active: boolean;
  onPress: () => void;
}) {
  const IconAny = item.iconSet === 'mci' ? MaterialCommunityIcons : Ionicons;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, active && styles.tileActive]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <IconAny
        name={item.icon as any}
        size={20}
        color={active ? '#fff' : '#c7c9d1'}
        style={{ marginBottom: 8 }}
      />
      <Text style={[styles.tileTitle, active && { color: '#fff' }]}>{item.title}</Text>
      <Text style={styles.tileSub}>{item.subtitle}</Text>
    </Pressable>
  );
}

/* Styles */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0b0c' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },

  snapshot: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  snapTitle: { color: '#cfd2da', fontSize: 13, fontWeight: '700' },
  snapText: { color: '#e5e7eb', fontSize: 14, marginTop: 2 },
  linkBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
  },
  linkText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 10 },

  sectionTitle: { color: '#c7c9d1', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  tile: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  tileActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  tileTitle: { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },
  tileSub: { color: '#a3a6ae', fontSize: 12, marginTop: 4 },

  previewCard: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  previewSub: { color: '#c7c9d1', fontSize: 13, marginTop: 6 },

  promptBox: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  prompt: { color: '#dfe3ef', fontSize: 13, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
