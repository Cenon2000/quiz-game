import { createClient } from '@netlify/kv';

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return { statusCode: 405, body: 'Method not allowed' };
  }


  try {
    const { code, patch } = JSON.parse(req.body || '{}');
    if (!code || !patch) return { statusCode: 400, body: 'Missing code or patch' };

    const kv = createClient();
    const raw = await kv.get(`room:${code}`);
    if (!raw) return { statusCode: 404, body: 'Room not found' };
    const room = JSON.parse(raw);

    // einfache, flache Patches: { state: {...}, players: [...]} etc.
    // (falls du tief mergen willst, hier rekursiv erweitern)
    const merged = { ...room, ...patch };

    await kv.set(`room:${code}`, JSON.stringify(merged), { expirationTtl: 60 * 60 * 6 });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
