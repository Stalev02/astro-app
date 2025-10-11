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

// DB
import { getProfile, initDb, upsertProfile } from './db.js';

// ── Инициализация БД (создаст таблицу profiles при первом запуске)
await initDb();
console.log('✅ MySQL connected and initialized');

// ── ffmpeg нужен только если будешь реально перекодировать аудио
ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
app.use(cors());
app.use(express.json());

const { N8N_CHAT_URL = '', N8N_SPEECH_URL = '', N8N_SECRET = 'dev' } = process.env;
const sign = (body, ts) => {
  const data = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return crypto.createHmac('sha256', N8N_SECRET).update(ts + '.' + data).digest('hex');
};

// ── Health
app.get('/health', (_, res) =>
  res.json({ ok: true, n8n: Boolean(N8N_CHAT_URL || N8N_SPEECH_URL) })
);

// ───────────────────────────── CHAT (мок, позже: прокси напрямую)
app.post('/chat', async (req, res) => {
  const { text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text is required' });
  return res.json({ reply: `Принято: “${text}”. (мок-ответ)` });
});

// ───────────────────────────── SPEECH (мок STT)
const upload = multer({ storage: multer.memoryStorage() });
app.post('/speech', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  return res.json({ text: 'распознанный текст (мок)' });
});

// ───────────────────────────── PROFILES (MySQL)
app.post('/profiles/sync', async (req, res) => {
  try {
    const { deviceId, me = null, other = null } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

    const row = await upsertProfile(deviceId, me, other);
    return res.json(row);
  } catch (e) {
    console.error('profiles sync error', e);
    return res.status(500).json({ error: 'profiles sync failed' });
  }
});

app.get('/profiles/:deviceId', async (req, res) => {
  try {
    const row = await getProfile(req.params.deviceId);
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.json(row);
  } catch (e) {
    console.error('profiles get error', e);
    return res.status(500).json({ error: 'profiles get failed' });
  }
});

// ───────────────────────────── AI QUERY → n8n
// Body: { deviceId: string, question: string }
// Возвращает: { reply: string }
app.post('/ai/query', async (req, res) => {
  try {
    const { deviceId, question } = req.body || {};
    if (!deviceId || !question?.trim()) {
      return res.status(400).json({ error: 'deviceId and question are required' });
    }

    // 1) достаём анкету из БД
    const row = await getProfile(deviceId);
    if (!row?.me) {
      return res.status(404).json({ error: 'profile not found' });
    }

    // 2) если N8N_CHAT_URL не задан — отдадим мок с использованием анкеты
    if (!N8N_CHAT_URL) {
      const name = row.me?.name || 'пользователь';
      return res.json({ reply: `Мок-ИИ: ${name}, на вопрос «${question}» пока отвечу позже.` });
    }

    // 3) отправляем в n8n
    const payload = {
      question,
      deviceId,
      profile: { me: row.me, other: row.other }, // всё, что нужно модели
      // можно добавить context, tz, lang и т.д.
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

// ── Start
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
