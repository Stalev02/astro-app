// src/store/app.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppState = {
  hydrated: boolean;
  onboardingDone: boolean;
  tosAccepted: boolean;
  testMode: boolean; // flag for test mode

  setTosAccepted: (v: boolean) => void;
  completeOnboarding: () => void;
  _setHydrated: (v: boolean) => void;
  enableTestMode: () => void; // test mode par
  disableTestMode: () => void; // test mode par
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      tosAccepted: false,
      testMode: false,
      setTosAccepted: (v) => set({ tosAccepted: v }),
      completeOnboarding: () => set({ onboardingDone: true }),
      _setHydrated: (v) => set({ hydrated: v }),
      enableTestMode: () => set({ testMode: true, onboardingDone: false }),
      disableTestMode: () => set({ testMode: false }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // отметим, что ре-гидрация завершена
        state?._setHydrated(true);
      },
    }
  )
);
