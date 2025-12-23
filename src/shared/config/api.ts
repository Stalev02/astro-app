// src/shared/config/api.ts
import Constants from "expo-constants";
import { Platform } from "react-native";

function cleanBase(base: string) {
  return base.replace(/\/+$/, "");
}

function resolveApiBase(): string {
  const env = (process.env.EXPO_PUBLIC_API_BASE || "").trim();
  if (env) return cleanBase(env);

  // If no env var is provided, default to production URL.
  // This prevents accidental localhost or LAN usage in TestFlight.
  const PROD = "https://api.cosmo-tell.com";

  // Optional: allow dev-only fallbacks when running in Expo dev mode.
  // You can remove this entire block if you want to force env var always.
  if (__DEV__) {
    const any = Constants as any;
    const hostUri: string | undefined =
      any?.expoConfig?.hostUri ||
      any?.manifest2?.extra?.expoClient?.hostUri ||
      any?.manifest?.hostUri;

    if (hostUri) {
      const host = hostUri.split(":")[0];
      if (host && host !== "127.0.0.1" && host !== "localhost") {
        return `http://${host}:3000`;
      }
    }

    if (Platform.OS === "ios") return "http://127.0.0.1:3000";
    if (Platform.OS === "android") return "http://10.0.2.2:3000";
    return "http://127.0.0.1:3000";
  }

  return PROD;
}

export const API_BASE = resolveApiBase();

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

export const ENDPOINTS = {
  chat: apiUrl("/chat"),
  speech: apiUrl("/speech"),
  aiQuery: apiUrl("/ai/query"),
  health: apiUrl("/health"),
  geoSearch: apiUrl("/geo/search"),
  profilesSync: apiUrl("/profiles/sync"),
};
