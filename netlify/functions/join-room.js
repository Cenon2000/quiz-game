import { createClient } from '@netlify/kv';
import crypto from "node:crypto";


export default async (req) => {
  if (req.method !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { code, name } = JSON.parse(req.body || '{}');
    if (!code || !name) return { statusCode: 400, body: 'Missing code or name' };

    const kv = createClient();
    const raw = await kv.get(`room:${code}`);
    if (!raw) return { statusCode: 404, body: 'Room not found' };
    const room = JSON.parse(raw);

    // existiert Spieler schon?
    let player = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!player) {
      player = { id: crypto.randomUUID(), name, score: 0 };
      room.players.push(player);
    }

    await kv.set(`room:${code}`, JSON.stringify(room), { expirationTtl: 60 * 60 * 6 });
    return { statusCode: 200, body: JSON.stringify(player) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
