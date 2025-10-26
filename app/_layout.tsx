// app/_layout.tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// предотвращаем авто-скрытие splash-экрана до инициализации
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    const prepare = async () => {
      // короткая пауза для стабильного скрытия splash-экрана
      await new Promise((r) => setTimeout(r, 80));
      await SplashScreen.hideAsync();
    };
    prepare();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b0b0c' },
      }}
    >
      {/* Главный экран → index.tsx */}
      <Stack.Screen name="index" />

      {/* Онбординг */}
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="onboarding-profile" />

      {/* Авторизация (экран логина и регистрации) */}
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />

      {/* Основные вкладки */}
      <Stack.Screen name="(tabs)" />

      {/* Модальное окно анкеты / ректификации */}
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
