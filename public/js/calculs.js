// Calculs sans affichage (repris tels quels de l'ancienne appli Expo) : ingrédients, recherche,
// liste de courses (fusion des quantités, rayons), ajustement des quantités avant les courses.
// Utilisés par la page et par les tests (tests/calculs.test.js).

// ─── Ingrédients ──────────────────────────────────────────────

/** Les ingrédients sont rangés en JSON ; anciennes recettes = une ligne par ingrédient. */
export function lireIngredients(stocke) {
  if (!stocke) return [];
  try {
    const lu = JSON.parse(stocke);
    if (Array.isArray(lu)) return lu;
  } catch { /* ancien format */ }
  return stocke.split('\n').filter(Boolean).map((ligne) => ({ qty: null, unit: '', name: ligne }));
}

/** Tableau JSON (étapes, tags), [] si vide ou illisible. */
export function lireListe(stocke) {
  try {
    const lu = JSON.parse(stocke || '[]');
    return Array.isArray(lu) ? lu : [];
  } catch {
    return [];
  }
}

// ─── Texte ────────────────────────────────────────────────────

const ACCENTS = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y', œ: 'oe', æ: 'ae',
};

export function sansAccents(texte) {
  let out = '';
  for (const c of texte.toLowerCase()) out += ACCENTS[c] ?? c;
  return out;
}

// ─── Recherche ────────────────────────────────────────────────

/**
 * Cherche dans le titre, les ingrédients et les tags : « falafel » trouve « Wok de légumes » si des
 * falafels sont dans ses ingrédients. Tous les mots doivent être trouvés (quelque part).
 * @returns {{ recette, ingredientsTrouves: string[] }[]}
 */
export function chercherRecettes(recettes, requete) {
  const mots = sansAccents(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return recettes.map((recette) => ({ recette, ingredientsTrouves: [] }));
  const resultats = [];
  for (const recette of recettes) {
    const titre = sansAccents(recette.title);
    const noms = lireIngredients(recette.ingredients).map((i) => i.name);
    const nomsSansAccents = noms.map(sansAccents);
    const tags = lireListe(recette.tags).map((t) => sansAccents(String(t)));
    const trouves = new Set();
    const tout = mots.every((mot) => {
      if (titre.includes(mot)) return true;
      let ok = false;
      nomsSansAccents.forEach((n, i) => {
        if (n.includes(mot)) {
          trouves.add(noms[i]);
          ok = true;
        }
      });
      return ok || tags.some((t) => t.includes(mot));
    });
    if (tout) resultats.push({ recette, ingredientsTrouves: [...trouves] });
  }
  return resultats;
}

// ─── Liste de courses : fusion des articles ───────────────────

/** Clé de regroupement : accents, pluriel et ponctuation gommés. */
function cleIngredient(nom) {
  const base = sansAccents(nom).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return base.endsWith('s') && base.length > 3 ? base.slice(0, -1) : base;
}

/** facteur = conversion vers l'unité de base de la dimension (g, ml, pièce) */
const UNITES = {
  mg: { dim: 'masse', facteur: 0.001 }, g: { dim: 'masse', facteur: 1 }, gr: { dim: 'masse', facteur: 1 },
  gramme: { dim: 'masse', facteur: 1 }, grammes: { dim: 'masse', facteur: 1 },
  kg: { dim: 'masse', facteur: 1000 }, kilo: { dim: 'masse', facteur: 1000 }, kilos: { dim: 'masse', facteur: 1000 },
  ml: { dim: 'volume', facteur: 1 }, cl: { dim: 'volume', facteur: 10 }, dl: { dim: 'volume', facteur: 100 },
  l: { dim: 'volume', facteur: 1000 }, litre: { dim: 'volume', facteur: 1000 }, litres: { dim: 'volume', facteur: 1000 },
  unite: { dim: 'nombre', facteur: 1 }, unites: { dim: 'nombre', facteur: 1 },
  piece: { dim: 'nombre', facteur: 1 }, pieces: { dim: 'nombre', facteur: 1 },
};

/** « 400 g courgettes » → { base: 400, dim: 'masse', nom: 'courgettes' } */
export function lireLigneCourses(nom) {
  const brut = nom.trim();
  const m = brut.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
  if (!m) return { base: null, dim: 'nombre', nom: brut };
  const qte = parseFloat(m[1].replace(',', '.'));
  const reste = m[2].trim();
  const mots = reste.split(/\s+/);
  const unite = mots.length > 1 ? UNITES[sansAccents(mots[0])] : undefined;
  if (unite) return { base: qte * unite.facteur, dim: unite.dim, nom: mots.slice(1).join(' ') };
  return { base: qte, dim: 'nombre', nom: reste };
}

function nombre(n) {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** 16000 g → « 16 kg », 1500 ml → « 1,5 L », 3 → « 3 » */
export function quantite(base, dim) {
  if (dim === 'masse') return base >= 1000 ? `${nombre(base / 1000)} kg` : `${nombre(base)} g`;
  if (dim === 'volume') return base >= 1000 ? `${nombre(base / 1000)} L` : `${nombre(base)} ml`;
  return nombre(base);
}

const majuscule = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Fusionne les articles du même ingrédient et additionne leurs quantités (300 g et 2 pièces restent séparés).
 * @returns {{ cle, nom, quantite: string|null, ids: number[], recettes: string[], fait: boolean }[]}
 */
export function fusionnerCourses(articles) {
  const lignes = new Map();
  for (const a of articles) {
    const lu = lireLigneCourses(a.name);
    const cle = `${cleIngredient(lu.nom)}|${lu.base === null ? 'aucune' : lu.dim}`;
    const l = lignes.get(cle);
    if (l) {
      l.total = l.total === null || lu.base === null ? l.total : l.total + lu.base;
      l.ids.push(a.id);
      l.fait = l.fait && a.done === 1;
      if (a.recipe_name && !l.recettes.includes(a.recipe_name)) l.recettes.push(a.recipe_name);
    } else {
      lignes.set(cle, { cle, nom: majuscule(lu.nom), dim: lu.dim, total: lu.base, ids: [a.id], recettes: a.recipe_name ? [a.recipe_name] : [], fait: a.done === 1 });
    }
  }
  return [...lignes.values()].map(({ total, dim, ...l }) => ({ ...l, quantite: total === null ? null : quantite(total, dim) }));
}

// ─── Rayons du supermarché ────────────────────────────────────

export const RAYONS = [
  { nom: 'Fruits & Légumes', emoji: '🥦', mots: [
    'tomate', 'oignon', 'échalote', 'ail', 'carotte', 'poireau', 'courgette', 'champignon',
    'poivron', 'aubergine', 'brocoli', 'épinard', 'chou', 'céleri', 'artichaut', 'asperge',
    'betterave', 'concombre', 'fenouil', 'navet', 'radis', 'patate douce', 'pomme de terre',
    'potiron', 'potimarron', 'butternut', 'courge', 'maïs', 'petit pois', 'endive', 'laitue',
    'roquette', 'mâche', 'avocat', 'haricot vert', 'pois chiche', 'fève',
    'persil', 'basilic', 'ciboulette', 'menthe',
    'pomme', 'poire', 'banane', 'fraise', 'framboise', 'cerise', 'abricot', 'pêche', 'prune',
    'raisin', 'orange', 'citron', 'ananas', 'mangue', 'kiwi', 'melon', 'figue', 'myrtille',
    'fruit', 'légume', 'salade'] },
  { nom: 'Viandes', emoji: '🥩', mots: ['poulet', 'guanciale', 'viande', 'bœuf', 'porc', 'lardon', 'jambon', 'veau', 'agneau', 'canard', 'dinde', 'saucisse', 'merguez', 'chorizo', 'steak', 'escalope', 'côtelette'] },
  { nom: 'Poissons & Fruits de mer', emoji: '🐟', mots: ['thon', 'anchois', 'poisson', 'saumon', 'crevette', 'merlan', 'cabillaud', 'moule', 'calmar', 'seiche', 'dorade', 'bar', 'lieu', 'sardine', 'maquereau', 'homard', 'crabe', 'langoustine'] },
  { nom: 'Produits laitiers', emoji: '🧀', mots: ['beurre', 'crème', 'œuf', 'oeuf', 'gruyère', 'pecorino', 'fromage', 'lait', 'yaourt', 'parmesan', 'mozzarella', 'ricotta', 'comté', 'emmental', 'gouda', 'camembert', 'brie', 'roquefort', 'feta', 'cottage', 'mascarpone', 'crème fraîche'] },
  { nom: 'Boulangerie', emoji: '🥖', mots: ['baguette', 'pain', 'brioche', 'croissant', 'pain de mie', 'bagel', 'wrap', 'tortilla'] },
  { nom: 'Épicerie', emoji: '🌾', mots: ['pâte', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'bouillon', 'cassonade', 'moutarde', 'sauce', 'riz', 'lentille', 'fécule', 'levure', 'chocolat', 'miel', 'confiture', 'biscuit', 'céréale', 'granola', 'muesli', 'chips', 'crackers'] },
  { nom: 'Épices', emoji: '🌶️', mots: [
    'cumin', 'curcuma', 'curry', 'paprika', 'cannelle', 'vanille', 'cardamome', 'coriandre',
    'gingembre', 'piment', 'safran', 'muscade', 'anis', 'clou de girofle', 'fenugrec',
    'thym', 'romarin', 'laurier', 'origan', 'sauge', 'estragon', 'aneth', 'herbe de provence'] },
  { nom: 'Cuisine du monde', emoji: '🌍', mots: [
    'soja', 'nuoc mam', 'miso', 'hoisin', 'teriyaki', 'oyster', 'sriracha', 'sambal',
    'mirin', 'saké', 'vinaigre de riz', 'huile de sésame', 'pâte de curry', 'wasabi', 'tahini',
    'nouille', 'vermicelle de riz', 'soba', 'udon', 'ramen', 'galette de riz', 'feuille de riz',
    'lait de coco', 'crème de coco', 'pâte de tamarin', 'tofu',
    'tortillas', 'nachos', 'jalapeño', 'guacamole', 'salsa', 'haricot noir', 'haricot rouge',
    'houmous', 'pita', 'chapati', 'naan', 'semoule', 'couscous', 'boulgour',
    'kimchi', 'tempeh', 'edamame'] },
  { nom: 'Boissons', emoji: '🍷', mots: ['vin', 'jus', 'eau', 'bière', 'cidre', 'soda', 'cola', 'limonade', 'sirop', 'thé', 'café', 'infusion', 'kombucha', 'smoothie'] },
  { nom: 'Hygiène & Beauté', emoji: '🧴', mots: [
    'shampoing', 'après-shampoing', 'démêlant', 'masque capillaire', 'gel coiffant', 'laque',
    'savon', 'gel douche', 'bain moussant', 'gant de toilette', 'serviette', 'loofah',
    'crème hydratante', 'lotion corps', 'beurre corporel', 'huile corps',
    'nettoyant visage', 'tonique', 'sérum', 'crème visage', 'contour des yeux', 'masque visage', 'gommage',
    'crème solaire', 'après-soleil', 'autobronzant',
    'fond de teint', 'bb crème', 'correcteur', 'mascara', 'eye-liner', 'rouge à lèvres', 'gloss',
    'fard à paupières', 'blush', 'poudre', 'highlighter', 'démaquillant', 'dissolvant',
    'dentifrice', 'brosse à dent', 'brosse à dents', 'fil dentaire', 'bain de bouche', 'blanchiment',
    'déodorant', 'anti-transpirant', 'rasoir', 'mousse à raser', 'gel à raser', 'après-rasage',
    'épilateur', 'cire', 'lame', 'coton', 'coton-tige', 'lingette', 'mouchoir', 'kleenex',
    'serviette hygiénique', 'tampon', 'cup menstruelle', 'protège-slip', 'parfum', 'eau de toilette'] },
  { nom: 'Entretien maison', emoji: '🧹', mots: [
    'lessive', 'assouplissant', 'détachant', 'filet de lavage',
    'liquide vaisselle', 'pastille lave-vaisselle', 'sel lave-vaisselle', 'rinçage lave-vaisselle',
    'nettoyant', 'désinfectant', 'javel', 'eau de javel', 'détartrant', 'anticalcaire',
    'nettoyant WC', 'nettoyant salle de bain', 'nettoyant cuisine', 'dégraissant', 'nettoyant sol', 'cire parquet',
    'éponge', 'gratte-éponge', 'lavette', 'chiffon microfibre', 'brosse', 'balai',
    'serpillière', 'balai vapeur', 'pelle', 'raclette', 'aspirateur',
    'sac poubelle', 'sac plastique', 'sac congélation', 'film plastique', 'papier aluminium',
    'papier cuisson', 'boîte hermétique', 'papier essuie-tout', 'sopalin', 'papier toilette', 'papier hygiénique',
    'pile', 'ampoule', 'led', 'allumette', 'bougie', 'diffuseur', 'désodorisant', 'anti-mite', 'anti-moustique',
    'ruban adhésif', 'scotch', 'colle'] },
  { nom: 'Animalerie', emoji: '🐾', mots: [
    'croquette', 'pâtée', 'nourriture chat', 'nourriture chien', 'nourriture poisson',
    'litière', 'litière chat', 'jouet chat', 'jouet chien', 'laisse', 'collier', 'harnais', 'cage', 'aquarium',
    'antiparasitaire', 'pipette', 'vermifuge'] },
  { nom: 'Bébé', emoji: '👶', mots: [
    'couche', 'couches', 'culotte apprentissage', 'lingette bébé', 'lait infantile', 'lait maternisé',
    'petit pot', 'compote bébé', 'biberon', 'tétine', 'sucette', 'tire-lait',
    'crème bébé', 'liniment', 'talc bébé', 'gel de dentition', 'baignoire bébé', 'thermomètre bain'] },
  { nom: 'Pharmacie & Santé', emoji: '💊', mots: [
    'doliprane', 'paracétamol', 'ibuprofène', 'aspirine', 'antidouleur',
    'sirop', 'pastille gorge', 'spray nasal', 'collyre', 'pansement', 'bandage', 'compresse', 'sparadrap', 'antiseptique',
    'thermomètre', 'tensiomètre', 'vitamine', 'complément alimentaire', 'magnésium', 'oméga',
    'probiotique', 'antiacide', 'laxatif', 'antidiarrhéique', 'crème anti-démangeaison', 'crème chauffante',
    'préservatif', 'test de grossesse'] },
  { nom: 'Papeterie & Bureau', emoji: '📝', mots: [
    'stylo', 'crayon', 'feutre', 'marqueur', 'surligneur', 'cahier', 'bloc-notes', 'carnet', 'agenda', 'post-it',
    'enveloppe', 'timbre', 'papier', 'feuille', 'ciseaux', 'règle', 'agrafeuse', 'trombone', 'cartouche encre', 'toner'] },
];
export const RAYON_AUTRE = { nom: 'Autres', emoji: '🛒' };

export function rayonDe(nom) {
  const bas = nom.toLowerCase();
  const frais = bas.includes('fraîch') || bas.includes('frais');
  for (const r of RAYONS) {
    if (r.mots.some((m) => bas.includes(m))) return frais && r.nom === 'Épices' ? 'Fruits & Légumes' : r.nom;
  }
  return RAYON_AUTRE.nom;
}

/** Par recette : le détail reste lisible recette par recette. */
export function groupesParRecette(articles) {
  const groupes = new Map();
  for (const a of articles) {
    const cle = a.recipe_name || 'Autre';
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(a);
  }
  return [...groupes].map(([titre, liste]) => ({ titre, emoji: '🍽️', lignes: fusionnerCourses(liste) }));
}

/** Par rayon : les mêmes ingrédients venant de recettes différentes sont additionnés. */
export function groupesParRayon(articles) {
  const groupes = new Map();
  for (const l of fusionnerCourses(articles)) {
    const r = rayonDe(l.nom);
    if (!groupes.has(r)) groupes.set(r, []);
    groupes.get(r).push(l);
  }
  return [...RAYONS, RAYON_AUTRE].filter((r) => groupes.has(r.nom)).map((r) => ({ titre: r.nom, emoji: r.emoji, lignes: groupes.get(r.nom) }));
}

// ─── Ajustement des ingrédients avant les courses ─────────────

export const UNITES_ACHETABLES = new Set(['g', 'kg', 'ml', 'cl', 'L', 'unité', 'unités']);

/**
 * Lignes à ajuster pour `personnes` (quantités des recettes = pour 1 personne).
 * qte = null : ingrédient sans quantité achetable (épices…), simplement coché ou non.
 */
export function lignesAAcheter(stocke, personnes) {
  return lireIngredients(stocke).map((ing, id) => {
    const achetable = ing.qty !== null && UNITES_ACHETABLES.has(ing.unit);
    return { id, qte: achetable ? ing.qty : null, unite: ing.unit, nom: ing.name, actuelle: achetable ? ing.qty * personnes : 0, inclus: true };
  });
}

export function formaterQte(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

/** Pas des boutons − / + : 50 au-delà de 500, 10 au-delà de 100, 0,5 pour les décimales, sinon 1. */
export function pas(qte) {
  if (!Number.isInteger(qte)) return 0.5;
  if (qte >= 500) return 50;
  if (qte >= 100) return 10;
  return 1;
}

export const ligneActive = (l) => (l.qte !== null ? l.actuelle > 0 : l.inclus);

/** Texte de l'article de courses : « 800 g pois chiches ». */
export function texteLigne(l) {
  if (l.qte === null) return l.nom;
  return [formaterQte(l.actuelle), l.unite, l.nom].filter(Boolean).join(' ');
}

/** Nom de l'ingrédient sans quantité ni unité, pour retrouver un article déjà dans la liste. */
export function cleArticle(nom) {
  const m = nom.match(/^\d+(?:[.,]\d+)?\s+\S+\s+(.*)/);
  if (m) return m[1].toLowerCase().trim();
  const m2 = nom.match(/^\d+(?:[.,]\d+)?\s+(.*)/);
  if (m2) return m2[1].toLowerCase().trim();
  return nom.toLowerCase().trim();
}

/** « 400 g farine » + « 200 g farine » → « 600 g farine » (sinon l'article existant reste tel quel). */
export function additionner(existant, ajout) {
  const lire = (s) => {
    const m = s.match(/^(\d+(?:[.,]\d+)?)(.*)/);
    return m ? { qte: parseFloat(m[1].replace(',', '.')), suite: m[2] } : null;
  };
  const e = lire(existant);
  const a = lire(ajout);
  if (!e || !a) return existant;
  const total = e.qte + a.qte;
  return (Number.isInteger(total) ? String(total) : total.toFixed(1).replace('.', ',')) + e.suite;
}
