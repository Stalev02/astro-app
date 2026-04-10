// src/shared/api/profiles.ts
import { getSupabase } from '@/src/lib/supabase';
import type { PersonProfile } from '../../store/profiles';
import { API_BASE } from '../config/api';

/**
 * Adds Authorization header if a Supabase session exists.
 * If not logged in (guest), returns empty headers.
 */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // Supabase not configured or no session
    return {};
  }
}


/**
 * Fetch profile for the currently authenticated user.
 * Requires backend route: GET /profiles/me (requireAuth).
 */
export async function fetchMyProfile() {
  const headers = await authHeaders();
  const r = await fetch(`${API_BASE}/profiles/me`, {
    method: 'GET',
    headers: { ...headers },
  });
  if (!r.ok) throw new Error(`me ${r.status} ${await r.text().catch(() => '')}`);
  return r.json();
}

/**
 * Обновляет (или создает) профиль "me" по deviceId,
 * записывая birth-данные (и любые другие поля профиля).
 * Реализовано через уже существующий /profiles/sync.
 *
 * @param deviceId - идентификатор устройства (ключ в твоем апи)
 * @param input - объект профиля; можно передавать только нужные поля (date/time/tz/lat/lng/name/gender и т.д.)
 * @returns обновленный payload, который вернет твой /profiles/sync
 */
export async function upsertBirthData(deviceId: string, input: Partial<PersonProfile>) {
  const payload = {
    deviceId,
    me: input as PersonProfile,
    other: null as PersonProfile | null,
  };

  const headers = await authHeaders();

  const r = await fetch(`${API_BASE}/profiles/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    throw new Error(`upsertBirthData ${r.status} ${await r.text().catch(() => '')}`);
  }

  return r.json();
}

/**
 * Получает натальную карту (SVG) по deviceId.
 * Это обертка над уже существующим /profiles/:deviceId/chart.
 *
 * @param deviceId - идентификатор устройства
 * @returns { chart_svg: string | null }
 */
export async function fetchNatalChartByProfileId(deviceId: string) {
  const r = await fetch(`${API_BASE}/profiles/${encodeURIComponent(deviceId)}/chart`);
  if (!r.ok) {
    throw new Error(`chart-by-id ${r.status} ${await r.text().catch(() => '')}`);
  }
  return r.json() as Promise<{ chart_svg: string | null }>;
}


type SyncPayload = {
  deviceId: string;
  me: PersonProfile | null;
  other: PersonProfile | null;
};

export async function syncProfiles(payload: SyncPayload) {
  const headers = await authHeaders();

  const r = await fetch(`${API_BASE}/profiles/sync`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`sync ${r.status} ${await r.text().catch(() => '')}`);
  return r.json();
}


export async function fetchChartSvg(deviceId: string) {
  const r = await fetch(`${API_BASE}/profiles/${encodeURIComponent(deviceId)}/chart`);
  if (!r.ok) throw new Error(`chart ${r.status} ${await r.text().catch(() => '')}`);
  return r.json() as Promise<{ chart_svg: string | null }>;
}

export async function searchPlaces(q: string) {
  const r = await fetch(`${API_BASE}/geo/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    console.warn('[searchPlaces] geo error', r.status, text);
    throw new Error(`geo ${r.status}`);
  }
  return r.json() as Promise<{
    items: Array<{
      id: string;
      displayName: string;
      city: string;
      nation: string;
      lat: number;
      lng: number;
      tz: string | null;
    }>;
  }>;
}
