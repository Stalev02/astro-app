// combine.js — объединяет исходники в один текстовый файл безопасно
// Запуск: node combine.js
// Итог: ALL_SOURCE_COMBINED_FULL.txt (без node_modules, .env, бинарей и т.д.)

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const OUT = 'ALL_SOURCE_COMBINED_FULL.txt';

// Папки, которые пропускаем
const IGNORE_DIRS = new Set([
  'node_modules', '.expo', 'dist', 'build', 'ios', 'android', '.git', '.idea', '.vscode', '.turbo'
]);

// Расширения, которые включаем
const INCLUDE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss', '.yml', '.yaml', '.toml',
  '.html', '.mjs', '.cjs', '.config', '.lock' // lock-файлы мы все равно отфильтруем ниже
]);

// Файлы, которые исключаем по имени (точно)
const IGNORE_FILES = new Set([
  // безопасность
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  // тяжёлые/неинформативные
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'
]);

// Простая замена секретов, если вдруг попадутся
const SECRET_KEYS = [
  'API_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_URL', 'DB_PASSWORD', 'N8N_SECRET',
  'ASTRO_API_KEY', 'ASTRO_API_BASE', 'NOMINATIM_EMAIL'
];

function isTextLike(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IGNORE_FILES.has(path.basename(filePath))) return false;
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp' || ext === '.svg') return false;
  if (ext === '.ttf' || ext === '.otf' || ext === '.woff' || ext === '.woff2') return false;
  if (ext === '.mp3' || ext === '.m4a' || ext === '.wav' || ext === '.mp4' || ext === '.mov') return false;
  if (ext === '.env') return false; // на всякий случай
  return INCLUDE_EXTS.has(ext) || ext === ''; // без расширения — включим, если текст
}

function redactSecrets(content) {
  let out = content;
  for (const key of SECRET_KEYS) {
    const re = new RegExp(`(${key}\\s*=\\s*)([^\\n\\r]+)`, 'gi');
    out = out.replace(re, (_m, p1) => `${p1}[REDACTED]`);
    const jsonRe = new RegExp(`("${key}"\\s*:\\s*)"(.*?)"`, 'gi');
    out = out.replace(jsonRe, (_m, p1) => `${p1}"[REDACTED]"`);
  }
  return out;
}

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!IGNORE_DIRS.has(name)) walk(full, acc);
    } else {
      if (isTextLike(full)) acc.push(full);
    }
  }
  return acc;
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

const files = walk(process.cwd()).sort();
let parts = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const safe = redactSecrets(content);
  const lines = safe.split(/\r?\n/).length;
  const hash = sha256(safe);
  parts.push(`--- FILE: ${f} ---`);
  parts.push(`--- LINES: ${lines} ---`);
  parts.push(`--- SHA256: ${hash} ---`);
  parts.push(safe);
  parts.push(''); // пустая строка-разделитель
}

fs.writeFileSync(OUT, parts.join('\n'), 'utf8');
console.log(`✅ Combined ${files.length} files into ${OUT}`);
