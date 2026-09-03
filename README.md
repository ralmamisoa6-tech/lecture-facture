# Lecture de facture — avec connexion et historique privé par personne

Cette version ajoute :
- Un écran de connexion (identifiant + mot de passe), à partir de la liste `accès.xlsx` que tu m'as fournie (76 comptes).
- Un historique de lecture **privé** : chaque personne ne voit que ses propres factures analysées, jamais celles des autres.
- Plus aucune limite de temps sur les factures lues (la suppression automatique après 8h a été retirée).

## ⚠️ Changement important : ce projet ne se dépose plus en glisser-déposer

Pour que l'historique privé fonctionne, le site a besoin d'une petite base de données (**Netlify Blobs**), qui nécessite l'installation d'un paquet (`@netlify/blobs`). Cette installation ne se fait **que** si Netlify construit le site lui-même à partir d'un dépôt GitHub — pas avec le glisser-déposer utilisé jusqu'ici.

Bonne nouvelle : ça reste simple, pas besoin de savoir utiliser Git en ligne de commande.

## Étape 1 — Mettre le projet sur GitHub (sans ligne de commande)

1. Va sur https://github.com et crée un compte gratuit si tu n'en as pas.
2. Clique sur **"New repository"** (bouton vert).
3. Donne-lui un nom, par exemple `lecture-facture`. Laisse-le **Public** ou **Private**, les deux fonctionnent. Clique sur **"Create repository"**.
4. Sur la page du dépôt vide, clique sur **"uploading an existing file"**.
5. Glisse **tout le contenu de ce dossier** (pas le dossier lui-même — son contenu : `index.html` est dans `public/`, garde bien la structure des sous-dossiers `public/` et `netlify/functions/`).
6. En bas, clique sur **"Commit changes"**.

## Étape 2 — Connecter ce dépôt à Netlify

1. Sur https://app.netlify.com, clique sur **"Add a new site" → "Import an existing project"**.
2. Choisis **GitHub**, autorise Netlify à accéder à ton compte, puis sélectionne le dépôt `lecture-facture`.
3. Netlify détecte automatiquement `netlify.toml`. Laisse les réglages par défaut et clique sur **"Deploy site"**.
4. Netlify installe automatiquement `@netlify/blobs` pendant la construction — c'est ce qui manquait avant.

*Remarque : si tu avais déjà un site Netlify créé par glisser-déposer, tu peux soit le remplacer par ce nouveau site connecté à GitHub, soit relier ton site existant à ce dépôt via **Site configuration → Build & deploy → Link repository**.*

## Étape 3 — Ajouter (ou re-vérifier) ta clé Gemini

1. **Site configuration → Environment variables**.
2. Vérifie qu'il y a bien une variable :
   - Nom : `GEMINI_API_KEY`
   - Valeur : ta clé obtenue sur https://aistudio.google.com
3. Si c'est un nouveau site, ajoute-la (elle n'est pas reprise automatiquement d'un ancien site).
4. Redéploie si tu viens de l'ajouter (**Deploys → Trigger deploy → Deploy site**).

## Comment se connecter

Chaque personne se connecte avec son **identifiant** (colonne LOGIN de ton fichier) et son **mot de passe** (colonne Mot de passe). Une fois connectée, elle ne voit que son propre historique de lecture de factures — personne d'autre n'y a accès, y compris les autres comptes "membre".

## ⚠️ À savoir sur la sécurité de cette version

- La liste des comptes (`netlify/functions/credentials.json`) est gardée **hors du dossier public** (`public/`) — elle n'est donc jamais accessible directement via une URL du site. Seules les fonctions serveur peuvent la lire.
- **Cependant**, dans ton fichier d'origine, le mot de passe de chaque personne est identique à son identifiant (ex. login `CN00593`, mot de passe `CN00593`). C'est très faible : n'importe qui connaissant le matricule d'un collègue peut se connecter à sa place. Je recommande, dès que possible, de faire changer ces mots de passe pour quelque chose de moins prévisible — actuellement il n'y a pas d'écran "changer mon mot de passe" dans l'outil ; il faudrait modifier `credentials.json` à la main puis redéployer.
- Les mots de passe sont comparés tels quels (non chiffrés) dans le code de la fonction. C'est acceptable pour un usage interne simple, mais ce n'est pas le niveau de sécurité d'un vrai système de comptes avec mots de passe chiffrés.
- Si la liste de comptes doit évoluer (nouvel arrivant, départ), il faut modifier `netlify/functions/credentials.json` dans le dépôt GitHub et redéployer.

## Pour ajouter, modifier ou supprimer un compte

1. Ouvre `netlify/functions/credentials.json` dans GitHub (bouton crayon pour éditer).
2. Chaque compte est un bloc `{ "login": "...", "password": "...", "nom": "...", "role": "membre" }`.
3. Modifie, ajoute ou supprime un bloc, puis **"Commit changes"** — Netlify redéploie automatiquement.

## Notes générales (reprises de la version précédente)

- Le niveau gratuit de Gemini a des limites de débit (requêtes par minute/jour) — largement suffisant pour un usage interne.
- Sur ce niveau gratuit, Google peut utiliser les documents envoyés pour améliorer ses modèles.
- Les noms de modèles Gemini changent parfois ; le modèle actuel est `gemini-3.5-flash` dans `netlify/functions/analyze.js` (variable `GEMINI_MODEL`).
