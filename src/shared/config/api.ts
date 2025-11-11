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

  // Попытка вытащить LAN-IP из hostUri (работает на реальном девайсе)
  const any = Constants as any;
  const hostUri: string | undefined =
    any?.expoConfig?.hostUri ||
    any?.manifest2?.extra?.expoClient?.hostUri ||
    any?.manifest?.hostUri;

  // iOS симулятор → localhost
  if (Platform.OS === "ios") {
    // На iOS симуляторе бэкенд, запущенный на том же Mac, доступен по 127.0.0.1
    return "http://127.0.0.1:3000";
  }

  // Android эмулятор → 10.0.2.2 (loopback на хост-систему)
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  // Web/прочее: если удалось достать hostUri и это не localhost — используем его IP
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "127.0.0.1" && ip !== "localhost") {
      return `http://${ip}:3000`;
    }
  }

  // Фолбэк на localhost
  return "http://127.0.0.1:3000";
}

export const API_BASE = resolveDevApiBase();

export const ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  speech: `${API_BASE}/speech`,
  aiQuery: `${API_BASE}/ai/query`,
  health: `${API_BASE}/health`,
};
