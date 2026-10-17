// Calculs de la page (public/js/calculs.js, import.js) : mêmes résultats que l'ancienne appli Expo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lireIngredients, chercherRecettes, lireLigneCourses, fusionnerCourses, rayonDe, groupesParRayon, groupesParRecette,
  lignesAAcheter, pas, texteLigne, cleArticle, additionner, ligneActive,
} from '../public/js/calculs.js';
import { lireImport, exporterRecettes } from '../public/js/import.js';

const recette = (id, title, ingredients, tags = []) => ({
  id, title, category: 'Plat', prep_time: 10, cook_time: 0, description: '', steps: '',
  ingredients: JSON.stringify(ingredients), tags: JSON.stringify(tags),
});

test('ingrédients : JSON, ou ancien format une ligne par ingrédient', () => {
  assert.deepEqual(lireIngredients('[{"qty":2,"unit":"g","name":"sel"}]'), [{ qty: 2, unit: 'g', name: 'sel' }]);
  assert.deepEqual(lireIngredients('farine\nœufs'), [{ qty: null, unit: '', name: 'farine' }, { qty: null, unit: '', name: 'œufs' }]);
  assert.deepEqual(lireIngredients(''), []);
});

test('recherche : titre, ingrédients (sans accents), tags ; tous les mots', () => {
  const r = [recette(1, 'Wok de légumes', [{ qty: 1, unit: '', name: 'Falafels' }], ['rapide']), recette(2, 'Crème brûlée', [])];
  assert.deepEqual(chercherRecettes(r, 'falafel').map((x) => [x.recette.id, x.ingredientsTrouves]), [[1, ['Falafels']]]);
  assert.equal(chercherRecettes(r, 'creme')[0].recette.id, 2);
  assert.equal(chercherRecettes(r, 'wok rapide').length, 1);
  assert.equal(chercherRecettes(r, 'wok crème').length, 0);
  assert.equal(chercherRecettes(r, '  ').length, 2);
});

test('courses : quantités additionnées, unités converties, dimensions séparées', () => {
  assert.deepEqual(lireLigneCourses('1,5 kg farine'), { base: 1500, dim: 'masse', nom: 'farine' });
  assert.deepEqual(lireLigneCourses('2 oignons'), { base: 2, dim: 'nombre', nom: 'oignons' });
  const lignes = fusionnerCourses([
    { id: 1, name: '600 g farine', recipe_name: 'Pain', done: 1 },
    { id: 2, name: '0,5 kg Farine', recipe_name: 'Gâteau', done: 0 },
    { id: 3, name: '2 unités farine', recipe_name: 'Pain', done: 0 },
    { id: 4, name: 'Sel', recipe_name: '', done: 0 },
  ]);
  assert.deepEqual(lignes.map((l) => [l.nom, l.quantite, l.ids, l.recettes, l.fait]), [
    ['Farine', '1,1 kg', [1, 2], ['Pain', 'Gâteau'], false],
    ['Farine', '2', [3], ['Pain'], false],
    ['Sel', null, [4], [], false],
  ]);
});

test('courses : rayons et groupes', () => {
  assert.equal(rayonDe('Courgette'), 'Fruits & Légumes');
  assert.equal(rayonDe('Basilic frais'), 'Fruits & Légumes');
  assert.equal(rayonDe('Piles AA'), 'Entretien maison');
  assert.equal(rayonDe('Truc inconnu'), 'Autres');
  const articles = [
    { id: 1, name: '100 g beurre', recipe_name: 'B', done: 0 },
    { id: 2, name: '200 g tomates', recipe_name: 'A', done: 0 },
    { id: 3, name: 'Truc', recipe_name: '', done: 0 },
  ];
  assert.deepEqual(groupesParRayon(articles).map((g) => g.titre), ['Fruits & Légumes', 'Produits laitiers', 'Autres']);
  assert.deepEqual(groupesParRecette(articles).map((g) => g.titre), ['B', 'A', 'Autre']);
});

test('ingrédients à acheter : quantités × personnes, pas des boutons, texte et fusion', () => {
  const l = lignesAAcheter(JSON.stringify([
    { qty: 200, unit: 'g', name: 'pois chiches' },
    { qty: 1, unit: 'c. à café', name: 'cumin' },
  ]), 3);
  assert.deepEqual(l.map((x) => [x.qte, x.actuelle, x.inclus]), [[200, 600, true], [null, 0, true]]);
  assert.equal(texteLigne(l[0]), '600 g pois chiches');
  assert.equal(texteLigne(l[1]), 'cumin');
  assert.deepEqual([pas(600), pas(150), pas(4), pas(0.5)], [50, 10, 1, 0.5]);
  assert.equal(ligneActive({ ...l[0], actuelle: 0 }), false);
  assert.equal(cleArticle('600 g pois chiches'), 'pois chiches');
  assert.equal(additionner('600 g pois chiches', '200 g pois chiches'), '800 g pois chiches');
  assert.equal(additionner('cumin', 'cumin'), 'cumin');
});

test('import : balises markdown, erreurs par recette, export relu par l\'import', () => {
  const { recettes, erreurs } = lireImport('```json\n[{"title":"Soupe","category":"Entrée","ingredients":["potiron"],"steps":[{"label":"Cuire","instruction":"","duration":20,"type":"cook"},{"label":"x"}]},{"title":"Mauvaise","category":"Apéro"}]\n```');
  assert.equal(recettes.length, 1);
  assert.deepEqual(recettes[0].ingredients, [{ qty: null, unit: '', name: 'potiron' }]);
  assert.equal(recettes[0].steps.length, 1);
  assert.deepEqual(erreurs, ['"Mauvaise" : "category" doit être "Plat", "Entrée" ou "Dessert"']);
  assert.deepEqual(lireImport('pas du json').erreurs, ['JSON invalide — vérifiez la syntaxe.']);
  const exporte = exporterRecettes([recette(1, 'Pâtes', [{ qty: 100, unit: 'g', name: 'pâtes' }], ['rapide'])]);
  assert.deepEqual(lireImport(exporte).recettes[0].ingredients, [{ qty: 100, unit: 'g', name: 'pâtes' }]);
});
