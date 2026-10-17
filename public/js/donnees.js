// Recettes, planning et liste de courses : lecture et écriture des trois clés du serveur.
// Mêmes clés et même format JSON que l'ancienne appli Expo (lib/database.web.ts) : rien à migrer.
// Les clés gardent leur préfixe historique « cuisinator_ » (ancien nom de l'appli).
import { lire, ecrire } from './stockage.js';
import { RECETTES_DEPART, versFormatStocke } from './recettes-depart.js';
import { lireImport } from './import.js';

const CLE_RECETTES = 'cuisinator_recipes';
const CLE_PLANNING = 'cuisinator_meal_plans';
const CLE_COURSES = 'cuisinator_shopping';

/** Nombre de personnes proposé par défaut sur un nouveau créneau. */
export const PERSONNES_DEFAUT = 2;

/** 'lunch' | 'dinner' (le nombre de personnes est par repas, pas par plat) */
export const repasDe = (creneau) => (creneau.startsWith('lunch') ? 'lunch' : 'dinner');

const lireJson = (cle, defaut) => {
  try {
    const brut = lire(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch {
    return defaut;
  }
};

// ─── Recettes ─────────────────────────────────────────────────

function recettes() {
  return lireJson(CLE_RECETTES, []).map((r) => ({ ...r, cook_time: r.cook_time ?? 0, steps: r.steps ?? '', ingredients: r.ingredients ?? '' }));
}
const enregistrerRecettes = (liste) => ecrire(CLE_RECETTES, JSON.stringify(liste));
const idSuivant = (liste) => (liste.length === 0 ? 1 : Math.max(...liste.map((r) => r.id)) + 1);

/** Première ouverture (base vide) : recettes de départ. */
export function initialiser() {
  if (recettes().length === 0) enregistrerRecettes(RECETTES_DEPART.map((r, i) => ({ ...versFormatStocke(r), id: i + 1 })));
}

export const toutesLesRecettes = () => recettes().sort((a, b) => a.title.localeCompare(b.title));
export const recette = (id) => recettes().find((r) => r.id === id) ?? null;

export function ajouterRecette(r) {
  const liste = recettes();
  const id = idSuivant(liste);
  liste.push({ ...r, cook_time: r.cook_time ?? 0, steps: r.steps ?? '', id });
  enregistrerRecettes(liste);
  return id;
}

export function modifierRecette(id, r) {
  enregistrerRecettes(recettes().map((x) => (x.id === id ? { ...r, id } : x)));
}

export function supprimerRecette(id) {
  enregistrerRecettes(recettes().filter((r) => r.id !== id));
}

/** @returns {{ importees: number, erreurs: string[] }} */
export function importerRecettes(json) {
  const { recettes: nouvelles, erreurs } = lireImport(json);
  const liste = recettes();
  for (const r of nouvelles) liste.push({ ...versFormatStocke(r), id: idSuivant(liste) });
  if (nouvelles.length) enregistrerRecettes(liste);
  return { importees: nouvelles.length, erreurs };
}

// ─── Planning ─────────────────────────────────────────────────
// Un jour : { lunch, dinner, lunch_side, dinner_side, lunch_side2, dinner_side2 (id de recette ou null),
//             lunch_people, dinner_people }

const VIDE = { lunch: null, dinner: null, lunch_side: null, dinner_side: null, lunch_side2: null, dinner_side2: null };
const planning = () => lireJson(CLE_PLANNING, {});
const enregistrerPlanning = (p) => ecrire(CLE_PLANNING, JSON.stringify(p));

export function jour(date) {
  const p = planning()[date];
  return {
    date,
    ...Object.fromEntries(Object.keys(VIDE).map((k) => [k, p?.[k] ?? null])),
    lunch_people: p?.lunch_people ?? PERSONNES_DEFAUT,
    dinner_people: p?.dinner_people ?? PERSONNES_DEFAUT,
  };
}

/** @param {number} [personnes] nombre de personnes du repas (midi / soir) */
export function planifier(date, creneau, idRecette, personnes) {
  const p = planning();
  p[date] = { ...(p[date] ?? VIDE), [creneau]: idRecette };
  if (personnes !== undefined) p[date][`${repasDe(creneau)}_people`] = personnes;
  enregistrerPlanning(p);
}

export function changerPersonnes(date, repas, personnes) {
  const p = planning();
  p[date] = { ...(p[date] ?? VIDE), [`${repas}_people`]: personnes };
  enregistrerPlanning(p);
}

/** Retirer un plat principal retire aussi ses accompagnements. */
export function retirer(date, creneau) {
  const p = planning();
  const j = { ...(p[date] ?? VIDE), [creneau]: null };
  if (creneau === 'lunch' || creneau === 'dinner') j[`${creneau}_side`] = j[`${creneau}_side2`] = null;
  p[date] = j;
  enregistrerPlanning(p);
}

// ─── Liste de courses ─────────────────────────────────────────
// Un article : { id, name (« 400 g farine »), recipe_name ('' = ajouté à la main), done (0 | 1) }

const courses = () => lireJson(CLE_COURSES, []);
const enregistrerCourses = (l) => ecrire(CLE_COURSES, JSON.stringify(l));

export const listeDeCourses = () => courses().sort((a, b) => a.recipe_name.localeCompare(b.recipe_name) || a.id - b.id);

export function ajouterAuxCourses(articles) {
  const l = courses();
  for (const a of articles) l.push({ id: idSuivant(l), name: a.name, recipe_name: a.recipe_name, done: 0 });
  enregistrerCourses(l);
}

export function cocher(ids, fait) {
  enregistrerCourses(courses().map((a) => (ids.includes(a.id) ? { ...a, done: fait ? 1 : 0 } : a)));
}

export function renommerArticle(id, name) {
  enregistrerCourses(courses().map((a) => (a.id === id ? { ...a, name } : a)));
}

export function supprimerArticles(ids) {
  if (ids.length) enregistrerCourses(courses().filter((a) => !ids.includes(a.id)));
}

export const viderCourses = () => enregistrerCourses([]);
