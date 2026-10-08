import { SEED_RECIPES, toDbFormat } from './data/recipes';
import { parseImportJson, type ImportResult } from './data/importRecipes';
// Données sur le serveur (repas.mjacquot.fr), gardées en mémoire : voir stockage.web.ts
import { stockage } from './stockage.web';

export type { ImportResult };

// ─── Re-exports des types ──────────────────────────────────────
export type { StepType, RecipeStep, Recipe, Ingredient, ShoppingItem, MealSlot, MealKey, MealPlan } from './types';
export { DEFAULT_PEOPLE, mealKeyOf } from './types';

// ─── Init ─────────────────────────────────────────────────────

import type { Recipe, ShoppingItem, MealPlan, MealSlot, MealKey } from './types';
import { DEFAULT_PEOPLE, mealKeyOf } from './types';

const STORAGE_KEY = 'cuisinator_recipes';
const MEAL_PLANS_KEY = 'cuisinator_meal_plans';
const SHOPPING_KEY = 'cuisinator_shopping';

export function initDatabase() {
  const existing = loadRecipes();
  if (existing.length === 0) {
    const seeded = SEED_RECIPES.map((r, i) => ({ ...toDbFormat(r), id: i + 1 }));
    saveRecipes(seeded);
  } else {
    // Migrer les recettes existantes sans ingrédients/steps
    const updated = existing.map((r) => {
      const seed = SEED_RECIPES.find((s) => s.title === r.title);
      if (!seed) return r;
      const seedDb = toDbFormat(seed);
      return {
        ...r,
        ingredients: r.ingredients || seedDb.ingredients,
        steps: r.steps || seedDb.steps,
        cook_time: r.cook_time || seedDb.cook_time,
      };
    });
    saveRecipes(updated);
  }
}

// ─── Recettes ─────────────────────────────────────────────────

function loadRecipes(): Recipe[] {
  try {
    const raw = stockage.getItem(STORAGE_KEY);
    const items: Recipe[] = raw ? JSON.parse(raw) : [];
    return items.map((r) => ({ ...r, cook_time: r.cook_time ?? 0, steps: r.steps ?? '', ingredients: r.ingredients ?? '' }));
  } catch {
    return [];
  }
}

function saveRecipes(recipes: Recipe[]) {
  stockage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

function nextId(recipes: Recipe[]): number {
  return recipes.length === 0 ? 1 : Math.max(...recipes.map((r) => r.id)) + 1;
}

export function importRecipes(json: string): ImportResult {
  const { recipes, errors } = parseImportJson(json);
  const current = loadRecipes();
  for (const recipe of recipes) {
    const r = toDbFormat(recipe);
    current.push({ ...r, id: nextId(current) });
  }
  saveRecipes(current);
  return { imported: recipes.length, errors };
}

export function getAllRecipes(): Recipe[] {
  return loadRecipes().sort((a, b) => a.title.localeCompare(b.title));
}

export function getRecipeById(id: number): Recipe | null {
  return loadRecipes().find((r) => r.id === id) ?? null;
}

export function addRecipe(recipe: Omit<Recipe, 'id'>): void {
  const recipes = loadRecipes();
  recipes.push({ ...recipe, cook_time: recipe.cook_time ?? 0, steps: recipe.steps ?? '', id: nextId(recipes) });
  saveRecipes(recipes);
}

export function updateRecipe(id: number, recipe: Omit<Recipe, 'id'>): void {
  saveRecipes(loadRecipes().map((r) => r.id === id ? { ...recipe, id } : r));
}

export function deleteRecipe(id: number): void {
  saveRecipes(loadRecipes().filter((r) => r.id !== id));
}

// ─── Meal Plan ────────────────────────────────────────────────

type MealPlansStore = Record<string, { lunch: number | null; dinner: number | null; lunch_side: number | null; dinner_side: number | null; lunch_side2: number | null; dinner_side2: number | null; lunch_people?: number; dinner_people?: number }>;

function loadMealPlans(): MealPlansStore {
  try {
    const raw = stockage.getItem(MEAL_PLANS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMealPlans(plans: MealPlansStore): void {
  stockage.setItem(MEAL_PLANS_KEY, JSON.stringify(plans));
}

export function getMealPlan(date: string): MealPlan {
  const plans = loadMealPlans();
  const plan = plans[date];
  return {
    date,
    lunch: plan?.lunch ?? null,
    dinner: plan?.dinner ?? null,
    lunch_side: plan?.lunch_side ?? null,
    dinner_side: plan?.dinner_side ?? null,
    lunch_side2: plan?.lunch_side2 ?? null,
    dinner_side2: plan?.dinner_side2 ?? null,
    lunch_people: plan?.lunch_people ?? DEFAULT_PEOPLE,
    dinner_people: plan?.dinner_people ?? DEFAULT_PEOPLE,
  };
}

/** @param people nombre de convives du créneau parent (midi / soir), optionnel */
export function setMeal(date: string, slot: MealSlot, recipeId: number | null, people?: number): void {
  const plans = loadMealPlans();
  const current = plans[date] ?? { lunch: null, dinner: null, lunch_side: null, dinner_side: null, lunch_side2: null, dinner_side2: null };
  plans[date] = { ...current, [slot]: recipeId };
  if (people !== undefined) {
    plans[date][mealKeyOf(slot) === 'lunch' ? 'lunch_people' : 'dinner_people'] = people;
  }
  saveMealPlans(plans);
}

export function setMealPeople(date: string, mealKey: MealKey, people: number): void {
  const plans = loadMealPlans();
  const current = plans[date] ?? { lunch: null, dinner: null, lunch_side: null, dinner_side: null, lunch_side2: null, dinner_side2: null };
  plans[date] = { ...current, [mealKey === 'lunch' ? 'lunch_people' : 'dinner_people']: people };
  saveMealPlans(plans);
}

// ─── Liste de courses ─────────────────────────────────────────

function loadShopping(): ShoppingItem[] {
  try {
    const raw = stockage.getItem(SHOPPING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveShopping(items: ShoppingItem[]): void {
  stockage.setItem(SHOPPING_KEY, JSON.stringify(items));
}

function nextShoppingId(items: ShoppingItem[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1;
}

export function getShoppingList(): ShoppingItem[] {
  return loadShopping().sort((a, b) => a.recipe_name.localeCompare(b.recipe_name) || a.id - b.id);
}

export function addToShoppingList(items: { name: string; recipe_name: string }[]): void {
  const current = loadShopping();
  for (const item of items) {
    current.push({ id: nextShoppingId(current), name: item.name, recipe_name: item.recipe_name, done: 0 });
  }
  saveShopping(current);
}

export function toggleShoppingItem(id: number): void {
  saveShopping(
    loadShopping().map((item) =>
      item.id === id ? { ...item, done: item.done === 1 ? 0 : 1 } : item
    )
  );
}

/** Coche/décoche d'un coup tous les articles fusionnés dans une même ligne */
export function setShoppingItemsDone(ids: number[], done: boolean): void {
  const list = loadShopping();
  saveShopping(list.map((i) => (ids.includes(i.id) ? { ...i, done: done ? 1 : 0 } : i)));
}

export function clearShoppingList(): void {
  saveShopping([]);
}

export function deleteShoppingItemsByIds(ids: number[]): void {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  saveShopping(loadShopping().filter((item) => !idSet.has(item.id)));
}

export function updateShoppingItemName(id: number, name: string): void {
  saveShopping(
    loadShopping().map((item) =>
      item.id === id ? { ...item, name } : item
    )
  );
}
