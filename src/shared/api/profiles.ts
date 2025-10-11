// src/shared/api/profiles.ts
import type { PersonProfile } from "../../store/profiles";
import { API_BASE } from "../config/api"; // если ts ругается — поменяй путь на '../../shared/config/api'

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
