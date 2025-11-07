import Constants from "expo-constants";
import { Platform } from "react-native";

function resolveLanHost(): string | null {
  const any = Constants as any;
  const hostUri: string | undefined =
    any?.expoConfig?.hostUri ||
    any?.manifest2?.extra?.expoClient?.hostUri ||
    any?.manifest?.hostUri;

  if (!hostUri) return null;
  const ip = hostUri.split(":")[0];

  // Expo often runs on localhost in the simulator
  if (!ip || ip === "127.0.0.1" || ip === "localhost") {
    return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://127.0.0.1:3000";
  }
  return `http://${ip}:3000`;
}

function defaultDevBase() {
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://127.0.0.1:3000";
}

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE || "").trim() ||
  resolveLanHost() ||
  defaultDevBase();

export const ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  speech: `${API_BASE}/speech`,
  aiQuery: `${API_BASE}/ai/query`,
  health: `${API_BASE}/health`,
};
