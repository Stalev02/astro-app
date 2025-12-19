// server/db.js
import fs from 'fs';
import mysql from 'mysql2/promise';

const {
  DB_HOST='astroappdb2.mysql.database.azure.com',
  DB_PORT = '3306',
  DB_USER = 'master',
  DB_PASSWORD = '4YU2c7@@v2zUUdQxJ',
  DB_NAME = 'astro_data',

   DB_SSL = 'require',                              // 'require' | 'disable'
  DB_SSL_CA_PATH = '',                             // path to DigiCert/Baltimore CA if you want strict pinning
} = process.env;

let ssl;
if (DB_SSL !== 'disable') {
  const caPath = (DB_SSL_CA_PATH || '').trim();
  if (caPath) {
    try {
      ssl = { ca: fs.readFileSync(caPath), rejectUnauthorized: true };
      console.log('[db] SSL: using CA from', caPath);
    } catch (e) {
      console.warn('[db] SSL CA read failed:', e?.message, '→ falling back to generic TLS');
      ssl = { rejectUnauthorized: true };
    }
  } else {
    // Generic TLS – works for Azure without pinning a CA file
    ssl = { rejectUnauthorized: true };
    console.log('[db] SSL: generic TLS (no CA path provided)');
  }
} else {
  ssl = undefined;
  console.log('[db] SSL disabled by env');
}

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  ssl, // ← important for Azure
});

let useJsonColumns = true;

const TABLE = 'users';

/** Определяем движок/версию, чтобы понимать — есть ли JSON-тип */
async function detectEngine() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query('SELECT VERSION() AS v');
    const v = rows?.[0]?.v || '';
    const isMaria = /mariadb/i.test(v);
    useJsonColumns = !isMaria; // у MariaDB старых версий JSON = LONGTEXT
    console.log(`[db] engine=${v} (isMaria=${isMaria}) jsonColumns=${useJsonColumns}`);
  } finally {
    conn.release();
  }
}

/** Создаёт таблицу profiles, если её ещё нет */
export async function initDb() {
  await detectEngine();

  const conn = await pool.getConnection();
  try {
    const jsonOrText = useJsonColumns ? 'JSON' : 'LONGTEXT';

    const createSql = `
      CREATE TABLE IF NOT EXISTS profiles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        device_id VARCHAR(64) NOT NULL,
        me ${jsonOrText} NULL,
        other ${jsonOrText} NULL,
        chart_svg LONGTEXT NULL,
        chart_data ${jsonOrText} NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_device (device_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await conn.query(createSql);
    try {
  await conn.query(`ALTER TABLE profiles ADD COLUMN supabase_uid CHAR(36) NULL`);
} catch {}
try {
  await conn.query(`CREATE UNIQUE INDEX uq_supabase_uid ON profiles(supabase_uid)`);
} catch {}
  } finally {
    conn.release();
  }
}

function toDb(val) {
  return JSON.stringify(val ?? null);
}
function fromDb(val) {
  if (val == null) return null;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return null; }
}

export async function getProfile(deviceId) {
  const [rows] = await pool.query(
    `SELECT
       device_id,
       supabase_uid,
       me,
       other,
       chart_svg,
       chart_data,
       UNIX_TIMESTAMP(updated_at)*1000 AS updatedAt
     FROM profiles
     WHERE device_id = ?
     LIMIT 1`,
    [deviceId]
  );
  const row = rows?.[0];
  if (!row) return null;

  return {
    device_id: row.device_id,
    me: typeof row.me === 'string' ? fromDb(row.me) : row.me,
    other: typeof row.other === 'string' ? fromDb(row.other) : row.other,
    chart_svg: row.chart_svg ?? null,
    chart_data:
      typeof row.chart_data === 'string' ? fromDb(row.chart_data) : row.chart_data ?? null,
    updatedAt: Number(row.updatedAt) || Date.now(),
  };
}

export async function upsertProfile(deviceId, me, other) {
  if (useJsonColumns) {
    await pool.query(
      `
      INSERT INTO profiles (device_id, me, other)
      VALUES (?, CAST(? AS JSON), CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        me = VALUES(me),
        other = VALUES(other)
      `,
      [deviceId, toDb(me), toDb(other)]
    );
  } else {
    await pool.query(
      `
      INSERT INTO profiles (device_id, me, other)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        me = VALUES(me),
        other = VALUES(other)
      `,
      [deviceId, toDb(me), toDb(other)]
    );
  }
  return await getProfile(deviceId);
}

export async function getProfileBySupabaseUid(supabaseUid) {
  const [rows] = await pool.query(
    `SELECT
       device_id,
       supabase_uid,
       me,
       other,
       chart_svg,
       chart_data,
       UNIX_TIMESTAMP(updated_at)*1000 AS updatedAt
     FROM profiles
     WHERE supabase_uid = ?
     LIMIT 1`,
    [supabaseUid]
  );

  const row = rows?.[0];
  if (!row) return null;

  return {
    device_id: row.device_id,
    supabase_uid: row.supabase_uid ?? null,
    me: typeof row.me === 'string' ? fromDb(row.me) : row.me,
    other: typeof row.other === 'string' ? fromDb(row.other) : row.other,
    chart_svg: row.chart_svg ?? null,
    chart_data: typeof row.chart_data === 'string' ? fromDb(row.chart_data) : row.chart_data ?? null,
    updatedAt: Number(row.updatedAt) || Date.now(),
  };
}

export async function attachSupabaseUidToDeviceProfile(deviceId, supabaseUid) {
  // Only attach if the row is still a guest row
  await pool.query(
    `UPDATE profiles
     SET supabase_uid = ?
     WHERE device_id = ?
       AND (supabase_uid IS NULL OR supabase_uid = '')`,
    [supabaseUid, deviceId]
  );
}

export async function upsertProfileWithIds({ deviceId, supabaseUid, me, other }) {
  // This keeps old behavior but also stores supabase_uid if provided.
  if (useJsonColumns) {
    await pool.query(
      `
      INSERT INTO profiles (device_id, supabase_uid, me, other)
      VALUES (?, ?, CAST(? AS JSON), CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE
        supabase_uid = COALESCE(VALUES(supabase_uid), supabase_uid),
        me = VALUES(me),
        other = VALUES(other)
      `,
      [deviceId, supabaseUid ?? null, toDb(me), toDb(other)]
    );
  } else {
    await pool.query(
      `
      INSERT INTO profiles (device_id, supabase_uid, me, other)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        supabase_uid = COALESCE(VALUES(supabase_uid), supabase_uid),
        me = VALUES(me),
        other = VALUES(other)
      `,
      [deviceId, supabaseUid ?? null, toDb(me), toDb(other)]
    );
  }

  // Prefer returning by supabase uid if we have it
  if (supabaseUid) return await getProfileBySupabaseUid(supabaseUid);
  return await getProfile(deviceId);
}


// ===== Сохраняем SVG и метаданные карты =====
export async function saveChartSvg(deviceId, svg, meta = null) {
  const chartData = meta ? JSON.stringify(meta) : null;

  async function alter() {
    // На старых MySQL/MariaDB IF NOT EXISTS может не поддерживаться — оборачиваем в try/catch
    try {
      await pool.query(`ALTER TABLE profiles ADD COLUMN chart_svg LONGTEXT NULL`);
    } catch {}
    try {
      await pool.query(
        `ALTER TABLE profiles ADD COLUMN chart_data ${useJsonColumns ? 'JSON' : 'LONGTEXT'} NULL`
      );
    } catch {}
  }

  async function update() {
    await pool.query(
      `UPDATE profiles SET chart_svg = ?, chart_data = ? WHERE device_id = ?`,
      [svg, chartData, deviceId]
    );
  }

  try {
    await update();
    console.log(`[db] chart_svg сохранён для ${deviceId}`);
  } catch (e) {
    if (e?.code === 'ER_BAD_FIELD_ERROR') {
      console.warn('[db] нет колонок chart_svg/chart_data — добавляю...');
      await alter();
      await update();
      console.log(`[db] chart_svg сохранён (после ALTER) для ${deviceId}`);
    } else {
      console.error('[db] ошибка при сохранении chart_svg:', e);
      throw e;
    }
  }
}
