import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return { statusCode: 400, body: 'Missing id' };

  try {
    const store = getStore('quizzes');
    const data = await store.getJSON(`quiz/${id}.json`);
    if (!data) return { statusCode: 404, body: 'Not found' };
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
