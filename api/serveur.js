// Back de la version web de RepasTator (repas.mjacquot.fr).
// - sert l'appli web (export Expo, dossier dist/) ;
// - stocke les données dans SQLite (node:sqlite, sans dépendance) : une ligne par clé, en JSON,
//   avec un numéro de version (deux personnes qui modifient la même chose : le second est prévenu) ;
// - garde l'historique des 50 dernières versions de chaque clé (pour réparer une erreur).
//
// Connexion : par le portail mjacquot.fr (Caddy transmet X-Utilisateur). En local : « dev ».
// Toutes les données sont partagées par le foyer (recettes, planning, courses).
// Les clés gardent leur préfixe historique « cuisinator_ » (ancien nom de l'appli).
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const PRODUCTION = process.env.NODE_ENV === 'production';
const DOSSIER_DONNEES = process.env.DOSSIER_DONNEES ?? path.resolve('donnees-locales');
const DIST = path.resolve(import.meta.dirname, '../dist');
const TAILLE_MAX = 5 * 1024 * 1024;
const HISTORIQUE = 50;

const CLES_FOYER = [
  'cuisinator_recipes',
  'cuisinator_meal_plans',
  'cuisinator_shopping',
];

mkdirSync(DOSSIER_DONNEES, { recursive: true });
const db = new DatabaseSync(path.join(DOSSIER_DONNEES, 'repastator.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS donnees (
    espace TEXT NOT NULL, cle TEXT NOT NULL, valeur TEXT NOT NULL, version INTEGER NOT NULL,
    maj_par TEXT NOT NULL, maj_le TEXT NOT NULL, PRIMARY KEY (espace, cle)
  );
  CREATE TABLE IF NOT EXISTS historique (
    id INTEGER PRIMARY KEY AUTOINCREMENT, espace TEXT NOT NULL, cle TEXT NOT NULL,
    valeur TEXT NOT NULL, version INTEGER NOT NULL, maj_par TEXT NOT NULL, maj_le TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS historique_cle ON historique (espace, cle, id);
`);
const lireToutes = db.prepare('SELECT cle, valeur, version FROM donnees WHERE espace = ?');
const lireUne = db.prepare('SELECT valeur, version, maj_par FROM donnees WHERE espace = ? AND cle = ?');
const ecrire = db.prepare(`
  INSERT INTO donnees (espace, cle, valeur, version, maj_par, maj_le) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (espace, cle) DO UPDATE SET valeur = excluded.valeur, version = excluded.version,
    maj_par = excluded.maj_par, maj_le = excluded.maj_le`);
const archiver = db.prepare('INSERT INTO historique (espace, cle, valeur, version, maj_par, maj_le) VALUES (?, ?, ?, ?, ?, ?)');
const purger = db.prepare(`
  DELETE FROM historique WHERE espace = ? AND cle = ? AND id NOT IN (
    SELECT id FROM historique WHERE espace = ? AND cle = ? ORDER BY id DESC LIMIT ${HISTORIQUE})`);

const espaceDe = (cle) => (CLES_FOYER.includes(cle) ? 'foyer' : null);

function utilisateurDe(req) {
  return req.headers['x-utilisateur'] || (PRODUCTION ? null : 'dev');
}

const json = (res, code, donnees) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(donnees));
};

async function lireJson(req) {
  let corps = '';
  for await (const morceau of req) {
    corps += morceau;
    if (corps.length > TAILLE_MAX) throw Object.assign(new Error('Trop gros'), { code: 413 });
  }
  return JSON.parse(corps);
}

/** Écrit une clé si la version envoyée est la version actuelle. */
export function enregistrer(espace, cle, valeur, versionConnue, utilisateur) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const actuelle = lireUne.get(espace, cle);
    if ((actuelle?.version ?? 0) !== versionConnue) {
      db.exec('ROLLBACK');
      return { conflit: true, valeur: actuelle?.valeur ?? null, version: actuelle?.version ?? 0, par: actuelle?.maj_par ?? '' };
    }
    const version = versionConnue + 1;
    const maintenant = new Date().toISOString();
    ecrire.run(espace, cle, valeur, version, utilisateur, maintenant);
    archiver.run(espace, cle, valeur, version, utilisateur, maintenant);
    purger.run(espace, cle, espace, cle);
    db.exec('COMMIT');
    return { conflit: false, version };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

async function fichierStatique(res, route) {
  const chemin = path.normalize(path.join(DIST, decodeURIComponent(route)));
  if (!chemin.startsWith(DIST)) return false;
  try {
    const contenu = await readFile(chemin);
    const ext = path.extname(chemin);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      // Les fichiers d'Expo ont une empreinte dans leur nom : cache long. index.html : jamais en cache.
      'Cache-Control': route.startsWith('/_expo/') || route.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(contenu);
    return true;
  } catch {
    return false;
  }
}

async function router(req, res) {
  const route = new URL(req.url, 'http://local').pathname;
  if (route === '/sante') return json(res, 200, { ok: true });

  const utilisateur = utilisateurDe(req);
  if (!utilisateur) return json(res, 401, { erreur: 'Non connecté.' });

  if (route === '/api/donnees' && req.method === 'GET') {
    const cles = {};
    for (const { cle, valeur, version } of lireToutes.all('foyer')) {
      if (CLES_FOYER.includes(cle)) cles[cle] = { valeur, version };
    }
    return json(res, 200, { utilisateur, cles });
  }

  const m = /^\/api\/donnees\/([\w-]+)$/.exec(route);
  if (m && req.method === 'PUT') {
    const espace = espaceDe(m[1]);
    if (!espace) return json(res, 404, { erreur: 'Clé inconnue.' });
    const { valeur, version } = await lireJson(req);
    if (typeof valeur !== 'string' || !Number.isInteger(version)) return json(res, 400, { erreur: 'Requête invalide.' });
    try {
      JSON.parse(valeur);
    } catch {
      return json(res, 400, { erreur: 'Valeur invalide.' });
    }
    const r = enregistrer(espace, m[1], valeur, version, utilisateur);
    return r.conflit ? json(res, 409, r) : json(res, 200, { version: r.version });
  }

  if (route.startsWith('/api/')) return json(res, 404, { erreur: 'Introuvable.' });

  // Appli web : fichier existant, sinon index.html (les routes /planning, /recipe/3… sont gérées par l'appli)
  if (req.method === 'GET' && route !== '/' && (await fichierStatique(res, route))) return;
  if (req.method === 'GET' && (await fichierStatique(res, '/index.html'))) return;
  json(res, 404, { erreur: 'Introuvable.' });
}

const serveur = createServer((req, res) => {
  router(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) json(res, e.code === 413 ? 413 : 500, { erreur: 'Erreur du serveur.' });
  });
});
if (process.env.NODE_ENV !== 'test') serveur.listen(PORT, () => console.log(`RepasTator : http://localhost:${PORT}`));
export { serveur };
