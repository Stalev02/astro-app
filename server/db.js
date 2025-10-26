// server/db.js
import mysql from 'mysql2/promise';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'cosmo',
  DB_PASSWORD = '',
  DB_NAME = 'cosmotell',
} = process.env;

export const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z', // UTC
});

let useJsonColumns = true;

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
