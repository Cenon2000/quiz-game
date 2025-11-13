import { getStore } from '@netlify/blobs';

export default async () => {
  try {
    const store = getStore('quizzes');
    const index = (await store.getJSON('index.json')) || [];
    return { statusCode: 200, body: JSON.stringify(index) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
