// src/store/app.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppState = {
  hydrated: boolean;

  onboardingDone: boolean;
  tosAccepted: boolean;

  // 👇 новый флаг — интро показано на этом устройстве
  introSeen: boolean;

  setTosAccepted: (v: boolean) => void;
  completeOnboarding: () => void;

  // 👇 новый сеттер
  setIntroSeen: (v: boolean) => void;

  _setHydrated: (v: boolean) => void;
};


export const useApp = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      tosAccepted: false,

      // 👇 новое поле
      introSeen: false,

      setTosAccepted: (v) => set({ tosAccepted: v }),

      completeOnboarding: () => set({ onboardingDone: true }),

      // 👇 новый метод
      setIntroSeen: (v) => set({ introSeen: v }),

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

