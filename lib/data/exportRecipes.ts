import type { Recipe, RecipeStep } from '../types';
import { parseStoredIngredients } from '../ingredients';

function parseArray<T>(stored: string): T[] {
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Recettes au format JSON accepté par l'import (parseImportJson), pour les passer d'un appareil à l'autre */
export function exportRecipesJson(recipes: Recipe[]): string {
  return JSON.stringify(
    recipes.map((r) => ({
      title: r.title,
      category: r.category,
      prep_time: r.prep_time,
      cook_time: r.cook_time,
      description: r.description ?? '',
      tags: parseArray<string>(r.tags),
      ingredients: parseStoredIngredients(r.ingredients),
      steps: parseArray<RecipeStep>(r.steps),
    })),
    null,
    2
  );
}
