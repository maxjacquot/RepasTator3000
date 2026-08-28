export type StepType = 'prep' | 'cook' | 'wait' | 'rest';

export type Ingredient = {
  qty: number | null;
  unit: string;
  name: string;
};

export type RecipeStep = {
  label: string;
  instruction: string;
  duration: number; // minutes
  type: StepType;
};

export type Recipe = {
  id: number;
  title: string;
  category: string;
  prep_time: number;
  cook_time: number;
  description: string;
  ingredients: string; // JSON: Ingredient[]
  steps: string;       // JSON: RecipeStep[]
  tags: string;        // JSON: string[]
};

export type ShoppingItem = {
  id: number;
  name: string;
  recipe_name: string;
  done: number; // 0 | 1
};

export type MealSlot = 'lunch' | 'dinner' | 'lunch_side' | 'dinner_side' | 'lunch_side2' | 'dinner_side2';

/** Créneau parent : le nombre de personnes est défini par repas, pas par plat */
export type MealKey = 'lunch' | 'dinner';

/** Nombre de personnes proposé par défaut sur un nouveau créneau */
export const DEFAULT_PEOPLE = 2;

export function mealKeyOf(slot: MealSlot): MealKey {
  return slot.startsWith('lunch') ? 'lunch' : 'dinner';
}

export type MealPlan = {
  date: string;
  lunch: number | null;
  dinner: number | null;
  lunch_side: number | null;
  dinner_side: number | null;
  lunch_side2: number | null;
  dinner_side2: number | null;
  lunch_people: number;
  dinner_people: number;
};

// ─── Maison ───────────────────────────────────────────────────

export type RoomTaskType = 'Travaux' | 'Achat' | 'Modification' | 'Idée';
export type RoomTaskStatus = 'todo' | 'preparing' | 'in_progress' | 'done';
export type RoomTaskPriority = 'high' | 'normal' | 'low';

export type Room = {
  id: number;
  name: string;
  icon: string;
  color: string;
};

export type RoomProject = {
  id: number;
  room_id: number;
  title: string;
  description: string;
  created_at: string;
};

export type RoomShoppingItem = {
  name: string;
  done: boolean;
};

export type RoomTask = {
  id: number;
  room_id: number;
  project_id: number | null;
  title: string;
  type: RoomTaskType;
  status: RoomTaskStatus;
  priority: RoomTaskPriority;
  note: string;
  shopping_items: string; // JSON: RoomShoppingItem[]
  created_at: string;
};

// ─── Sport ────────────────────────────────────────────────────

export type SportSession = {
  date: string;        // YYYY-MM-DD, clé primaire
  push_ups: number;
  knee_push_ups: number;
  abs: number;
  total_time: number;  // minutes
};
