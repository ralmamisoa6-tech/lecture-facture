const { getStore } = require('@netlify/blobs');
const { findAccount } = require('./_auth');

const SYSTEM_PROMPT = `Tu analyses des factures fournies en PDF pour un particulier qui veut les comprendre rapidement.

Règle de numérotation des factures : le numéro de facture suit le format F + AA + MM + suite de chiffres (ex. F2507xxxxxx = facture émise pour le mois 07, année 2025, donc juillet 2025). Repère ce numéro dans le document et interprète-le selon cette règle si le format correspond ; sinon indique-le clairement.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown, avec exactement ces clés (toutes en chaîne de texte, en français, concis et clair, sans jargon inutile) :
{
  "mois_facture": "mois et année de la facture, ex. Juillet 2025",
  "numero_facture": "le numéro de facture tel que lu sur le document",
  "interpretation_numero": "explication du numéro selon la règle F+AAMM+xxxxxx, en une phrase",
  "explication": "explication claire en 2 à 4 phrases de ce que couvre cette facture (service, contenu, contexte)",
  "duree_periode": "période exacte couverte par la facture (dates de début et fin si présentes), en précisant explicitement si c'est un prorata (période partielle) ou une période complète standard",
  "montant_total": "montant total à payer, avec la devise",
  "date_limite_paiement": "date limite de paiement telle qu'indiquée, ou 'Non précisée sur le document' si absente",
  "mode_reglement": "mode de règlement indiqué (prélèvement, virement, carte, etc.), ou 'Non précisé sur le document' si absent",
  "frais_regularisations": "détail des frais additionnels, régularisations, impayés antérieurs ou pénalités s'il y en a ; sinon écrire 'Aucun frais ni régularisation mentionné sur cette facture'"
}

Règle particulière — virement bancaire externe : si, dans la rubrique "AUTRES PRODUITS ET SERVICES" (ou une rubrique équivalente), le document contient une ligne de type "Virement bancaire (EXTERNAL_xxxxxxxxx)" avec un sous-total, alors cela signifie que la facture du mois en cours doit être réglée durant ce même mois, et qu'une fois le paiement effectué et correctement enregistré, le rejet de paiement associé est annulé automatiquement par le système — aucune annulation manuelle du rejet n'est nécessaire une fois la facture régularisée. Si tu détectes une telle ligne, explique ce point dans le champ "virement_rejet_paiement" ci-dessous en reprenant cette logique avec la référence EXTERNAL_ trouvée. Si aucune ligne de ce type n'est présente, laisse ce champ vide ("").

Ajoute cette clé supplémentaire au JSON :
"virement_rejet_paiement": "explication du virement bancaire externe détecté et de l'annulation automatique du rejet de paiement, ou chaîne vide si non applicable"

Si une information est réellement introuvable dans le document, ne l'invente jamais : indique-le explicitement dans le champ concerné.`;

// Modèle Flash gratuit (les noms de modèles Gemini évoluent souvent —
// si ce nom devient obsolète, vérifier le modèle Flash courant sur
// https://ai.google.dev/gemini-api/docs/models et le remplacer ici).
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const MAX_HISTORY_PER_USER = 200; // on garde les 200 dernières lectures par personne

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "La clé API n'est pas configurée sur le serveur (variable GEMINI_API_KEY manquante)." })
    };
  }

  let base64Pdf, filename, login, password;
  try {
    const parsedBody = JSON.parse(event.body || '{}');
    base64Pdf = parsedBody.base64Pdf;
    filename = parsedBody.filename || '';
    login = (parsedBody.login || '').trim();
    password = parsedBody.password || '';
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide' }) };
  }

  const account = findAccount(login, password);
  if (!account) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide, merci de te reconnecter.' }) };
  }

  if (!base64Pdf) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Aucun PDF reçu' }) };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
              { text: 'Analyse cette facture et renvoie uniquement le JSON demandé.' }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
          response_mime_type: 'application/json'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: (data && data.error && data.error.message) || "Erreur lors de l'appel à l'API Gemini" })
      };
    }

    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts.map(p => p.text || '').join('');

    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Réponse vide du modèle' }) };
    }

    // Sauvegarde dans l'historique privé de la personne connectée (Netlify Blobs).
    try {
      let parsedForHistory = null;
      try { parsedForHistory = JSON.parse(text); } catch (e) { /* on sauvegarde quand même le texte brut plus bas si besoin */ }

      const store = getStore('invoice-history');
      const key = login; // un identifiant unique par personne
      const existingRaw = await store.get(key, { type: 'json' }).catch(() => null);
      const existing = Array.isArray(existingRaw) ? existingRaw : [];

      existing.unshift({
        addedAt: Date.now(),
        filename,
        data: parsedForHistory
      });

      const trimmed = existing.slice(0, MAX_HISTORY_PER_USER);
      await store.setJSON(key, trimmed);
    } catch (histErr) {
      // On ne bloque jamais la réponse à l'utilisateur si l'historique échoue à s'enregistrer.
      console.error('Erreur d\'enregistrement de l\'historique :', histErr);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: [{ type: 'text', text }] })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
