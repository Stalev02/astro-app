// app/(tabs)/astro.tsx
import { ENDPOINTS } from '@/src/shared/config/api';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { SvgXml } from 'react-native-svg';
import { useProfiles } from '../../src/store/profiles';

/* ==================== SVG sanitize (как раньше) ==================== */
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

/* ==================== Типы/моки ==================== */
type AstroStats = {
  sun: string;
  moon: string;
  asc: string;
  elements: { fire: number; earth: number; air: number; water: number };
  modalities: { cardinal: number; fixed: number; mutable: number };
  aspects: { harmonious: number; tense: number; total: number };
};
type Msg = { id: string; role: 'user' | 'bot'; text: string; ts: number };

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

/* ==================== Меню (схема + промпты) ==================== */
type MenuNode =
  | { id: string; title: string; type: 'menu'; nav?: { back?: boolean; home?: boolean }; children: MenuNode[] }
  | { id: string; title: string; type: 'action'; action_id: keyof typeof PROMPTS }
  | { id: string; title: string; type: 'nav'; goto: 'compatibility' | 'forecast_transits' };

const PROMPTS = {
  destiny_overview:
    'Проанализируй натальную карту пользователя (знак Солнца, Асцендент, Середина Неба, планетарные аспекты с Юпитером, Сатурном и осью узлов), чтобы сформулировать его высшее жизненное предназначение и потенциальное духовное призвание. Сосредоточься на темах врожденных стремлений и высшего смысла.',
  destiny_strengths:
    'На основе натальной карты пользователя (выдающиеся планеты, сильные дома, гармоничные аспекты, баланс стихий) определи 3–5 его врожденных сильных сторон/даров. Представь их чётко и кратко.',
  destiny_weaknesses:
    'На основе натальной карты пользователя (сложные планетарные аспекты, диссонирующие положения, трудные дома и кармические индикаторы) выяви 1–2 основные врожденные слабости или области значительных вызовов...',
  destiny_lessons:
    'Изучи натальную карту пользователя, особенно Южный/Северный Узлы, сложные аспекты и положения планет в 6/8/12 домах. Опиши ключевые кармические уроки...',
  destiny_joy:
    'Проанализируй натальную карту (Луна, Венера, 5-й дом, гармоничные аспекты к личным планетам, положение Юпитера). Опиши занятия и среды, приносящие удовольствие.',
  power_country_city:
    'Проанализируй натальную карту с принципами астрокартографии и локального пространства. Дай 3–5 стран и городов...',
  power_top25_career:
    'Сгенерируй 25 городов/регионов, наиболее благоприятных для карьеры (линии MC/Солнца/Марса, аспекты Сатурна).',
  power_top25_soul:
    'Сгенерируй 25 городов/регионов для гармонии души (линии Луны/Венеры/Нептуна/Юпитера).',
  power_top25_unfit:
    'Сгенерируй 25 городов/регионов, где вероятны сложности (линии Сатурна/Урана/Плутона, напряжённые угловые аспекты).',
  power_where_fulfill:
    'Синтезируй по ASC/MC/Солнцу и угловым планетам тип среды и обстоятельств для самореализации.',
  career_type: 'Определи общий тип карьерного пути по MC, управителям 10/6 домов и сильным планетам.',
  career_strengths: 'Назови 3–5 врождённых карьерных сильных сторон на основе карт и аспектов.',
  career_weaknesses: 'Опиши 1–2 врождённых карьерных слабости и потенциальные ловушки.',
  career_top25_fit: 'Дай 25 подходящих должностей/областей по комплексному анализу карты.',
  career_top25_unfit: 'Дай 25 наименее подходящих должностей/областей по комплексному анализу.',
  fin_overview:
    'Проанализируй 2-й/8-й дома, их управителей и аспекты к Юпитеру/Венере/Плутону. Дай общий финансовый обзор.',
  fin_income_sources:
    'Изучи управителя 2-го дома и планеты во 2-м. Опиши вероятные источники дохода.',
  fin_loss_patterns:
    'Определи паттерны потерь: сложные аспекты к управителям 2/8, поражения планет, трудные транзиты.',
  fin_challenges:
    'Опиши конкретные финансовые вызовы по аспектам Сатурна/Урана/Нептуна/Плутона к 2/8.',
  fin_purpose:
    'Определи глубокую цель денег исходя из положения управителя 2-го дома, планет во 2-м и Юпитера.',
  friends_best: 'Опиши архетипы лучших друзей по 11 дому и его управителю.',
  friends_strengths:
    'Назови 3–5 сильных сторон в дружбе по 7/11 домам, Венере, Луне и гармоничным аспектам.',
  friends_weaknesses:
    'Опиши 1–2 слабости по сложным аспектам к Венере/Луне/личным планетам в домах отношений.',
  friends_lessons:
    'Опиши ключевые уроки через 11 дом и планеты/аспекты (Сатурн/Уран/Нептун/Плутон).',
  family_parents: 'Опиши динамику с родителями по 4/10 домам, Луне и Солнцу.',
  family_partner:
    'Опиши архетип партнёра и динамику отношений по 7 дому, его управителю, Венере/Марсу.',
  family_children:
    'Дай инсайты по 5 дому, его управителю и релевантным планетам о родительстве/детях.',
  family_lessons:
    'Опиши семейные уроки по управителю 4 дома, планетам в 4 доме и аспектам к Луне/Солнцу.',
  health_weak:
    'Определи уязвимости здоровья по 6 дому, его управителю и напряжённым аспектам к Солнцу/Луне/ASC.',
  health_strong:
    'Определи врождённые сильные стороны здоровья по балансу стихий и сильным положением Солнца/Луны/Юпитера/Венеры.',
  health_hobbies_good:
    'Предложи 3–5 хобби, поддерживающих здоровье, по 5/6 домам и балансу стихий.',
  health_hobbies_draining:
    'Определи 3–5 истощающих занятий по 5 дому и дисбалансам стихий.',
  compat_general:
    'Синастрия для общей динамики: Солнце/Луна/Меркурий/ASC и т.д.; понимание/коммуникация/эмоции/трения.',
  compat_boss:
    'Синастрия для иерархии: Солнце–Сатурн, Марс–Сатурн, связи с MC; поддержка/вызовы.',
  compat_partner:
    'Романтическая синастрия: Солнце–Луна, Венера–Марс, ASC/DSC, узлы, композит.',
  compat_parents:
    'Синастрия родитель–ребёнок: Солнце/Луна/Сатурн, 4/10 дом, паттерны и уроки.',
  compat_children:
    'Синастрия родитель–ребёнок: Луна–Луна, Солнце–Луна, Сатурн/Юпитер, узлы.',
  forecast_week:
    'Опиши темы, возможности и вызовы недели по транзитам личных планет к натальной карте.',
  forecast_month:
    'Опиши ключевые темы и сдвиги месяца по медленным планетам и значимым аспектам личных планет.',
  forecast_year:
    'Дай годовой обзор по Юпитеру/Сатурну/Урану/Нептуну/Плутону и соляру/прогрессиям; выдели 3–5 периодов.',
  forecast_custom_period:
    'Требуются даты начала/конца; опиши значимые влияния и ключевые даты.',
  forecast_cycles_viz:
    'Сгенерируй диаграмму ключевых транзитов на период с пометками позитив/напряжение/трансформация.',
  rect_info:
    'Кратко объясни важность точного времени рождения для домов/углов и точности прогнозов.',
  rect_offer:
    'Опиши платную услугу ректификации: какие данные нужны и как проходит процесс.',
  rect_continue:
    'Продолжай с временем по умолчанию (например, 12:00), явно указав пониженную точность.',
  community_my_friends:
    'Покажи список друзей; при выборе — базовая карта и предложение углублённой совместимости.',
  community_find_friends:
    'Алгоритм подбора друзей: выдели 3–5 гармоничных аспектов и рассчитай оценку совместимости.',
  community_invite:
    'Сформируй приглашение другу присоединиться к приложению.',
  community_gift:
    'Сформируй процесс дарения: премиум-подписка, ректификация или полный отчёт.',
} as const;

const MENU: MenuNode = {
  id: 'main',
  title: 'Главное меню',
  type: 'menu',
  nav: { back: false, home: false },
  children: [
    {
      id: 'my_chart',
      title: 'Моя Астро-Карта',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        {
          id: 'destiny',
          title: 'Моё Предназначение',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'destiny_overview', title: 'Моё предназначение?', type: 'action', action_id: 'destiny_overview' },
            { id: 'destiny_strengths', title: 'Мои сильные стороны?', type: 'action', action_id: 'destiny_strengths' },
            { id: 'destiny_weaknesses', title: 'Мои слабые стороны?', type: 'action', action_id: 'destiny_weaknesses' },
            { id: 'destiny_lessons', title: 'Мои уроки жизни?', type: 'action', action_id: 'destiny_lessons' },
            { id: 'destiny_joy', title: 'Что приносит удовольствие?', type: 'action', action_id: 'destiny_joy' },
          ],
        },
        {
          id: 'power_places',
          title: 'Место Силы',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'power_country_city', title: 'Страна и город успеха?', type: 'action', action_id: 'power_country_city' },
            { id: 'power_top25_career', title: 'Топ-25 мест для карьеры?', type: 'action', action_id: 'power_top25_career' },
            { id: 'power_top25_soul', title: 'Топ-25 мест для души?', type: 'action', action_id: 'power_top25_soul' },
            { id: 'power_top25_unfit', title: 'Топ-25 неподходящих мест?', type: 'action', action_id: 'power_top25_unfit' },
            { id: 'power_where_fulfill', title: 'Где я реализую себя?', type: 'action', action_id: 'power_where_fulfill' },
          ],
        },
        {
          id: 'career',
          title: 'Карьера',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'career_type', title: 'Мой тип карьеры?', type: 'action', action_id: 'career_type' },
            { id: 'career_strengths', title: 'Моя карьерная сила?', type: 'action', action_id: 'career_strengths' },
            { id: 'career_weaknesses', title: 'Моя карьерная слабость?', type: 'action', action_id: 'career_weaknesses' },
            { id: 'career_top25_fit', title: 'Топ-25 подходящих профессий?', type: 'action', action_id: 'career_top25_fit' },
            { id: 'career_top25_unfit', title: 'Топ-25 неподходящих профессий?', type: 'action', action_id: 'career_top25_unfit' },
          ],
        },
        {
          id: 'finance',
          title: 'Финансы',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'fin_overview', title: 'Моё фин. благополучие?', type: 'action', action_id: 'fin_overview' },
            { id: 'fin_income_sources', title: 'Как приходят деньги?', type: 'action', action_id: 'fin_income_sources' },
            { id: 'fin_loss_patterns', title: 'Как теряются деньги?', type: 'action', action_id: 'fin_loss_patterns' },
            { id: 'fin_challenges', title: 'Денежные вызовы?', type: 'action', action_id: 'fin_challenges' },
            { id: 'fin_purpose', title: 'Для чего мне деньги?', type: 'action', action_id: 'fin_purpose' },
          ],
        },
        {
          id: 'friendships',
          title: 'Взаимоотношения (Друзья)',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'friends_best', title: 'Мои лучшие друзья?', type: 'action', action_id: 'friends_best' },
            { id: 'friends_strengths', title: 'Сильные стороны в дружбе?', type: 'action', action_id: 'friends_strengths' },
            { id: 'friends_weaknesses', title: 'Слабые стороны в дружбе?', type: 'action', action_id: 'friends_weaknesses' },
            { id: 'friends_lessons', title: 'Чему учат меня друзья?', type: 'action', action_id: 'friends_lessons' },
            { id: 'friends_nav_compat', title: 'Совместимость с друзьями', type: 'nav', goto: 'compatibility' },
          ],
        },
        {
          id: 'family',
          title: 'Семья',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'family_parents', title: 'Отношения с родителями?', type: 'action', action_id: 'family_parents' },
            { id: 'family_partner', title: 'Отношения с партнёром?', type: 'action', action_id: 'family_partner' },
            { id: 'family_children', title: 'Мои дети в карте?', type: 'action', action_id: 'family_children' },
            { id: 'family_lessons', title: 'Семейные уроки жизни?', type: 'action', action_id: 'family_lessons' },
            { id: 'family_nav_compat', title: 'Совместимость с партнёром', type: 'nav', goto: 'compatibility' },
          ],
        },
        {
          id: 'health',
          title: 'Здоровье',
          type: 'menu',
          nav: { back: true, home: true },
          children: [
            { id: 'health_weak', title: 'Мои слабые места здоровья?', type: 'action', action_id: 'health_weak' },
            { id: 'health_strong', title: 'Мои сильные стороны здоровья?', type: 'action', action_id: 'health_strong' },
            { id: 'health_hobbies_good', title: 'Хобби для моего здоровья?', type: 'action', action_id: 'health_hobbies_good' },
            { id: 'health_hobbies_draining', title: 'Хобби, что истощают?', type: 'action', action_id: 'health_hobbies_draining' },
            { id: 'health_nav_risk_dates', title: 'Опасные даты для здоровья', type: 'nav', goto: 'forecast_transits' },
          ],
        },
      ],
    },
    {
      id: 'compatibility',
      title: 'Совместимость',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'compat_general', title: 'С любым человеком', type: 'action', action_id: 'compat_general' },
        { id: 'compat_boss', title: 'С начальником/властью', type: 'action', action_id: 'compat_boss' },
        { id: 'compat_partner', title: 'С партнёром (романтика)', type: 'action', action_id: 'compat_partner' },
        { id: 'compat_parents', title: 'С родителями', type: 'action', action_id: 'compat_parents' },
        { id: 'compat_children', title: 'С детьми', type: 'action', action_id: 'compat_children' },
      ],
    },
    {
      id: 'forecast_transits',
      title: 'Прогнозы и Транзиты',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'forecast_week', title: 'Гороскоп на неделю', type: 'action', action_id: 'forecast_week' },
        { id: 'forecast_month', title: 'Гороскоп на месяц', type: 'action', action_id: 'forecast_month' },
        { id: 'forecast_year', title: 'Гороскоп на год', type: 'action', action_id: 'forecast_year' },
        { id: 'forecast_custom_period', title: 'Мой прогноз на период', type: 'action', action_id: 'forecast_custom_period' },
        { id: 'forecast_cycles_viz', title: 'Мои циклы и вызовы (диаграмма)', type: 'action', action_id: 'forecast_cycles_viz' },
      ],
    },
    {
      id: 'rectification',
      title: 'Уточнить время рождения',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'rect_info', title: 'Почему важно время?', type: 'action', action_id: 'rect_info' },
        { id: 'rect_offer', title: 'Запросить помощь астролога', type: 'action', action_id: 'rect_offer' },
        { id: 'rect_continue', title: 'Продолжить без точного времени', type: 'action', action_id: 'rect_continue' },
      ],
    },
    {
      id: 'community',
      title: 'Сообщество & Друзья',
      type: 'menu',
      nav: { back: true, home: true },
      children: [
        { id: 'community_my_friends', title: 'Мои друзья', type: 'action', action_id: 'community_my_friends' },
        { id: 'community_find_friends', title: 'Найти Астро-Друзей', type: 'action', action_id: 'community_find_friends' },
        { id: 'community_invite', title: 'Пригласить друга', type: 'action', action_id: 'community_invite' },
        { id: 'community_gift', title: 'Подарить Астро-Сервис', type: 'action', action_id: 'community_gift' },
      ],
    },
  ],
};

/* ==================== Экран ==================== */
export default function AstroScreen() {
  const router = useRouter();
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

  /* ====== Чат ====== */
  const [messages, setMessages] = useState<Msg[]>([
    { id: 'm1', role: 'bot', text: 'Привет! Спроси что-нибудь по своей карте 🌌', ts: Date.now() },
  ]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<Msg>>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

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
    setMessages((prev) => [
      ...prev,
      user,
      { id: user.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 },
    ]);
    setDraft('');
    scrollToEnd();

    try {
      setIsBusy(true);
      const r = await fetch(ENDPOINTS.aiQuery, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, question: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`);
      const ct = r.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await r.json() : { reply: await r.text() };
      const botText = data?.reply ?? 'Ок.';
      setMessages((prev) =>
        prev.map((m) => (m.id === user.id + ':wait' ? { ...m, text: String(botText) } : m))
      );
      scrollToEnd();
      if (botText) await speak(String(botText));
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === user.id + ':wait' ? { ...m, text: 'Ошибка связи с сервером' } : m))
      );
      Alert.alert('Чат', e?.message || 'Ошибка сети');
    } finally {
      setIsBusy(false);
    }
  };

  /* ====== Голос ====== */
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
      const created = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(created.recording);
      setIsRecording(true);
    } catch (e) {
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

      // НАДЁЖНАЯ отправка файла через expo-file-system (Android/iOS/Expo)
      setIsBusy(true);
      const uploadRes = await FileSystem.uploadAsync(ENDPOINTS.speech, uri, {
  fieldName: 'audio',
  httpMethod: 'POST',
  uploadType: FileSystem.FileSystemUploadType.MULTIPART,  mimeType: 'audio/m4a',
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
        setIsBusy(false);
        return;
      }

      const userMsg: Msg = { id: String(Date.now()), role: 'user', text, ts: Date.now() };
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: userMsg.id + ':wait', role: 'bot', text: '…', ts: Date.now() + 1 },
      ]);
      scrollToEnd();

      const r = await fetch(ENDPOINTS.aiQuery, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, question: text }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text().catch(() => '')}`);
      const ct = r.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await r.json() : { reply: await r.text() };
      const botText = data?.reply ?? 'Ок.';
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id + ':wait' ? { ...m, text: String(botText) } : m))
      );
      scrollToEnd();
      if (botText) await speak(String(botText));
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message || 'Проблема с отправкой голоса');
    } finally {
      setIsBusy(false);
    }
  };

  /* ====== Кнопочное меню ====== */
  const [menuOpen, setMenuOpen] = useState<boolean>(false); // стартуем открытым — можно поменять
  const [path, setPath] = useState<string[]>(['main']); // путь в дереве
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

  /* ====== UI ====== */
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListHeaderComponent={
            <>
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

              <Text style={styles.subtitle}>Чат по карте</Text>
            </>
          }
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble item={item} />}
        />

        {/* ===== Кнопочное меню – как в Telegram ===== */}
        <View style={styles.menuDock}>
          <View style={styles.menuHeader}>
            <Pressable
              onPress={() => setMenuOpen((v) => !v)}
              style={[styles.menuToggle, menuOpen && { backgroundColor: '#4f46e5' }]}
            >
              <Ionicons name="menu" size={16} color={menuOpen ? '#fff' : '#4f46e5'} />
              <Text
                style={[
                  styles.menuToggleText,
                  { color: menuOpen ? '#fff' : '#4f46e5' },
                ]}
              >
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

        {/* ===== Полоса ввода ===== */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Напишите вопрос…"
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Поле ввода сообщения"
          />
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[
              styles.iconBtn,
              isRecording && { backgroundColor: '#ef4444' },
              isBusy && { opacity: 0.6 },
            ]}
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
function Bubble({ item }: { item: Msg }) {
  const me = item.role === 'user';
  return (
    <View
      style={[
        styles.bubbleWrap,
        me ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
      ]}
    >
      <View style={[styles.bubble, me ? styles.me : styles.bot]}>
        {!me && (
          <Ionicons
            name="star-outline"
            size={14}
            color="#4f46e5"
            style={{ marginRight: 6 }}
          />
        )}
        <Text style={[styles.bubbleText, me && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  );
}

/* ===== Styles ===== */
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

  /* Ввод */
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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

  /* Меню-клавиатура */
  menuDock: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 64,
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
