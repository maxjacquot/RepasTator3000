// Import de recettes (JSON généré par une IA, ou export d'une autre appli) et export de toutes les recettes.
// Repris de l'ancienne appli Expo (lib/data/importRecipes.ts, exportRecipes.ts, ImportModal.tsx).
import { lireIngredients, lireListe } from './calculs.js';

/** Texte à coller dans ChatGPT, Claude… avec sa recette : l'IA répond un JSON que l'import comprend. */
export const PROMPT_IA = `Tu es un assistant qui convertit des recettes en JSON pour une application de cuisine.

Génère un tableau JSON en respectant exactement ce format :

[
  {
    "title": "Nom de la recette",
    "category": "Plat",
    "prep_time": 30,
    "cook_time": 20,
    "description": "Courte description en 1-2 phrases.",
    "tags": ["végétarien", "rapide"],
    "ingredients": [
      { "qty": 200, "unit": "g", "name": "farine" },
      { "qty": 1000, "unit": "ml", "name": "eau" },
      { "qty": 2, "unit": "unités", "name": "œufs" },
      { "qty": 1, "unit": "c. à café", "name": "cumin en poudre" },
      { "qty": 2, "unit": "c. à soupe", "name": "huile d'olive" }
    ],
    "steps": [
      {
        "label": "Nom de l'étape",
        "instruction": "Description détaillée. Si vous n'utilisez qu'une partie d'un ingrédient, indiquez la fraction (ex: la moitié de l'eau, 1/3 de la farine).",
        "duration": 10,
        "type": "prep"
      }
    ]
  }
]

Règles générales :
- "category" : uniquement "Plat", "Entrée" ou "Dessert"
- "prep_time" : somme des durées des étapes de type "prep" uniquement (0 si aucune)
- "cook_time" : somme des durées des étapes de type "cook" uniquement (0 si aucune)
- "type" dans les steps : "prep" (préparation active), "cook" (cuisson active), "wait" (attente/four/frigo), "rest" (repos après cuisson)
- "tags" : tableau de mots-clés parmi : végétarien, vegan, carnivore, poisson, volaille, sandwich, soupe, salade, pâtes, riz, rapide, batch-cooking, sans-gluten, épicé, doux, enfants, light, fait-maison — 1 à 5 tags max
- Les quantités d'ingrédients doivent être pour 1 personne uniquement
- Ne pas inclure d'accompagnement dans la recette (pas de "servir avec...", "accompagner de…", etc.) — la recette doit être autonome et complète en elle-même

Règles pour les ingrédients :
- Chaque ingrédient est un objet { "qty", "unit", "name" }
- "name" : nom seul, sans quantité ni unité
- "qty" : nombre (entier ou décimal), ou null si pas de quantité mesurable
- "unit" : UNIQUEMENT une de ces valeurs, choisie selon le type d'ingrédient :
  → Tout ce qui se pèse (farine, légumes, viande, fromage, pâtes, riz…) : TOUJOURS "g", jamais "kg"
    Convertis systématiquement : 1 kg de farine → { "qty": 1000, "unit": "g" }, 1,5 kg → 1500
  → Tout ce qui se mesure en liquide (eau, lait, crème, huile en grande quantité…) : TOUJOURS "ml", jamais "cl" ni "L"
    Convertis systématiquement : 1 L d'eau → { "qty": 1000, "unit": "ml" }, 20 cl de crème → 200
  → Achetables à la pièce (œufs, citrons, oignons…) : "unité" (singulier) ou "unités" (pluriel)
  → Épices et condiments (achetés en flacon) : garder la mesure recette ("c. à café", "c. à soupe", "pincée") — l'app les affichera sans quantité dans la liste de courses
- N'invente pas d'autre unité : pas de "gousse", "botte", "tranche", "sachet", "boîte", "verre". Convertis en g, en ml, ou en unités.
  Exemples : 2 gousses d'ail → { "qty": 2, "unit": "unités", "name": "gousse d'ail" } ; 1 botte de persil → { "qty": 30, "unit": "g", "name": "persil" }
- "name" doit rester constant d'une recette à l'autre pour un même produit : nom simple et au singulier, sans qualificatif de taille ni de préparation
  Écris "courgette", pas "courgettes moyennes" ni "courgette émincée" — l'app additionne les quantités des ingrédients portant le même nom
- NE PAS inclure sel, poivre, et condiments toujours présents en cuisine — ils sont sous-entendus

Règles pour les étapes (steps) :
- Si une quantité d'ingrédient est répartie sur plusieurs étapes, utiliser des fractions dans les instructions au lieu de valeurs absolues
  Exemple : recette avec 1L d'eau utilisé en deux fois → étape 1 : "versez la moitié de l'eau", étape 2 : "ajoutez le reste de l'eau"
  Autres exemples de fractions : "1/3 de la farine", "les 2/3 restants", "la moitié du lait"
- Génère uniquement le JSON brut, sans texte autour

Voici la ou les recettes à convertir :
[COLLE ICI TA RECETTE]`;

const CATEGORIES = ['Plat', 'Entrée', 'Dessert'];
const TYPES_ETAPE = ['prep', 'cook', 'wait', 'rest'];

/**
 * Lit un JSON de recettes. Accepte des balises markdown autour (```json … ```), des ingrédients en objets,
 * en lignes de texte ou en un seul texte.
 * @returns {{ recettes: object[], erreurs: string[] }}
 */
export function lireImport(json) {
  const propre = json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let lu;
  try {
    lu = JSON.parse(propre);
  } catch {
    return { recettes: [], erreurs: ['JSON invalide — vérifiez la syntaxe.'] };
  }
  if (!Array.isArray(lu)) return { recettes: [], erreurs: ['Le JSON doit être un tableau : [ { ... }, ... ]'] };

  const recettes = [];
  const erreurs = [];
  lu.forEach((r, i) => {
    const nom = r?.title ? `"${r.title}"` : `Recette ${i + 1}`;
    if (typeof r !== 'object' || r === null) return erreurs.push(`${nom} : doit être un objet`);
    if (!r.title || typeof r.title !== 'string') return erreurs.push(`${nom} : champ "title" manquant`);
    if (!CATEGORIES.includes(r.category)) return erreurs.push(`${nom} : "category" doit être "Plat", "Entrée" ou "Dessert"`);

    let ingredients;
    const brut = r.ingredients;
    if (Array.isArray(brut) && brut.length > 0 && typeof brut[0] === 'object' && brut[0] !== null && 'name' in brut[0]) ingredients = brut;
    else if (Array.isArray(brut)) ingredients = brut.filter((x) => typeof x === 'string').map((name) => ({ qty: null, unit: '', name }));
    else if (typeof brut === 'string') ingredients = brut.split('\n').filter(Boolean).map((name) => ({ qty: null, unit: '', name }));
    else ingredients = [];

    const steps = Array.isArray(r.steps)
      ? r.steps.filter((e) => e && typeof e === 'object' && typeof e.label === 'string' && typeof e.instruction === 'string'
          && typeof e.duration === 'number' && TYPES_ETAPE.includes(e.type))
      : [];
    const tags = Array.isArray(r.tags) ? r.tags.filter((x) => typeof x === 'string') : [];
    recettes.push({
      title: r.title,
      category: r.category,
      prep_time: typeof r.prep_time === 'number' ? r.prep_time : 0,
      cook_time: typeof r.cook_time === 'number' ? r.cook_time : 0,
      description: typeof r.description === 'string' ? r.description : '',
      ingredients,
      steps,
      tags,
    });
  });
  return { recettes, erreurs };
}

/** Toutes les recettes au format de l'import (pour les sauvegarder ou les passer ailleurs). */
export function exporterRecettes(recettes) {
  return JSON.stringify(
    recettes.map((r) => ({
      title: r.title,
      category: r.category,
      prep_time: r.prep_time,
      cook_time: r.cook_time,
      description: r.description ?? '',
      tags: lireListe(r.tags),
      ingredients: lireIngredients(r.ingredients),
      steps: lireListe(r.steps),
    })),
    null,
    2,
  );
}
