export type BirthData = {
  name?: string | null;
  date: string;        // 'YYYY-MM-DD'
  time: string;        // 'HH:mm'
  tz: string;          // 'Europe/Kyiv' и т.п.
  lat: number;
  lng: number;
  gender?: string | null;
};

export type NatalChart = {
  houses: Array<{ house: number; sign: string; degree: number }>;
  planets: Array<{ name: string; sign: string; degree: number }>;
  ascendant?: { sign: string; degree: number } | null;
  raw?: any; // если API отдает больше данных
};

export type Profile = {
  id: string;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  // поля для рождения
  birth_date?: string | null; // 'YYYY-MM-DD'
  birth_time?: string | null; // 'HH:mm'
  birth_tz?: string | null;
  birth_lat?: number | null;
  birth_lng?: number | null;
  gender?: string | null;
};
