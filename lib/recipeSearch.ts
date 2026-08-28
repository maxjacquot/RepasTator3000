import type { Recipe } from './types';
import { parseStoredIngredients } from './ingredients';
import { normalizeText } from './shoppingAggregate';

export type RecipeMatch = {
  recipe: Recipe;
  /** Ingrédients ayant déclenché la correspondance, si le titre ne suffisait pas */
  ingredientHits: string[];
};

function tokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function parseTags(stored: string): string[] {
  try {
    const parsed = JSON.parse(stored || '[]');
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch { /* ignore */ }
  return [];
}

/**
 * Cherche dans le titre, les ingrédients et les tags : « falafel » remonte
 * « Wok de légumes » si des falafels figurent dans sa liste d'ingrédients.
 * Tous les mots de la requête doivent être trouvés (quelque part).
 */
export function searchRecipes(recipes: Recipe[], query: string): RecipeMatch[] {
  const words = tokens(query);
  if (words.length === 0) return recipes.map((recipe) => ({ recipe, ingredientHits: [] }));

  const matches: RecipeMatch[] = [];
  for (const recipe of recipes) {
    const title = normalizeText(recipe.title);
    const ingredientNames = parseStoredIngredients(recipe.ingredients).map((i) => i.name);
    const normalizedIngredients = ingredientNames.map(normalizeText);
    const normalizedTags = parseTags(recipe.tags).map(normalizeText);

    const hits = new Set<string>();
    const allMatched = words.every((word) => {
      if (title.includes(word)) return true;
      let found = false;
      normalizedIngredients.forEach((ing, i) => {
        if (ing.includes(word)) {
          hits.add(ingredientNames[i]);
          found = true;
        }
      });
      if (found) return true;
      return normalizedTags.some((tag) => tag.includes(word));
    });

    if (allMatched) {
      matches.push({ recipe, ingredientHits: Array.from(hits) });
    }
  }
  return matches;
}
