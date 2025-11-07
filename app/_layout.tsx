// app/_layout.tsx
import { useApp } from '@/src/store/app';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const { testMode } = useApp();
  const insets = useSafeAreaInsets(); // << безопасные отступы (учтут челку/динамик-айленд)


  return (
    <>
      {testMode && (
        <View
          // не мешаем взаимодействию с контентом
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 0,
            zIndex: 2000,
            backgroundColor: '#4f46e5',
            // делаем «безопасным» — текст окажется под статус-баром, а фон может уходить под вырез
            paddingTop: (insets.top || 12) + 4,
            paddingBottom: 8,
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 12,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 0.4 }}>
            ТЕСТ-РЕЖИМ
          </Text>
        </View>
      )}
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
    </>
  );
}
