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
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Identifiant ou mot de passe incorrect.' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, nom: account.nom, role: account.role })
  };
};
