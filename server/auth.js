// server/auth.js
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

// ВАЖНО: это админ-клиент ТОЛЬКО для сервера (service role key — секрет).
// Никогда не добавляй этот ключ во фронтенд.
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    req.user = {
      id: data.user.id,
      email: data.user.email || null,
    };
    next();
  } catch (e) {
    console.error('[auth] verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Auth failed' });
  }
}
