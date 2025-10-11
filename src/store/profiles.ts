// src/store/profiles.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PersonProfile = {
  id: string;
  name: string;

  // старые поля (совместимость с существующими экранами)
  date: string;            // YYYY-MM-DD
  time?: string;           // HH:mm
  place?: string;

  // новые поля, которыми пользуется modal.tsx
  birthDateISO?: string;   // YYYY-MM-DD
  timeKnown?: boolean;     // известно ли точное время
  seconds?: number;        // 0..59
  birthPlace?: string;
  livesElsewhere?: boolean;
  currentCity?: string;
  fullDateTimeISO?: string; // YYYY-MM-DDTHH:mm:ss

  gender?: 'male' | 'female' | 'other' | 'na';
  email?: string;
};

type ProfilesState = {
  me: PersonProfile | null;
  other: PersonProfile | null;
  setMe: (p: PersonProfile) => void;
  setOther: (p: PersonProfile) => void;
  clearOther: () => void;
};

export const useProfiles = create<ProfilesState>()(
  persist(
    (set) => ({
      me: null,
      other: null,
      setMe: (p) => set({ me: p }),
      setOther: (p) => set({ other: p }),
      clearOther: () => set({ other: null }),
    }),
    {
      name: 'profiles-store',
      storage: createJSONStorage(() => AsyncStorage),
      // при желании: version/migrate, чтобы не терять старые данные
    }
  )
);

// небольшая утилита id
export const newId = () => 'p-' + Math.random().toString(36).slice(2);
