# RepasTator 3000 — Contexte projet

Site web de recettes, de planning des repas et de liste de courses : https://repas.mjacquot.fr.
S'installe comme une appli depuis le navigateur (« Ajouter à l'écran d'accueil ») ; **ce n'est plus une appli Expo**.

**Historique** : Cuisinator 3000, puis Maisontator 3000, renommée RepasTator 3000 le 2026-10-08. Appli Expo (React Native) jusqu'au
**2026-10-17**, puis **réécrite en site web simple** (demande de Max : « je veux le site et qu'on puisse l'installer depuis le navigateur,
mais plus que ce soit une appli »). Personne n'utilisait plus la version installée par Expo. L'ancien code est dans l'historique git (avant le commit « Réécriture en site web »).
Identifiants techniques **gardés** (liés aux données) : clés `cuisinator_*` sur le serveur, clé de droits `cuisinator` dans le portail.

## Technique
- **Aucune dépendance, aucune étape de construction** : `public/` est servi tel quel par `api/serveur.js` (Node 24, `node:sqlite`).
- Page : `public/index.html` + `public/style.css` + modules ES dans `public/js/` (JavaScript sans framework, comme Compta et NeuroPsy).
  - `app.js` : écrans, adresses (`/`, `/recettes`, `/courses`, `/recette/<id>` ; l'ancienne `/recipe/<id>` marche aussi), barre d'onglets en bas, chargement des données, bandeau de conflit, rechargement au retour sur l'onglet.
  - `planning.js` (7 jours, midi / soir, 2 accompagnements ; téléphone : un jour par page, on glisse ; ordinateur ≥ 900 px : grille),
    `recettes.js` (recherche, filtres, import / export), `recette.js` (fiche, frise des étapes, modification), `courses.js` (par recette ou par rayon).
  - `fenetres.js` : choisir une recette, ajouter au planning, ingrédients à acheter (− / + qui se répètent quand on reste appuyé), import, ajout d'article.
  - `calculs.js` (recherche, fusion des quantités des courses, rayons, ajustement des quantités), `import.js` (import JSON + prompt IA, export), `donnees.js` (les trois clés), `stockage.js` (mémoire + envoi au serveur), `ui.js` (éléments, fenêtres `<dialog>`, messages, dates), `recettes-depart.js`.
- **Style** : style commun de mjacquot.fr (`https://mjacquot.fr/charte.css`, Sandstone, voir `portail/docs/decisions.md` P06) chargé avant `style.css`. Couleur de l'appli : terracotta `#C74B2B` ; titres en Playfair Display (`public/polices/`, servie par l'appli). **Jamais** `alert` / `confirm` : `message()` / `confirmer()` de `ui.js`.
- Volet « Mes applications » : `<span id="volet-outils">` dans l'en-tête de chaque écran (le script du portail suit les changements d'écran).
- **Appli installable** (PWA) : `public/manifest.webmanifest`, `public/icones/`, balises dans `index.html`. Le back sert manifeste et icônes sans connexion (voir `serveur-infra/docs/decisions.md` D18).

## Données (sur le serveur, partagées par le foyer)
- Base `/srv/data/repastator/repastator.sqlite`, une ligne par clé (JSON), avec version : modification simultanée → 409, la version du serveur gagne, la page prévient. Historique des 50 dernières versions par clé (table `historique`).
- `cuisinator_recipes` : `[{ id, title, category ('Entrée'|'Plat'|'Dessert'), prep_time, cook_time, description, ingredients (JSON [{qty, unit, name}], quantités pour 1 personne), steps (JSON [{label, instruction, duration, type: prep|cook|wait|rest}]), tags (JSON) }]`.
- `cuisinator_meal_plans` : `{ "AAAA-MM-JJ": { lunch, dinner, lunch_side, dinner_side, lunch_side2, dinner_side2 (id ou null), lunch_people, dinner_people } }`.
- `cuisinator_shopping` : `[{ id, name (« 400 g farine »), recipe_name ('' = ajouté à la main), done (0|1) }]`.
- Ajouter au planning : les nouveaux créneaux ne sont écrits qu'après la fenêtre « Ingrédients à acheter » (fermée = rien n'est planifié).

## Local, tests, déploiement
- Local : `npm start` → http://localhost:3000 (utilisateur « dev »). Le style commun vient de `https://mjacquot.fr` (sans internet : page sans style commun).
- Tests : `npm test` (calculs de la page `tests/`, API et site `api/tests/`).
- Déploiement : push sur `main` → GitHub Actions (tests + `node --check` des modules) → `deployer-projet repastator` (image Docker sans étape de construction).
- 2026-10-17 — Réécriture vérifiée dans Chrome sans fenêtre (390 px et 1280 px) : planning, choix d'une recette, planning sur plusieurs jours, ingrédients ajustés, accompagnement, recherche, fiche, modification, import, courses par recette / rayon, ajout d'article, vider, rechargement (données gardées). 13 tests.
