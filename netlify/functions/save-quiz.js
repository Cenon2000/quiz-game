import { getStore } from '@netlify/blobs';
import crypto from "node:crypto";


export default async (req) => {
  if (req.method !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { title, data, author } = JSON.parse(req.body || '{}');
    if (!title || !data) {
      return { statusCode: 400, body: 'Missing title or data' };
    }

    const store = getStore('quizzes'); // bucket/namespace "quizzes"
    const id = crypto.randomUUID();
    const key = `quiz/${id}.json`;

    // 1) Quiz speichern
    await store.setJSON(key, { id, title, data, author, created_at: new Date().toISOString() });

    // 2) Index aktualisieren (einfaches Array)
    const indexKey = 'index.json';
    const index = (await store.getJSON(indexKey)) || [];
    index.unshift({ id, title, author, created_at: new Date().toISOString() });
    // Max. Liste begrenzen (optional):
    if (index.length > 5000) index.length = 5000;
    await store.setJSON(indexKey, index);

    return { statusCode: 200, body: JSON.stringify({ id, title }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
