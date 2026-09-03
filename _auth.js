// Petit module partagé : vérifie un identifiant / mot de passe par rapport
// à la liste de comptes (credentials.json), qui n'est JAMAIS servie au navigateur
// car elle vit dans netlify/functions, en dehors du dossier "public" publié.

const credentials = require('./credentials.json');

function findAccount(login, password){
  if (!login || !password) return null;
  const account = credentials.find(c => c.login === login);
  if (!account) return null;
  if (account.password !== password) return null;
  return account;
}

module.exports = { findAccount };
