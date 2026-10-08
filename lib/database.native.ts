import * as SQLite from 'expo-sqlite';
import { SEED_RECIPES, toDbFormat } from './data/recipes';
export type { ImportResult } from './data/importRecipes';

// ─── Re-exports des types ──────────────────────────────────────
export type { StepType, RecipeStep, Recipe, Ingredient, ShoppingItem, MealSlot, MealKey, MealPlan } from './types';
export { DEFAULT_PEOPLE, mealKeyOf } from './types';

// ─── Init ─────────────────────────────────────────────────────

const db = SQLite.openDatabaseSync('cuisinator.db');

let _dbReady = false;

export function initDatabase() {
  if (_dbReady) return;
  db.execSync(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      prep_time INTEGER NOT NULL,
      cook_time INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      ingredients TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]'
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      date TEXT PRIMARY KEY,
      lunch_id INTEGER,
      dinner_id INTEGER
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS shopping_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      recipe_name TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Migrations colonnes (idempotentes)
  for (const col of [
    `ALTER TABLE recipes ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE recipes ADD COLUMN cook_time INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE recipes ADD COLUMN steps TEXT NOT NULL DEFAULT '';`,
    `ALTER TABLE recipes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';`,
    `ALTER TABLE meal_plans ADD COLUMN lunch_side_id INTEGER;`,
    `ALTER TABLE meal_plans ADD COLUMN dinner_side_id INTEGER;`,
    `ALTER TABLE meal_plans ADD COLUMN lunch_side2_id INTEGER;`,
    `ALTER TABLE meal_plans ADD COLUMN dinner_side2_id INTEGER;`,
    `ALTER TABLE meal_plans ADD COLUMN lunch_people INTEGER NOT NULL DEFAULT 2;`,
    `ALTER TABLE meal_plans ADD COLUMN dinner_people INTEGER NOT NULL DEFAULT 2;`,
  ]) {
    try { db.execSync(col); } catch { /* déjà présente */ }
  }

  const count = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM recipes;');
  if (count?.count === 0) {
    seedDatabase();
  } else {
    migrateExistingRecipes();
  }

  _dbReady = true;
}

function seedDatabase() {
  for (const recipe of SEED_RECIPES) {
    const r = toDbFormat(recipe);
    db.runSync(
      'INSERT INTO recipes (title, category, prep_time, cook_time, description, ingredients, steps, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [r.title, r.category, r.prep_time, r.cook_time, r.description, r.ingredients, r.steps, r.tags]
    );
  }
}

/** Met à jour les recettes existantes qui n'ont pas encore leurs ingrédients/steps */
function migrateExistingRecipes() {
  for (const recipe of SEED_RECIPES) {
    const r = toDbFormat(recipe);
    db.runSync(
      `UPDATE recipes SET ingredients = ? WHERE title = ? AND (ingredients = '' OR ingredients IS NULL);`,
      [r.ingredients, r.title]
    );
    if (r.steps) {
      db.runSync(
        `UPDATE recipes SET steps = ?, cook_time = ? WHERE title = ? AND (steps = '' OR steps IS NULL);`,
        [r.steps, r.cook_time, r.title]
      );
    }
  }
}

// Run at module load so tables exist before any component renders
initDatabase();

// ─── Recettes ─────────────────────────────────────────────────

import { parseImportJson, type ImportResult } from './data/importRecipes';
import type { Recipe } from './types';

export function importRecipes(json: string): ImportResult {
  const { recipes, errors } = parseImportJson(json);
  for (const recipe of recipes) {
    const r = toDbFormat(recipe);
    db.runSync(
      'INSERT INTO recipes (title, category, prep_time, cook_time, description, ingredients, steps, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [r.title, r.category, r.prep_time, r.cook_time, r.description, r.ingredients, r.steps, r.tags]
    );
  }
  return { imported: recipes.length, errors };
}

export function getAllRecipes(): Recipe[] {
  return db.getAllSync<Recipe>('SELECT * FROM recipes ORDER BY title ASC;');
}

export function getRecipeById(id: number): Recipe | null {
  return db.getFirstSync<Recipe>('SELECT * FROM recipes WHERE id = ?;', [id]) ?? null;
}

export function addRecipe(recipe: Omit<Recipe, 'id'>): void {
  db.runSync(
    'INSERT INTO recipes (title, category, prep_time, cook_time, description, ingredients, steps, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
    [recipe.title, recipe.category, recipe.prep_time, recipe.cook_time ?? 0, recipe.description, recipe.ingredients, recipe.steps ?? '', recipe.tags ?? '[]']
  );
}

export function updateRecipe(id: number, recipe: Omit<Recipe, 'id'>): void {
  db.runSync(
    'UPDATE recipes SET title=?, category=?, prep_time=?, cook_time=?, description=?, ingredients=?, steps=?, tags=? WHERE id=?;',
    [recipe.title, recipe.category, recipe.prep_time, recipe.cook_time ?? 0, recipe.description, recipe.ingredients, recipe.steps ?? '', recipe.tags ?? '[]', id]
  );
}

export function deleteRecipe(id: number): void {
  db.runSync('DELETE FROM recipes WHERE id = ?;', [id]);
}

// ─── Meal Plan ────────────────────────────────────────────────

import type { MealPlan, MealSlot, MealKey } from './types';
import { DEFAULT_PEOPLE, mealKeyOf } from './types';

export function getMealPlan(date: string): MealPlan {
  const row = db.getFirstSync<{
    lunch_id: number | null;
    dinner_id: number | null;
    lunch_side_id: number | null;
    dinner_side_id: number | null;
    lunch_side2_id: number | null;
    dinner_side2_id: number | null;
    lunch_people: number | null;
    dinner_people: number | null;
  }>('SELECT * FROM meal_plans WHERE date = ?;', [date]);
  return {
    date,
    lunch: row?.lunch_id ?? null,
    dinner: row?.dinner_id ?? null,
    lunch_side: row?.lunch_side_id ?? null,
    dinner_side: row?.dinner_side_id ?? null,
    lunch_side2: row?.lunch_side2_id ?? null,
    dinner_side2: row?.dinner_side2_id ?? null,
    lunch_people: row?.lunch_people ?? DEFAULT_PEOPLE,
    dinner_people: row?.dinner_people ?? DEFAULT_PEOPLE,
  };
}

/** @param people nombre de convives du créneau parent (midi / soir), optionnel */
export function setMeal(date: string, slot: MealSlot, recipeId: number | null, people?: number): void {
  const current = getMealPlan(date);
  const mealKey = mealKeyOf(slot);
  db.runSync(
    'INSERT OR REPLACE INTO meal_plans (date, lunch_id, dinner_id, lunch_side_id, dinner_side_id, lunch_side2_id, dinner_side2_id, lunch_people, dinner_people) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      date,
      slot === 'lunch' ? recipeId : current.lunch,
      slot === 'dinner' ? recipeId : current.dinner,
      slot === 'lunch_side' ? recipeId : current.lunch_side,
      slot === 'dinner_side' ? recipeId : current.dinner_side,
      slot === 'lunch_side2' ? recipeId : current.lunch_side2,
      slot === 'dinner_side2' ? recipeId : current.dinner_side2,
      people !== undefined && mealKey === 'lunch' ? people : current.lunch_people,
      people !== undefined && mealKey === 'dinner' ? people : current.dinner_people,
    ]
  );
}

export function setMealPeople(date: string, mealKey: MealKey, people: number): void {
  const current = getMealPlan(date);
  db.runSync(
    'INSERT OR REPLACE INTO meal_plans (date, lunch_id, dinner_id, lunch_side_id, dinner_side_id, lunch_side2_id, dinner_side2_id, lunch_people, dinner_people) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [
      date,
      current.lunch, current.dinner,
      current.lunch_side, current.dinner_side,
      current.lunch_side2, current.dinner_side2,
      mealKey === 'lunch' ? people : current.lunch_people,
      mealKey === 'dinner' ? people : current.dinner_people,
    ]
  );
}

// ─── Liste de courses ─────────────────────────────────────────

import type { ShoppingItem } from './types';

export function getShoppingList(): ShoppingItem[] {
  return db.getAllSync<ShoppingItem>('SELECT * FROM shopping_list ORDER BY recipe_name ASC, id ASC;');
}

export function addToShoppingList(items: { name: string; recipe_name: string }[]): void {
  for (const item of items) {
    db.runSync(
      'INSERT INTO shopping_list (name, recipe_name, done) VALUES (?, ?, 0);',
      [item.name, item.recipe_name]
    );
  }
}

export function toggleShoppingItem(id: number): void {
  db.runSync('UPDATE shopping_list SET done = CASE WHEN done = 1 THEN 0 ELSE 1 END WHERE id = ?;', [id]);
}

/** Coche/décoche d'un coup tous les articles fusionnés dans une même ligne */
export function setShoppingItemsDone(ids: number[], done: boolean): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`UPDATE shopping_list SET done = ? WHERE id IN (${placeholders});`, [done ? 1 : 0, ...ids]);
}

export function clearShoppingList(): void {
  db.runSync('DELETE FROM shopping_list;');
}

export function deleteShoppingItemsByIds(ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(`DELETE FROM shopping_list WHERE id IN (${placeholders});`, ids);
}

export function updateShoppingItemName(id: number, name: string): void {
  db.runSync('UPDATE shopping_list SET name = ? WHERE id = ?;', [name, id]);
}
