import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DOSSIER_DONNEES = mkdtempSync(path.join(tmpdir(), 'repastator-'));
let base, serveur;
before(async () => {
  ({ serveur } = await import('../serveur.js'));
  await new Promise((ok) => serveur.listen(0, ok));
  base = `http://localhost:${serveur.address().port}`;
});
after(() => serveur.close());

const en = (qui) => ({ 'x-utilisateur': qui, 'content-type': 'application/json' });
const lire = async (qui) => (await fetch(`${base}/api/donnees`, { headers: en(qui) })).json();
const ecrire = (qui, cle, valeur, version) =>
  fetch(`${base}/api/donnees/${cle}`, { method: 'PUT', headers: en(qui), body: JSON.stringify({ valeur: JSON.stringify(valeur), version }) });

test('santé : répond sans connexion', async () => {
  assert.equal((await fetch(`${base}/sante`)).status, 200);
});

test('données du foyer partagées, versions successives', async () => {
  assert.equal((await ecrire('max', 'cuisinator_shopping', [{ id: 1, name: 'Pain' }], 0)).status, 200);
  const copine = await lire('copine');
  assert.deepEqual(JSON.parse(copine.cles.cuisinator_shopping.valeur), [{ id: 1, name: 'Pain' }]);
  assert.equal(copine.cles.cuisinator_shopping.version, 1);
  assert.equal((await ecrire('copine', 'cuisinator_shopping', [], 1)).status, 200);
});

test('modification simultanée : le second est prévenu (409) avec la version gagnante', async () => {
  const v = (await lire('max')).cles.cuisinator_recipes?.version ?? 0;
  assert.equal((await ecrire('max', 'cuisinator_recipes', [{ id: 1 }], v)).status, 200);
  const r = await ecrire('copine', 'cuisinator_recipes', [{ id: 2 }], v);
  assert.equal(r.status, 409);
  const corps = await r.json();
  assert.equal(corps.par, 'max');
  assert.deepEqual(JSON.parse(corps.valeur), [{ id: 1 }]);
});

test('sport et maison retirés : clés refusées', async () => {
  assert.equal((await ecrire('max', 'cuisinator_sport_sessions', [], 0)).status, 404);
  assert.equal((await ecrire('max', 'cuisinator_room_projects', [], 0)).status, 404);
  assert.equal((await ecrire('max', 'cuisinator_rooms', [], 0)).status, 404);
  assert.equal((await ecrire('max', 'cuisinator_room_tasks', [], 0)).status, 404);
});

test('clé inconnue ou valeur invalide : refusée', async () => {
  assert.equal((await ecrire('max', 'autre_chose', [], 0)).status, 404);
  const r = await fetch(`${base}/api/donnees/cuisinator_shopping`, { method: 'PUT', headers: en('max'), body: JSON.stringify({ valeur: 'pas du json', version: 0 }) });
  assert.equal(r.status, 400);
});
