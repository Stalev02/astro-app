// src/shared/api/profiles.ts
import type { PersonProfile } from "../../store/profiles";
import { API_BASE } from "../config/api";

/**
 * Обновляет (или создает) профиль "me" по deviceId,
 * записывая birth-данные (и любые другие поля профиля).
 * Реализовано через уже существующий /profiles/sync.
 *
 * @param deviceId - идентификатор устройства (ключ в твоем апи)
 * @param input - объект профиля; можно передавать только нужные поля (date/time/tz/lat/lng/name/gender и т.д.)
 * @returns обновленный payload, который вернет твой /profiles/sync
 */
export async function upsertBirthData(
  deviceId: string,
  input: Partial<PersonProfile>
) {
  const payload = {
    deviceId,
    me: input as PersonProfile,
    other: null as PersonProfile | null
  };

  const r = await fetch(`${API_BASE}/profiles/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    throw new Error(`upsertBirthData ${r.status} ${await r.text().catch(() => "")}`);
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
    throw new Error(`chart-by-id ${r.status} ${await r.text().catch(() => "")}`);
  }
  return r.json() as Promise<{ chart_svg: string | null }>;
}

/**
 * Строит натальную карту напрямую по birth-данным.
 * На стороне бэка ожидается POST /charts с { date, time, tz, lat, lng }.
 * Если такого роутинга нет — используй fetchNatalChartByProfileId после upsertBirthData.
 *
 * @param data - минимальные birth-данные
 * @returns { chart_svg: string | null, ...optional }
 */
export async function fetchNatalChartByBirthData(data: {
  date: string;  // 'YYYY-MM-DD'
  time: string;  // 'HH:mm'
  tz: string;    // IANA TZ, например 'Europe/Kyiv'
  lat: number;
  lng: number;
}) {
  const r = await fetch(`${API_BASE}/charts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      date: data.date,
      time: data.time,
      tz: data.tz,
      lat: data.lat,
      lng: data.lng,
    }),
  });

  if (!r.ok) {
    throw new Error(`chart-by-birth ${r.status} ${await r.text().catch(() => "")}`);
  }

  // сервер может вернуть доп. поля (planets/houses/ascendant), но мы гарантируем chart_svg
  return r.json() as Promise<{ chart_svg: string | null } & Record<string, any>>;
}

type SyncPayload = {
  deviceId: string;
  me: PersonProfile | null;
  other: PersonProfile | null;
};

export async function syncProfiles(payload: SyncPayload) {
  const r = await fetch(`${API_BASE}/profiles/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`sync ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

export async function fetchProfiles(deviceId: string) {
  const r = await fetch(`${API_BASE}/profiles/${encodeURIComponent(deviceId)}`);
  if (!r.ok) throw new Error(`get ${r.status} ${await r.text().catch(() => "")}`);
  return r.json();
}

export async function fetchChartSvg(deviceId: string) {
  const r = await fetch(`${API_BASE}/profiles/${encodeURIComponent(deviceId)}/chart`);
  if (!r.ok) throw new Error(`chart ${r.status} ${await r.text().catch(() => "")}`);
  return r.json() as Promise<{ chart_svg: string | null }>;
}

export async function searchPlaces(q: string) {
  const r = await fetch(`${API_BASE}/geo/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`geo ${r.status}`);
  return r.json() as Promise<{ items: Array<{
    id: string;
    displayName: string;
    city: string;
    nation: string;
    lat: number;
    lng: number;
    tz: string | null;
  }> }>;
}
