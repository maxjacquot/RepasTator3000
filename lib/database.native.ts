import * as SQLite from 'expo-sqlite';
import { SEED_RECIPES, toDbFormat } from './data/recipes';
export type { ImportResult } from './data/importRecipes';

// ─── Re-exports des types ──────────────────────────────────────
export type { StepType, RecipeStep, Recipe, Ingredient, ShoppingItem, MealSlot, MealKey, MealPlan, Room, RoomProject, RoomTask, RoomTaskType, RoomTaskStatus, RoomTaskPriority, RoomShoppingItem, SportSession } from './types';
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

  db.execSync(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🏠',
      color TEXT NOT NULL DEFAULT '#5B8DB8'
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS room_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      project_id INTEGER,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Travaux',
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'normal',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS room_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  db.execSync(`
    CREATE TABLE IF NOT EXISTS sport_sessions (
      date TEXT PRIMARY KEY,
      push_ups INTEGER NOT NULL DEFAULT 0,
      knee_push_ups INTEGER NOT NULL DEFAULT 0,
      abs INTEGER NOT NULL DEFAULT 0,
      total_time INTEGER NOT NULL DEFAULT 0
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
    `ALTER TABLE room_tasks ADD COLUMN shopping_items TEXT NOT NULL DEFAULT '[]';`,
    `ALTER TABLE room_tasks ADD COLUMN project_id INTEGER;`,
  ]) {
    try { db.execSync(col); } catch { /* déjà présente */ }
  }

  const count = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM recipes;');
  if (count?.count === 0) {
    seedDatabase();
  } else {
    migrateExistingRecipes();
  }

  const roomCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM rooms;');
  if (roomCount?.count !== 11) {
    db.execSync('DELETE FROM room_tasks;');
    db.execSync('DELETE FROM rooms;');
    seedRooms();
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

// ─── Maison ───────────────────────────────────────────────────

import type { Room, RoomTask, RoomTaskType, RoomTaskStatus, RoomTaskPriority, RoomShoppingItem } from './types';

function seedRooms() {
  const rooms = [
    { name: 'Salon',          icon: '🛋️', color: '#7B68EE' },
    { name: 'Cuisine',        icon: '🍳', color: '#FF6B35' },
    { name: 'Chambre',        icon: '🛏️', color: '#5B8DB8' },
    { name: 'SDB',            icon: '🛁', color: '#20B2AA' },
    { name: 'Hall',           icon: '🚪', color: '#F39C12' },
    { name: 'WC',             icon: '🚽', color: '#4CAF50' },
    { name: 'Bureau',         icon: '💻', color: '#3498DB' },
    { name: 'Dressing',       icon: '👗', color: '#E07B54' },
    { name: 'Couloir',        icon: '🚶', color: '#9B59B6' },
    { name: 'Salle à manger', icon: '🍽️', color: '#1ABC9C' },
    { name: 'Scellier',       icon: '📦', color: '#8FBC8F' },
  ];
  for (const room of rooms) {
    db.runSync(
      'INSERT INTO rooms (name, icon, color) VALUES (?, ?, ?);',
      [room.name, room.icon, room.color]
    );
  }
}

export function getRooms(): Room[] {
  return db.getAllSync<Room>('SELECT * FROM rooms ORDER BY id ASC;');
}

export function addRoom(room: Omit<Room, 'id'>): void {
  db.runSync('INSERT INTO rooms (name, icon, color) VALUES (?, ?, ?);', [room.name, room.icon, room.color]);
}

export function updateRoom(id: number, room: Omit<Room, 'id'>): void {
  db.runSync('UPDATE rooms SET name=?, icon=?, color=? WHERE id=?;', [room.name, room.icon, room.color, id]);
}

export function deleteRoom(id: number): void {
  db.runSync('DELETE FROM room_tasks WHERE room_id = ?;', [id]);
  db.runSync('DELETE FROM room_projects WHERE room_id = ?;', [id]);
  db.runSync('DELETE FROM rooms WHERE id = ?;', [id]);
}

export function getRoomTasks(roomId: number): RoomTask[] {
  return db.getAllSync<RoomTask>('SELECT * FROM room_tasks WHERE room_id = ? ORDER BY created_at ASC;', [roomId]);
}

export function getRoomTaskCounts(roomId: number): { total: number; done: number } {
  const total = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM room_tasks WHERE room_id = ?;', [roomId]);
  const done = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM room_tasks WHERE room_id = ? AND status = ?;', [roomId, 'done']);
  return { total: total?.count ?? 0, done: done?.count ?? 0 };
}

export function addRoomTask(task: Omit<RoomTask, 'id'>): void {
  db.runSync(
    'INSERT INTO room_tasks (room_id, project_id, title, type, status, priority, note, shopping_items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
    [task.room_id, task.project_id ?? null, task.title, task.type, task.status, task.priority, task.note, task.shopping_items ?? '[]', task.created_at]
  );
}

export function updateRoomTaskStatus(id: number, status: RoomTaskStatus): void {
  db.runSync('UPDATE room_tasks SET status = ? WHERE id = ?;', [status, id]);
}

export function updateRoomTaskShoppingItems(id: number, items: RoomShoppingItem[]): void {
  db.runSync('UPDATE room_tasks SET shopping_items = ? WHERE id = ?;', [JSON.stringify(items), id]);
}

export function updateRoomTask(id: number, updates: { title: string; priority: RoomTaskPriority; note: string }): void {
  db.runSync('UPDATE room_tasks SET title=?, priority=?, note=? WHERE id=?;', [updates.title, updates.priority, updates.note, id]);
}

export function deleteRoomTask(id: number): void {
  db.runSync('DELETE FROM room_tasks WHERE id = ?;', [id]);
}

export type RoomShoppingEntry = {
  roomId: number;
  roomName: string;
  roomIcon: string;
  roomColor: string;
  taskId: number;
  taskTitle: string;
  items: RoomShoppingItem[];
};

export function getAllRoomShoppingItems(): RoomShoppingEntry[] {
  const rooms = getRooms();
  const result: RoomShoppingEntry[] = [];
  for (const room of rooms) {
    const tasks = getRoomTasks(room.id);
    for (const task of tasks) {
      if (task.status === 'done') continue;
      const items: RoomShoppingItem[] = JSON.parse(task.shopping_items || '[]');
      if (items.length === 0) continue;
      result.push({ roomId: room.id, roomName: room.name, roomIcon: room.icon, roomColor: room.color, taskId: task.id, taskTitle: task.title, items });
    }
  }
  return result;
}

// ─── Projets ─────────────────────────────────────────────────

import type { RoomProject } from './types';

export function getProjects(roomId: number): RoomProject[] {
  return db.getAllSync<RoomProject>(
    'SELECT * FROM room_projects WHERE room_id = ? ORDER BY created_at ASC;',
    [roomId]
  );
}

export function addProject(project: Omit<RoomProject, 'id'>): void {
  db.runSync(
    'INSERT INTO room_projects (room_id, title, description, created_at) VALUES (?, ?, ?, ?);',
    [project.room_id, project.title, project.description, project.created_at]
  );
}

export function updateProject(id: number, updates: { title: string; description: string }): void {
  db.runSync('UPDATE room_projects SET title=?, description=? WHERE id=?;', [updates.title, updates.description, id]);
}

export function deleteProject(id: number): void {
  db.runSync('DELETE FROM room_tasks WHERE project_id = ?;', [id]);
  db.runSync('DELETE FROM room_projects WHERE id = ?;', [id]);
}

export function getProjectTasks(projectId: number): RoomTask[] {
  return db.getAllSync<RoomTask>(
    'SELECT * FROM room_tasks WHERE project_id = ? ORDER BY created_at ASC;',
    [projectId]
  );
}

export function getProjectTaskCounts(projectId: number): { total: number; done: number } {
  const total = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM room_tasks WHERE project_id = ?;',
    [projectId]
  );
  const done = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM room_tasks WHERE project_id = ? AND status = ?;',
    [projectId, 'done']
  );
  return { total: total?.count ?? 0, done: done?.count ?? 0 };
}

// ─── Sport ────────────────────────────────────────────────────

import type { SportSession } from './types';

export function getSportSession(date: string): SportSession | null {
  return db.getFirstSync<SportSession>('SELECT * FROM sport_sessions WHERE date = ?;', [date]) ?? null;
}

export function setSportSession(session: SportSession): void {
  db.runSync(
    'INSERT OR REPLACE INTO sport_sessions (date, push_ups, knee_push_ups, abs, total_time) VALUES (?, ?, ?, ?, ?);',
    [session.date, session.push_ups, session.knee_push_ups, session.abs, session.total_time]
  );
}

export function getAllSportSessions(): SportSession[] {
  return db.getAllSync<SportSession>('SELECT * FROM sport_sessions ORDER BY date DESC;');
}
