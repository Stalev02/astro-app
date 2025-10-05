// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

const BG = '#0b0b0c';
const HEADER_BG = '#0e0f12';
const HEADER_BORDER = 'rgba(255,255,255,0.06)';
const HEADER_TEXT = '#ffffff';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: BG },      // фон всех экранов по умолчанию
          headerStyle: { backgroundColor: HEADER_BG },
          headerTitleStyle: { color: HEADER_TEXT },
          headerTintColor: HEADER_TEXT,
          headerShadowVisible: true,
          headerTransparent: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            title: 'Анкета',
            presentation: 'modal',
            headerStyle: { backgroundColor: HEADER_BG },
            headerTitleStyle: { color: HEADER_TEXT },
            headerTintColor: HEADER_TEXT,
          }}
        />
      </Stack>
    </>
  );
}
