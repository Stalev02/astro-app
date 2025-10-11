// server/db.js
import mysql from 'mysql2/promise';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'cosmo',
  DB_PASSWORD = 'secretpass',
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

let engine = { isMaria: false, version: '' };
let useJsonColumns = true;

async function detectEngine(conn) {
  const [rows] = await conn.query('SELECT VERSION() AS v');
  const v = rows?.[0]?.v || '';
  const isMaria = /mariadb/i.test(v);
  return { isMaria, version: v };
}

/** Создаёт таблицу profiles, если её ещё нет */
export async function initDb() {
  const conn = await pool.getConnection();
  try {
    engine = await detectEngine(conn);
    useJsonColumns = !engine.isMaria; // для MySQL — JSON, для Maria — LONGTEXT

    const createSql = useJsonColumns
      ? `
        CREATE TABLE IF NOT EXISTS profiles (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          device_id VARCHAR(64) NOT NULL,
          me JSON NULL,
          other JSON NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_device (device_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `
      : `
        CREATE TABLE IF NOT EXISTS profiles (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          device_id VARCHAR(64) NOT NULL,
          me LONGTEXT NULL,
          other LONGTEXT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_device (device_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `;

    await conn.query(createSql);
    console.log(`[db] engine=${engine.version} (isMaria=${engine.isMaria}) jsonColumns=${useJsonColumns}`);
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
    'SELECT device_id, me, other, UNIX_TIMESTAMP(updated_at)*1000 AS updatedAt FROM profiles WHERE device_id = ? LIMIT 1',
    [deviceId]
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    device_id: row.device_id,
    me: fromDb(row.me),
    other: fromDb(row.other),
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
