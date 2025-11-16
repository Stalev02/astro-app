// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

const BG = '#0b0b0c';
const TAB_BG = '#0e0f12';
const TAB_BORDER = 'rgba(255,255,255,0.06)';
const ACTIVE = '#ffffff';
const INACTIVE = '#a3a6ae';
const HEADER_BG = '#0e0f12';
const HEADER_TEXT = '#ffffff';

function Label({ text, color }: { text: string; color: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: 11.5,
        fontWeight: '600',
        lineHeight: 13,
        textAlign: 'center',
      }}
      numberOfLines={2}
      allowFontScaling
    >
      {text}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="astro-map"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: HEADER_BG },
        headerTitleStyle: { color: HEADER_TEXT, fontWeight: '700' },
        headerTintColor: HEADER_TEXT,
        sceneStyle: { backgroundColor: BG },
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: TAB_BORDER,
          height: 72,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      <Tabs.Screen
        name="astro-map"
        options={{
          title: 'Моя Астро-Карта',
          tabBarLabel: ({ color }) => <Label color={color} text={'Астро-карта'} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="planet-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="astro-chat"
        options={{
          title: 'Чат по карте',
          tabBarLabel: ({ color }) => <Label color={color} text={'Чат'} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarLabel: ({ color }) => <Label color={color} text={'Настройки'} />,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
