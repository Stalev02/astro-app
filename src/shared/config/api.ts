// src/shared/config/api.ts
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Возвращает базовый URL бэкенда в дев-режиме:
 * - явный EXPO_PUBLIC_API_BASE из .env имеет приоритет
 * - iOS Simulator: http://127.0.0.1:3000
 * - Android Emulator: http://10.0.2.2:3000
 * - Реальное устройство/Expo Go: берём LAN-IP из hostUri: http://<lan-ip>:3000
 * - Фолбэк: http://127.0.0.1:3000 (чтобы не было YOUR-LAN-IP)
 */
function resolveDevApiBase(): string {
  const env = (process.env.EXPO_PUBLIC_API_BASE || "").trim();
  if (env) return env;

  const any = Constants as any;
  const hostUri: string | undefined =
    any?.expoConfig?.hostUri ||
    any?.manifest2?.extra?.expoClient?.hostUri ||
    any?.manifest?.hostUri;

  // If Expo gives us a LAN host (real device / sometimes simulator) → use it
  if (hostUri) {
    const host = hostUri.split(':')[0];
    // Ignore obvious local hosts, otherwise assume it's LAN IP
    if (host && host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:3000`;
    }
  }

  // Fallbacks for local simulators/emulators
  if (Platform.OS === 'ios') {
    return 'http://127.0.0.1:3000';
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://127.0.0.1:3000';
}

export const API_BASE = resolveDevApiBase();

export const ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  speech: `${API_BASE}/speech`,
  aiQuery: `${API_BASE}/ai/query`,
  health: `${API_BASE}/health`,
};
