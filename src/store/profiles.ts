// src/store/profiles.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fetchChartSvg, fetchMyProfile, syncProfiles } from '../shared/api/profiles';

/* ───────────────── Types ───────────────── */

export type PersonProfile = {
  id: string;
  name: string;

  // old fields
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  place?: string;

  // new fields
  birthDateISO?: string;
  timeKnown?: boolean;
  seconds?: number;
  birthPlace?: string;
  livesElsewhere?: boolean;
  currentCity?: string;
  fullDateTimeISO?: string;

  // geo/time
  coords?: { lat: number; lng: number };
  tz?: string;

  gender?: 'male' | 'female' | 'other' | 'na';
  email?: string;
};

export type NatalChart = {
  chart_svg: string | null;
  planets?: Array<{ name: string; sign: string; degree: number }>;
  houses?: Array<{ house: number; sign: string; degree: number }>;
};

type ProfilesState = {
  deviceId: string;
  me: PersonProfile | null;
  other: PersonProfile | null;

  chart: NatalChart | null;
  loading: boolean;
  error: string | null;
  onboarded: boolean;

  setDeviceId: (id: string) => void;

  setMe: (p: PersonProfile) => void;
  setOther: (p: PersonProfile) => void;
  clearOther: () => void;

  /** Hard reset local profile state (prevents cross-account leak) */
  resetAll: () => void;

  /**
   * Call after sign-in / session restore:
   * - sets deviceId = uid-${uid}
   * - if switched user, clears me/other/chart/onboarded
   */
  applyAuthUser: (uid: string) => void;

  /** Pull profile from DB for the logged-in user */
  loadMeFromServer: () => Promise<void>;

  /** sync with server */
  sync: () => Promise<void>;

  /** onboarding submission */
  submitOnboarding: (payload: Partial<PersonProfile>) => Promise<void>;

  /** manual chart refresh */
  reloadChart: () => Promise<void>;
};

/* ───────────────── Utils ───────────────── */

const genDeviceId = () =>
  'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ───────────────── Store ───────────────── */

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      deviceId: genDeviceId(),
      me: null,
      other: null,

      chart: null,
      loading: false,
      error: null,
      onboarded: false,

      setDeviceId: (id) => set({ deviceId: id }),

      setMe: (p) => set({ me: p }),
      setOther: (p) => set({ other: p }),
      clearOther: () => set({ other: null }),

      resetAll: () =>
        set({
          me: null,
          other: null,
          chart: null,
          onboarded: false,
          loading: false,
          error: null,
        }),

      applyAuthUser: (uid: string) => {
        const nextId = `uid-${uid}`;
        const currentId = get().deviceId;

        if (currentId !== nextId) {
          set({
            deviceId: nextId,
            me: null,
            other: null,
            chart: null,
            onboarded: false,
            loading: false,
            error: null,
          });
        } else {
          set({ deviceId: nextId });
        }
      },

      async loadMeFromServer() {
        set({ loading: true, error: null });
        try {
          const row: any = await fetchMyProfile();

          // Keep deviceId in sync with what backend returns (if present)
          if (row?.device_id && typeof row.device_id === 'string' && row.device_id !== get().deviceId) {
            set({ deviceId: row.device_id });
          }

          const me = (row?.me ?? null) as PersonProfile | null;
          const other = (row?.other ?? null) as PersonProfile | null;

          // chart svg can be returned either at top-level or embedded in chart_data
          const svg =
            row?.chart_svg ??
            row?.chart_data?.chart_svg ??
            row?.chart_data?.chart ??
            row?.chart_data?.svg ??
            null;

          set({
            me,
            other,
            chart: { chart_svg: svg },
            onboarded: !!me,
            loading: false,
            error: null,
          });
        } catch (e: any) {
          // Important: do NOT wipe local state here. Just report the error.
          set({
            loading: false,
            error: e?.message ?? 'loadMeFromServer failed',
          });
        }
      },

      async sync() {
        const { deviceId, me, other } = get();
        try {
          await syncProfiles({ deviceId, me, other });
          console.log('[profiles] sync ok', deviceId);
        } catch (e) {
          console.warn('[profiles] sync failed', e);
        }
      },

      async submitOnboarding(payload) {
        const prev = get().me;
        const merged = { ...(prev ?? {}), ...payload } as PersonProfile;

        set({ loading: true, error: null, me: merged });

        try {
          // 1) sync to backend (now includes Authorization header when logged in)
          await get().sync();

          // 2) try fetch SVG chart
          let chart: NatalChart | null = null;
          try {
            const res = await fetchChartSvg(get().deviceId);
            chart = { chart_svg: res.chart_svg ?? null };
          } catch (e) {
            console.warn('[profiles] fetchChartSvg failed', e);
            chart = { chart_svg: null };
          }

          set({
            chart,
            onboarded: true,
            loading: false,
            error: null,
          });
          console.log('[profiles] onboarding complete');
        } catch (e: any) {
          set({
            loading: false,
            error: e?.message ?? 'Ошибка при онбординге',
          });
          console.warn('[profiles] onboarding failed', e);
          throw e;
        }
      },

      async reloadChart() {
        const { deviceId, me } = get();

        if (!me) {
          console.warn('[profiles] reloadChart: нет профиля');
          return;
        }

        set({ loading: true, error: null });
        try {
          const res = await fetchChartSvg(deviceId);
          const chart: NatalChart = { chart_svg: res.chart_svg ?? null };
          set({ chart, loading: false });
          console.log('[profiles] chart reloaded');
        } catch (e: any) {
          const msg = String(e?.message || '');
          if (msg.includes('404')) {
            console.warn('[profiles] chart 404 → попробую sync() и повторить');
            try {
              await get().sync();
              await new Promise((r) => setTimeout(r, 250));
              const res2 = await fetchChartSvg(deviceId);
              const chart2: NatalChart = { chart_svg: res2.chart_svg ?? null };
              set({ chart: chart2, loading: false });
              return;
            } catch (e2) {
              console.warn('[profiles] повторный reload после sync не удался', e2);
            }
          }
          set({
            loading: false,
            error: e?.message ?? 'Не удалось обновить карту',
          });
          console.warn('[profiles] reloadChart failed', e);
        }
      },
    }),
    {
      name: 'profiles-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        deviceId: s.deviceId,
        me: s.me,
        other: s.other,
        chart: s.chart,
        onboarded: s.onboarded,
      }),
    }
  )
);

export const newId = () => 'p-' + Math.random().toString(36).slice(2);
