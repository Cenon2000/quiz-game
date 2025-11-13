import { createClient } from '@netlify/kv';

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i=0;i<6;i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}

export default async (req) => {
  if (req.method !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { quizId, hostName } = JSON.parse(req.body || '{}');
    if (!quizId) return { statusCode: 400, body: 'Missing quizId' };

    const kv = createClient();
    // Prüf-Schleife bis ein freier Code gefunden ist
    let code;
    for (let i=0;i<8;i++){
      code = randomCode();
      const exists = await kv.get(`room:${code}`);
      if (!exists) break;
      code = null;
    }
    if (!code) return { statusCode: 500, body: 'Failed to allocate room code' };

    const room = {
      code,
      quizId,
      hostName: hostName || 'Host',
      created_at: Date.now(),
      players: [],           // {id,name,score}
      state: {
        boardIndex: 0,
        used: [],
        currentCell: null,   // {catIdx,qIdx,points,text}
        buzzMode: false,
        currentBuzzPlayerId: null
      }
    };

    await kv.set(`room:${code}`, JSON.stringify(room), { expirationTtl: 60 * 60 * 6 }); // 6h TTL

    return { statusCode: 200, body: JSON.stringify({ code }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
