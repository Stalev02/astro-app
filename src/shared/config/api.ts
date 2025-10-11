// src/shared/config/api.ts
import Constants from "expo-constants";

function resolveLanHost(): string | null {
  const any = Constants as any;
  const hostUri: string | undefined =
    any?.expoConfig?.hostUri ||
    any?.manifest2?.extra?.expoClient?.hostUri ||
    any?.manifest?.hostUri;
  if (!hostUri) return null;
  const ip = hostUri.split(":")[0];
  if (!ip || ip === "127.0.0.1" || ip === "localhost") return null;
  return `http://${ip}:3000`;
}

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE || "").trim() ||
  resolveLanHost() ||
  "http://YOUR-LAN-IP:3000";

export const ENDPOINTS = {
  chat: `${API_BASE}/chat`,       // оставим на всякий
  speech: `${API_BASE}/speech`,
  aiQuery: `${API_BASE}/ai/query`, // <- добавили
  health: `${API_BASE}/health`,
};
