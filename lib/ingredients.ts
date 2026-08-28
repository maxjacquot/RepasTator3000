import type { Ingredient } from './types';

/** Les ingrédients sont stockés en JSON ; anciennes recettes = une ligne par ingrédient */
export function parseStoredIngredients(stored: string): Ingredient[] {
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed as Ingredient[];
  } catch { /* ignore */ }
  return stored.split('\n').filter(Boolean).map((line) => ({ qty: null, unit: '', name: line }));
}
