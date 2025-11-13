import { createClient } from '@netlify/kv';

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  if (!code) return { statusCode: 400, body: 'Missing code' };

  try {
    const kv = createClient();
    const raw = await kv.get(`room:${code}`);
    if (!raw) return { statusCode: 404, body: 'Not found' };
    return { statusCode: 200, body: raw };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
