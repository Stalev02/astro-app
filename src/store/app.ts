// src/store/app.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppState = {
  hydrated: boolean;

  onboardingDone: boolean;
  tosAccepted: boolean;

  introSeen: boolean;

  language: 'ru' | 'en';

  setTosAccepted: (v: boolean) => void;
  completeOnboarding: () => void;
  setIntroSeen: (v: boolean) => void;
  setLanguage: (lang: 'ru' | 'en') => void;

  _setHydrated: (v: boolean) => void;
};


export const useApp = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      tosAccepted: false,

      introSeen: false,

      language: 'ru',

      setTosAccepted: (v) => set({ tosAccepted: v }),

      completeOnboarding: () => set({ onboardingDone: true }),

      setIntroSeen: (v) => set({ introSeen: v }),

      setLanguage: (lang) => set({ language: lang }),

      _setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated(true);
      },
    }
  )
);
