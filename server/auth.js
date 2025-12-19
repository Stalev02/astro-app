// server/auth.js
import { createClient } from '@supabase/supabase-js';

let admin = null;

function getAdmin() {
  if (admin) return admin;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn('[auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Auth disabled.');
    return null;
  }

  admin = createClient(url, serviceKey);
  console.log('[auth] Supabase admin client initialized');
  return admin;
}

export async function requireAuth(req, res, next) {
  try {
    const sb = getAdmin();
    if (!sb) return res.status(500).json({ error: 'Auth not configured on server' });

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    req.user = { id: data.user.id, email: data.user.email || null };
    return next();
  } catch (e) {
    console.error('[auth] verify failed:', e?.message || e);
    return res.status(401).json({ error: 'Auth failed' });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const sb = getAdmin();
    if (!sb) return next();

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return next();

    const { data, error } = await sb.auth.getUser(token);
    if (!error && data?.user) {
      req.user = { id: data.user.id, email: data.user.email || null };
    }
    return next();
  } catch {
    return next();
  }
}
