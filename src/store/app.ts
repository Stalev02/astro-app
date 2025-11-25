// src/store/app.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AppState = {
  /** true, когда zustand восстановил состояние из AsyncStorage */
  hydrated: boolean;

  /**
   * Пользователь прошёл онбординг хотя бы один раз:
   * - экран онбординга с intro/TOS и т.д.
   * - анкета (onboarding-profile) или явное завершение мастера
   */
  onboardingDone: boolean;

  /**
   * Пользователь явно принял пользовательское соглашение (TOS)
   * через экран onboading (ScreenTOS).
   */
  tosAccepted: boolean;

  /** Устанавливает флаг принятия TOS (используется на экране онбординга). */
  setTosAccepted: (v: boolean) => void;

  /**
   * Отмечает, что онбординг завершён.
   * Вызывается из онбординга / мастера анкеты после успешного завершения.
   */
  completeOnboarding: () => void;

  /** Внутренний флаг, что состояние восстановлено из хранилища. */
  _setHydrated: (v: boolean) => void;
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      tosAccepted: false,

      setTosAccepted: (v) => set({ tosAccepted: v }),

      completeOnboarding: () => set({ onboardingDone: true }),

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
