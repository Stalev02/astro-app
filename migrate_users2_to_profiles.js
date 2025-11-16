/**
 * node migrate_users2_to_profiles.js
 * ENV: same .env as server (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
 */
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 load env from server/.env (same as your backend)
dotenv.config({ path: path.join(__dirname, 'server/.env') });

// now read DB_* from process.env
const {
  DB_HOST = 'astroappdb2.mysql.database.azure.com',
  DB_PORT = '3306',
  DB_USER = 'master',
  DB_PASSWORD,
  DB_NAME = 'astro_data',
} = process.env;

const csvPath = path.resolve(process.cwd(), 'astro_data.users2.csv');

function pick(...vals) {
  for (const v of vals) {
    const s = (v ?? '').toString().trim();
    if (s) return s;
  }
  return '';
}
function toISODate(y, m, d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(y)) return y; // already iso
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (y && m && d) return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const raw = pick(y,m,d);
  // Try to normalize things like "12.03.1993" or "03/12/1993"
  const m2 = raw.match(/(\d{1,2}).(\d{1,2}).(\d{4})/);
  if (m2) {
    const [_, dd, mm, yy] = m2;
    return `${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }
  return '';
}
function toHHmm(hh, mm, full) {
  const t = pick(full);
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const h = (hh ?? '').toString().padStart(2,'0');
  const m = (mm ?? '').toString().padStart(2,'0');
  if (/^\d{2}$/.test(h) && /^\d{2}$/.test(m)) return `${h}:${m}`;
  return '';
}

const pool = await mysql.createPool({
  host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  waitForConnections: true, connectionLimit: 5, ssl: { rejectUnauthorized: false },
});

async function upsertUserLink(deviceId, telegramId) {
  await pool.query(
    `INSERT INTO user_links (device_id, telegram_chat_id)
     VALUES (?, ?) ON DUPLICATE KEY UPDATE device_id=VALUES(device_id), telegram_chat_id=VALUES(telegram_chat_id)`,
    [deviceId, telegramId]
  );
}

async function upsertProfile(deviceId, me, other) {
  const meStr = JSON.stringify(me ?? null);
  const otherStr = JSON.stringify(other ?? null);

  await pool.query(
    `INSERT INTO profiles (device_id, me, other)
     VALUES (?, CAST(? AS JSON), CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE me=VALUES(me), other=VALUES(other)`,
    [deviceId, meStr, otherStr]
  );
}

function buildPlace(city, cc) {
  const cityS = (city ?? '').toString().trim();
  const ccS = (cc ?? '').toString().trim();
  if (cityS && ccS) return `${cityS}, ${ccS}`;
  return pick(cityS, ccS);
}

const csv = fs.readFileSync(csvPath, 'utf8');

let records;
try {
  // main attempt: comma-separated, NO quotes
  records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '',              // 🔧 disable quote handling
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });
} catch (e1) {
  console.warn('[csv] comma parse failed, trying semicolon:', e1.message);
  // fallback: semicolon-separated, also no quotes
  records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    quote: '',
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });
}


let ok = 0, fail = 0;
for (const r of records) {
  try {
    const tgId = String(r['MyTelegramID'] ?? r['TelegramID'] ?? '').trim();
    if (!tgId) { fail++; continue; }

    const deviceId = `tg-${tgId}`;

    const name = pick(r['myFirstName'], r['myTelegramName'], r['myName']);
    const birthDateISO = toISODate(r['MyFullDateOfBirth'], r['myYearOfBirth'] && `${r['myYearOfBirth']}-${r['myMonthOfBirth']}-${r['myDayOfBirth']}`, null);
    const time = toHHmm(r['myHourOfBirth'], r['myMinuteOfBirth'], r['myFullTimeOfBirth']);
    const birthPlace = buildPlace(r['myCityOfBirth'], r['myCountryCode']);
    const tz = pick(r['myTimeZone'], r['myTimeZoneOfBirth'], r['timezone']);

    const me = {
      id: `p-${deviceId}`,
      name: name || `tg-${tgId}`,
      date: birthDateISO || undefined,
      birthDateISO: birthDateISO || undefined,
      timeKnown: Boolean(time),
      time: time || undefined,
      birthPlace: birthPlace || undefined,
      place: birthPlace || undefined,
      tz: tz || undefined,
    };

    // Optional partner (if present)
    let other = null;
    const pName = pick(r['PartnerName'], r['partnerName']);
    const pDate = toISODate(r['PartnerFullDateOfBirth'], r['PartnerYearOfBirth'] && `${r['PartnerYearOfBirth']}-${r['PartnerMonthOfBirth']}-${r['PartnerDayOfBirth']}`, null);
    const pTime = toHHmm(r['PartnerHourOfBirth'], r['PartnerMinuteOfBirth'], r['PartnerFullTimeOfBirth']);
    const pPlace = buildPlace(r['PartnerCityOfBirth'], r['PartnerCountryCode']);
    const pTz = pick(r['PartnerTimeZone'], r['partnerTimeZone']);

    if (pName || pDate || pTime || pPlace) {
      other = {
        id: `p2-${deviceId}`,
        name: pName || 'Partner',
        date: pDate || undefined,
        birthDateISO: pDate || undefined,
        timeKnown: Boolean(pTime),
        time: pTime || undefined,
        birthPlace: pPlace || undefined,
        place: pPlace || undefined,
        tz: pTz || undefined,
      };
    }

    await upsertUserLink(deviceId, tgId);
    await upsertProfile(deviceId, me, other);

    ok++;
  } catch (e) {
    console.error('row failed', e?.message);
    fail++;
  }
}

console.log({ ok, fail });
await pool.end();
