// server/index.js
// ── ENV (берём именно server/.env)
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import cors from 'cors';
import crypto from 'crypto';
import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import multer from 'multer';
import tzLookup from 'tz-lookup';

// DB
import { getProfile, initDb, saveChartSvg, upsertProfile } from './db.js';

// ── Инициализация БД
await initDb();
console.log('✅ MySQL connected and initialized');

// ── ffmpeg нужен только если будешь реально перекодировать аудио
ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
app.use(cors());
app.use(express.json());

const {
  N8N_CHAT_URL = '',
  N8N_SPEECH_URL = '',
  N8N_SECRET = '',
  ASTRO_API_BASE = '',
  ASTRO_API_KEY = '',
  ASTRO_LANG = 'EN',
  ASTRO_THEME = 'classic', // можно поставить 'dark' в .env
  ASTRO_ZODIAC = 'Tropic',
  ASTRO_HOUSE_SYSTEM = 'P',
  ASTRO_PERSPECTIVE = 'Apparent Geocentric',
  GEONAMES_USERNAME = '',
  GEONAMES_BASE = 'https://api.geonames.org',
  GEONAMES_TIMEOUT_MS = '6000',
  NOMINATIM_BASE = 'https://nominatim.openstreetmap.org',
  NOMINATIM_EMAIL = 'noreply@example.com',
  PORT = '3000',
} = process.env;

const sign = (body, ts) => {
  const data = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return crypto.createHmac('sha256', N8N_SECRET).update(ts + '.' + data).digest('hex');
};

/* ===== helper: разбираем "Город, Страна" → { city, nation } ===== */
function parsePlace(me) {
  const raw = me?.birthPlace || me?.place || '';
  if (!raw) return { city: null, nation: null };
  const parts = raw.split(',').map((s) => s.trim());
  const city = parts[0] || null;
  const nation = parts.length > 1 ? parts[parts.length - 1] : null;
  return { city, nation };
}

/* ===== signature: "что влияет на вид карты" ===== */
function buildSignature({ Y, M, D, h, m, lat, lng, tz, theme, zodiac, house }) {
  const norm = (x) => (x == null ? '' : String(x));
  return [
    norm(Y),
    norm(M),
    norm(D),
    norm(h),
    norm(m),
    norm(lat),
    norm(lng),
    norm(tz),
    norm(theme),
    norm(zodiac),
    norm(house),
  ].join('|');
}

const normalizeNation = (val) => {
  if (!val) return null;
  const v = String(val).trim();
  if (/^[A-Z]{2}$/i.test(v)) return v.toUpperCase();
  const map = {
    Россия: 'RU',
    'Russian Federation': 'RU',
    Russian: 'RU',
    Украина: 'UA',
    Казахстан: 'KZ',
    Беларусь: 'BY',
    США: 'US',
    'Соединённые Штаты': 'US',
    America: 'US',
    Германия: 'DE',
    Франция: 'FR',
    Испания: 'ES',
    Италия: 'IT',
    Турция: 'TR',
    Великобритания: 'GB',
    Англия: 'GB',
    Канада: 'CA',
    Китай: 'CN',
    Индия: 'IN',
    Япония: 'JP',
  };
  return map[v] || null;
};

/* ============================= GEO SEARCH ============================= */
// 🔎 поиск городов через Nominatim (прокси), + tzLookup
app.get('/geo/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  console.log('[geo/search] q =', q);
  if (!q || q.length < 2) return res.json({ items: [] });

  const TIMEOUT = Number(GEONAMES_TIMEOUT_MS || 6000);
  const withTimeout = (ms) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return { signal: ac.signal, cancel: () => clearTimeout(t) };
  };

  try {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', q);
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '10');

    const { signal, cancel } = withTimeout(TIMEOUT);
    let r, rows;
    try {
      r = await fetch(url.toString(), {
        signal,
        headers: {
          'User-Agent': `cosmotell/1.0 (${NOMINATIM_EMAIL})`,
          Accept: 'application/json',
        },
      });
      const txt = await r.text();
      try {
        rows = JSON.parse(txt);
      } catch {
        rows = null;
      }
    } finally {
      cancel();
    }

    if (!r?.ok || !Array.isArray(rows)) {
      console.warn('[geo/search] http=', r?.status, 'rows ok?', Array.isArray(rows));
      return res.json({ items: [] });
    }

    const items = rows.slice(0, 10).map((it) => {
      const lat = Number(it.lat);
      const lng = Number(it.lon);
      let tz = null;
      try {
        tz = tzLookup(lat, lng);
      } catch {}

      const addr = it.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.hamlet ||
        it.display_name?.split(',')[0] ||
        '';
      const nation = (addr.country_code || '').toUpperCase();
      const admin1 = addr.state || addr.county || null;
      const countryName = addr.country || nation || null;
      const displayName = [city, admin1, countryName].filter(Boolean).join(', ');

      return {
        id: String(it.place_id),
        displayName,
        city,
        nation,
        lat,
        lng,
        tz,
      };
    });

    console.log('[geo/search] items =', items.length);
    return res.json({ items });
  } catch (e) {
    console.error('[geo/search] error', e?.message || e);
    return res.json({ items: [] });
  }
});

/* ============================= HEALTH ============================= */
app.get('/health', (_, res) =>
  res.json({
    ok: true,
    n8n: Boolean(N8N_CHAT_URL || N8N_SPEECH_URL),
    astroKey: Boolean(ASTRO_API_KEY),
    theme: ASTRO_THEME,
  })
);

/* ============================= MOCK CHAT/SPEECH ============================= */
app.post('/chat', async (req, res) => {
  const { text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text is required' });
  return res.json({ reply: `Принято: “${text}”. (мок-ответ)` });
});

const upload = multer({ storage: multer.memoryStorage() });
app.post('/speech', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  // тут можно добавить реальное STT
  return res.json({ text: 'распознанный текст (мок)' });
});

/* ============================= PROFILES ============================= */
app.post('/profiles/sync', async (req, res) => {
  try {
    console.log('[sync] получен запрос:', req.body);
    const { deviceId, me = null, other = null } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

    const row = await upsertProfile(deviceId, me, other);
    console.log('[sync] профиль сохранён, запускаю построение карты для', deviceId);

    buildNatalChartIfPossible(row)
      .then(() => console.log('[sync] генерация карты завершена для', deviceId))
      .catch((err) => console.error('[sync] ошибка построения карты:', err));

    return res.json(row);
  } catch (e) {
    console.error('profiles sync error', e);
    return res.status(500).json({ error: 'profiles sync failed' });
  }
});

app.get('/profiles/:deviceId/chart', async (req, res) => {
  try {
    const row = await getProfile(req.params.deviceId);
    if (!row) return res.status(404).json({ error: 'not found' });

    let svg = row.chart_svg || null;
    if (!svg && row.chart_data && typeof row.chart_data === 'object') {
      svg =
        row.chart_data.chart ||
        row.chart_data.svg ||
        row.chart_data.chart_svg ||
        (row.chart_data.data && (row.chart_data.data.chart || row.chart_data.data.svg)) ||
        null;
    }
    return res.json({ chart_svg: svg });
  } catch (e) {
    console.error('chart get error', e);
    return res.status(500).json({ error: 'chart get failed' });
  }
});

/* ============================= AI → n8n ============================= */
app.post('/ai/query', async (req, res) => {
  try {
    const { deviceId, question } = req.body || {};
    if (!deviceId || !question?.trim()) {
      return res.status(400).json({ error: 'deviceId and question are required' });
    }

    const row = await getProfile(deviceId);
    if (!row?.me) return res.status(404).json({ error: 'profile not found' });

    if (!N8N_CHAT_URL) {
      const name = row.me?.name || 'пользователь';
      return res.json({ reply: `Мок-ИИ: ${name}, на вопрос «${question}» пока отвечу позже.` });
    }

    const payload = {
      question,
      deviceId,
      profile: { me: row.me, other: row.other },
      chart: { svg: row.chart_svg || null, data: row.chart_data || null },
    };
    const ts = Date.now().toString();
    const r = await fetch(N8N_CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': sign(payload, ts),
        'x-timestamp': ts,
      },
      body: JSON.stringify(payload),
    });

    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await r.json() : { reply: await r.text() };
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.json({ reply: data.reply ?? data.text ?? 'Ок.' });
  } catch (e) {
    console.error('ai query error', e);
    return res.status(500).json({ error: 'ai query failed' });
  }
});

/* ============================= BUILD CHART ============================= */
async function buildNatalChartIfPossible(row) {
  try {
    if (!ASTRO_API_KEY) {
      console.log('[chart] skip: no ASTRO_API_KEY');
      return;
    }

    const me = row?.me;
    if (!me?.birthDateISO) {
      console.log('[chart] skip: no birthDateISO');
      return;
    }

    const [Y, M, D] = String(me.birthDateISO).split('-').map(Number);
    const [h, m] =
      me.time && /^\d{2}:\d{2}$/.test(me.time) ? me.time.split(':').map(Number) : [12, 0];

    const coords = me?.coords || {};
    const lat = typeof coords.lat === 'number' ? coords.lat : null;
    const lng = typeof coords.lng === 'number' ? coords.lng : null;
    const tz = me?.tz || null;

    const { city, nation } = parsePlace(me);
    const name = me?.name || 'User';

    // ── 1) проверяем предыдущую "подпись"
    const existing = await getProfile(row.device_id);
    const prevSig =
      existing?.chart_data && typeof existing.chart_data === 'object'
        ? existing.chart_data._signature || null
        : null;

    const currSig = buildSignature({
      Y,
      M,
      D,
      h,
      m,
      lat,
      lng,
      tz,
      theme: ASTRO_THEME,
      zodiac: ASTRO_ZODIAC,
      house: ASTRO_HOUSE_SYSTEM,
    });

    if (existing?.chart_svg && prevSig === currSig) {
      console.log('[chart] signature unchanged, skip rebuild');
      return;
    }

    // ── 2) собираем subject для API
    const base = {
      year: Y,
      month: M,
      day: D,
      hour: h,
      minute: m,
      name,
      zodiac_type: ASTRO_ZODIAC,
      sidereal_mode: null,
      perspective_type: ASTRO_PERSPECTIVE,
      houses_system_identifier: ASTRO_HOUSE_SYSTEM,
    };

    let subject = { ...base };
    const nationCode = normalizeNation(nation);

    if (lat != null && lng != null && tz) {
      subject = {
        ...subject,
        latitude: lat,
        longitude: lng,
        timezone: tz,
        ...(city ? { city } : {}),
        ...(nationCode ? { nation: nationCode } : {}),
      };
      console.log('[chart] используем coords+tz', { lat, lng, tz });
    } else if (GEONAMES_USERNAME && city) {
      subject = {
        ...subject,
        city,
        ...(nationCode ? { nation: nationCode } : {}),
        geonames_username: GEONAMES_USERNAME,
      };
      console.log('[chart] используем GeoNames для города', city);
    } else {
      console.log('[chart] skip: нет coords+tz и не указан GeoNames/город');
      return;
    }

    const body = {
      subject,
      theme: ASTRO_THEME, // dark / classic / etc
      language: ASTRO_LANG,
      wheel_only: false,
    };

    console.log('[chart] theme in body =', ASTRO_THEME);
    console.log('[chart] request →', `${ASTRO_API_BASE}/api/v4/birth-chart`);

    const r = await fetch(`${ASTRO_API_BASE}/api/v4/birth-chart`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': 'astrologer.p.rapidapi.com',
        'X-RapidAPI-Key': ASTRO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const ct = r.headers.get('content-type') || '';
    const raw = await r.text();
    console.log('[chart] response status=', r.status, 'ct=', ct);

    if (!r.ok) {
      console.error('[chart] API error:', raw.slice(0, 600));
      return;
    }

    let svg = null,
      meta = null;

    if (ct.includes('application/json')) {
      try {
        const data = JSON.parse(raw);
        meta = data;
        svg =
          data?.chart ||
          data?.svg ||
          data?.chart_svg ||
          data?.data?.chart ||
          data?.data?.svg ||
          null;

        if (!svg) {
          const unescaped = raw
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\');
          const i = unescaped.indexOf('<svg');
          const j = unescaped.lastIndexOf('</svg>');
          if (i !== -1 && j !== -1) svg = unescaped.slice(i, j + 6);
        }
      } catch (e) {
        console.error('[chart] JSON parse error:', e?.message);
      }
    } else if (ct.includes('image/svg') || raw.trim().startsWith('<svg')) {
      svg = raw;
      meta = { type: 'svg', length: raw.length };
    } else {
      svg = raw.trim().startsWith('<svg') ? raw : null;
    }

    if (!svg || !svg.includes('<svg')) {
      console.error('[chart] no svg found, saving meta for debug');
      await saveChartSvg(row.device_id, null, meta ?? raw.slice(0, 5000));
      return;
    }

    // ── 3) сохраняем SVG + подпись
    let metaToSave = meta;
    try {
      if (!metaToSave || typeof metaToSave !== 'object') metaToSave = {};
      metaToSave._signature = currSig;
      metaToSave._subject = {
        year: Y,
        month: M,
        day: D,
        hour: h,
        minute: m,
        lat,
        lng,
        tz,
        city: city || null,
        nation: nationCode || null,
        theme: ASTRO_THEME,
        zodiac: ASTRO_ZODIAC,
        house: ASTRO_HOUSE_SYSTEM,
      };
    } catch {
      metaToSave = { _signature: currSig };
    }

    await saveChartSvg(row.device_id, svg, metaToSave);
    console.log(`🌌 Chart saved for ${row.device_id}`);
  } catch (e) {
    console.error('Astrologer API error', e);
  }
}

/* ============================= START ============================= */
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
