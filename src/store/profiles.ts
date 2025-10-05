// app/store/profiles.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PersonProfile = {
  id: string;
  name: string;
  date: string;      // YYYY-MM-DD
  time?: string;     // HH:mm | undefined (если неизвестно)
  place?: string;    // текст до интеграции автокомплита
  gender?: 'male' | 'female' | 'other';
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
    }
  )
);

// небольшая утилита id
export const newId = () => 'p-' + Math.random().toString(36).slice(2);
