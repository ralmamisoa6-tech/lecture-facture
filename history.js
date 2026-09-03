const { getStore } = require('@netlify/blobs');
const { findAccount } = require('./_auth');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  let login, password;
  try {
    const body = JSON.parse(event.body || '{}');
    login = (body.login || '').trim();
    password = body.password || '';
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide' }) };
  }

  const account = findAccount(login, password);
  if (!account) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide, merci de te reconnecter.' }) };
  }

  try {
    const store = getStore('invoice-history');
    const items = await store.get(login, { type: 'json' }).catch(() => null);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
