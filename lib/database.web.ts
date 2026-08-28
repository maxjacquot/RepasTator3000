import { SEED_RECIPES, toDbFormat } from './data/recipes';
import { parseImportJson, type ImportResult } from './data/importRecipes';

export type { ImportResult };

// ─── Re-exports des types ──────────────────────────────────────
export type { StepType, RecipeStep, Recipe, Ingredient, ShoppingItem, MealSlot, MealKey, MealPlan, Room, RoomProject, RoomTask, RoomTaskType, RoomTaskStatus, RoomTaskPriority, RoomShoppingItem, SportSession } from './types';
export { DEFAULT_PEOPLE, mealKeyOf } from './types';

// ─── Init ─────────────────────────────────────────────────────

import type { Recipe, ShoppingItem, MealPlan, MealSlot, MealKey, RoomTaskPriority } from './types';
import { DEFAULT_PEOPLE, mealKeyOf } from './types';

const STORAGE_KEY = 'cuisinator_recipes';
const MEAL_PLANS_KEY = 'cuisinator_meal_plans';
const SHOPPING_KEY = 'cuisinator_shopping';

export function initDatabase() {
  initRooms();
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
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: Recipe[] = raw ? JSON.parse(raw) : [];
    return items.map((r) => ({ ...r, cook_time: r.cook_time ?? 0, steps: r.steps ?? '', ingredients: r.ingredients ?? '' }));
  } catch {
    return [];
  }
}

function saveRecipes(recipes: Recipe[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
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
    const raw = localStorage.getItem(MEAL_PLANS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveMealPlans(plans: MealPlansStore): void {
  localStorage.setItem(MEAL_PLANS_KEY, JSON.stringify(plans));
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
    const raw = localStorage.getItem(SHOPPING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveShopping(items: ShoppingItem[]): void {
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(items));
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

// ─── Maison ───────────────────────────────────────────────────

import type { Room, RoomProject, RoomTask, RoomTaskStatus, RoomShoppingItem } from './types';

const ROOMS_KEY = 'cuisinator_rooms';
const ROOM_TASKS_KEY = 'cuisinator_room_tasks';
const PROJECTS_KEY = 'cuisinator_room_projects';

const SEED_ROOMS: Omit<Room, 'id'>[] = [
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

function loadRooms(): Room[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRooms(rooms: Room[]): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

function nextRoomId(rooms: Room[]): number {
  return rooms.length === 0 ? 1 : Math.max(...rooms.map((r) => r.id)) + 1;
}

function loadRoomTasks(): RoomTask[] {
  try {
    const raw = localStorage.getItem(ROOM_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRoomTasks(tasks: RoomTask[]): void {
  localStorage.setItem(ROOM_TASKS_KEY, JSON.stringify(tasks));
}

function nextTaskId(tasks: RoomTask[]): number {
  return tasks.length === 0 ? 1 : Math.max(...tasks.map((t) => t.id)) + 1;
}

export function initRooms(): void {
  const existing = loadRooms();
  if (existing.length !== 11) {
    saveRooms(SEED_ROOMS.map((r, i) => ({ ...r, id: i + 1 })));
    saveRoomTasks([]);
  }
}

export function getRooms(): Room[] {
  return loadRooms();
}

export function addRoom(room: Omit<Room, 'id'>): void {
  const rooms = loadRooms();
  saveRooms([...rooms, { ...room, id: nextRoomId(rooms) }]);
}

export function updateRoom(id: number, room: Omit<Room, 'id'>): void {
  saveRooms(loadRooms().map((r) => r.id === id ? { ...room, id } : r));
}

export function deleteRoom(id: number): void {
  saveRooms(loadRooms().filter((r) => r.id !== id));
  saveRoomTasks(loadRoomTasks().filter((t) => t.room_id !== id));
  saveProjects(loadProjects().filter((p) => p.room_id !== id));
}

export function getRoomTasks(roomId: number): RoomTask[] {
  return loadRoomTasks().filter((t) => t.room_id === roomId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getRoomTaskCounts(roomId: number): { total: number; done: number } {
  const tasks = loadRoomTasks().filter((t) => t.room_id === roomId);
  return { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length };
}

export function addRoomTask(task: Omit<RoomTask, 'id'>): void {
  const tasks = loadRoomTasks();
  saveRoomTasks([...tasks, { ...task, project_id: task.project_id ?? null, shopping_items: task.shopping_items ?? '[]', id: nextTaskId(tasks) }]);
}

export function updateRoomTaskStatus(id: number, status: RoomTaskStatus): void {
  saveRoomTasks(loadRoomTasks().map((t) => t.id === id ? { ...t, status } : t));
}

export function updateRoomTaskShoppingItems(id: number, items: RoomShoppingItem[]): void {
  saveRoomTasks(loadRoomTasks().map((t) => t.id === id ? { ...t, shopping_items: JSON.stringify(items) } : t));
}

export function updateRoomTask(id: number, updates: { title: string; priority: RoomTaskPriority; note: string }): void {
  saveRoomTasks(loadRoomTasks().map((t) => t.id === id ? { ...t, ...updates } : t));
}

export function deleteRoomTask(id: number): void {
  saveRoomTasks(loadRoomTasks().filter((t) => t.id !== id));
}

// ─── Projets ─────────────────────────────────────────────────

function loadProjects(): RoomProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProjects(projects: RoomProject[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function nextProjectId(projects: RoomProject[]): number {
  return projects.length === 0 ? 1 : Math.max(...projects.map((p) => p.id)) + 1;
}

export function getProjects(roomId: number): RoomProject[] {
  return loadProjects().filter((p) => p.room_id === roomId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function addProject(project: Omit<RoomProject, 'id'>): void {
  const projects = loadProjects();
  saveProjects([...projects, { ...project, id: nextProjectId(projects) }]);
}

export function updateProject(id: number, updates: { title: string; description: string }): void {
  saveProjects(loadProjects().map((p) => p.id === id ? { ...p, ...updates } : p));
}

export function deleteProject(id: number): void {
  saveProjects(loadProjects().filter((p) => p.id !== id));
  saveRoomTasks(loadRoomTasks().filter((t) => t.project_id !== id));
}

export function getProjectTasks(projectId: number): RoomTask[] {
  return loadRoomTasks().filter((t) => t.project_id === projectId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getProjectTaskCounts(projectId: number): { total: number; done: number } {
  const tasks = loadRoomTasks().filter((t) => t.project_id === projectId);
  return { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length };
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

// ─── Sport ────────────────────────────────────────────────────

import type { SportSession } from './types';

const SPORT_SESSIONS_KEY = 'cuisinator_sport_sessions';

function loadSportSessions(): SportSession[] {
  try {
    const raw = localStorage.getItem(SPORT_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSportSessions(sessions: SportSession[]): void {
  localStorage.setItem(SPORT_SESSIONS_KEY, JSON.stringify(sessions));
}

export function getSportSession(date: string): SportSession | null {
  return loadSportSessions().find((s) => s.date === date) ?? null;
}

export function setSportSession(session: SportSession): void {
  const sessions = loadSportSessions().filter((s) => s.date !== session.date);
  sessions.push(session);
  saveSportSessions(sessions);
}

export function getAllSportSessions(): SportSession[] {
  return loadSportSessions().sort((a, b) => b.date.localeCompare(a.date));
}

export function getAllRoomShoppingItems(): RoomShoppingEntry[] {
  const rooms = loadRooms();
  const result: RoomShoppingEntry[] = [];
  for (const room of rooms) {
    const tasks = loadRoomTasks().filter((t) => t.room_id === room.id && t.status !== 'done');
    for (const task of tasks) {
      const items: RoomShoppingItem[] = JSON.parse(task.shopping_items || '[]');
      if (items.length === 0) continue;
      result.push({ roomId: room.id, roomName: room.name, roomIcon: room.icon, roomColor: room.color, taskId: task.id, taskTitle: task.title, items });
    }
  }
  return result;
}
