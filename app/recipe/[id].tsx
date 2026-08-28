import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import {
  getRecipeById,
  deleteRecipe,
  updateRecipe,
  setMeal,
  addToShoppingList,
  updateShoppingItemName,
  getShoppingList,
  type Recipe,
  type RecipeStep,
  type Ingredient,
  type StepType,
} from '../../lib/database';
import { colors, fonts, typography, spacing, radii, shadows } from '../../lib/theme';
import { useAppAlert } from '../../lib/AppAlert';
import { PlanningModal, type PendingAdd } from '../../lib/PlanningModal';
import { formatQty } from '../../lib/ShoppingAdjustModal';
import {
  IngredientsAdjustModal,
  parseIngredients,
  parseStoredIngredients,
  reconstructLine,
  ingredientBaseKey,
  sumIngredientNames,
  type IngredientLine,
} from '../../lib/ShoppingAdjustModal';

// ─── Couleurs catégories ──────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Entrée: '#4CAF50',
  Plat: '#FF6B35',
  Dessert: '#9C27B0',
};

// ─── Frise chronologique ──────────────────────────────────────

const STEP_CONFIG: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
  prep: { emoji: '🔪', color: '#FF6B35', bg: '#FFF0EA', label: 'Préparation' },
  cook: { emoji: '🔥', color: '#E53E3E', bg: '#FFF5F5', label: 'Cuisson' },
  wait: { emoji: '❄️', color: '#805AD5', bg: '#FAF5FF', label: 'Frigo' },
  rest: { emoji: '⏸️', color: '#38A169', bg: '#F0FFF4', label: 'Repos' },
};

function RecipeTimeline({ steps }: { steps: RecipeStep[] }) {
  const total = steps.reduce((acc, s) => acc + s.duration, 0);
  return (
    <View style={timeline.wrap}>
      <View style={timeline.header}>
        <Text style={timeline.sectionLabel}>Étapes</Text>
        <View style={timeline.totalBadge}>
          <Text style={timeline.totalBadgeText}>⏱ {total} min au total</Text>
        </View>
      </View>
      <View style={timeline.legend}>
        {Object.entries(STEP_CONFIG).map(([key, cfg]) => (
          <View key={key} style={[timeline.legendItem, { backgroundColor: cfg.bg }]}>
            <Text style={timeline.legendEmoji}>{cfg.emoji}</Text>
            <Text style={[timeline.legendLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        ))}
      </View>
      <View style={timeline.steps}>
        {steps.map((step, index) => {
          const cfg = STEP_CONFIG[step.type] ?? STEP_CONFIG.prep;
          const isLast = index === steps.length - 1;
          const widthPct = Math.max(15, Math.round((step.duration / total) * 100));
          return (
            <View key={index} style={timeline.stepRow}>
              <View style={timeline.dotCol}>
                <View style={[timeline.dot, { backgroundColor: cfg.color }]}>
                  <Text style={timeline.dotEmoji}>{cfg.emoji}</Text>
                </View>
                {!isLast && <View style={[timeline.line, { backgroundColor: cfg.color + '40' }]} />}
              </View>
              <View style={[timeline.stepCard, { borderLeftColor: cfg.color }]}>
                <View style={timeline.stepCardTop}>
                  <Text style={timeline.stepLabel}>{`Étape ${index + 1} — ${step.label}`}</Text>
                  <View style={[timeline.durationBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[timeline.durationText, { color: cfg.color }]}>{step.duration} min</Text>
                  </View>
                </View>
                {step.instruction ? <Text style={timeline.stepInstruction}>{step.instruction}</Text> : null}
                <View style={timeline.barTrack}>
                  <View style={[timeline.barFill, { width: `${widthPct}%` as any, backgroundColor: cfg.color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Types édition ────────────────────────────────────────────

type DraftIngredient = { qty: string; unit: string; name: string };
type DraftStep = { label: string; instruction: string; duration: string; type: StepType };
type Draft = {
  title: string;
  category: string;
  description: string;
  prepTime: string;
  cookTime: string;
  tags: string[];
  ingredients: DraftIngredient[];
  steps: DraftStep[];
};

function initDraft(recipe: Recipe): Draft {
  let ingredients: DraftIngredient[] = [];
  try {
    ingredients = (JSON.parse(recipe.ingredients) as Ingredient[]).map((i) => ({
      qty: i.qty !== null ? String(i.qty) : '',
      unit: i.unit,
      name: i.name,
    }));
  } catch { /* ignore */ }

  let steps: DraftStep[] = [];
  try {
    steps = (JSON.parse(recipe.steps) as RecipeStep[]).map((s) => ({
      label: s.label,
      instruction: s.instruction,
      duration: String(s.duration),
      type: s.type,
    }));
  } catch { /* ignore */ }

  let tags: string[] = [];
  try { tags = JSON.parse(recipe.tags); } catch { /* ignore */ }

  return {
    title: recipe.title,
    category: recipe.category,
    description: recipe.description,
    prepTime: String(recipe.prep_time),
    cookTime: String(recipe.cook_time),
    tags,
    ingredients,
    steps,
  };
}

function serializeDraft(draft: Draft): Omit<Recipe, 'id'> {
  const ingredients: Ingredient[] = draft.ingredients
    .filter((i) => i.name.trim())
    .map((i) => ({
      qty: i.qty.trim() ? parseFloat(i.qty.replace(',', '.')) : null,
      unit: i.unit.trim(),
      name: i.name.trim(),
    }));

  const steps: RecipeStep[] = draft.steps
    .filter((s) => s.label.trim())
    .map((s) => ({
      label: s.label.trim(),
      instruction: s.instruction.trim(),
      duration: parseInt(s.duration, 10) || 0,
      type: s.type,
    }));

  return {
    title: draft.title.trim() || 'Sans titre',
    category: draft.category,
    description: draft.description.trim(),
    prep_time: parseInt(draft.prepTime, 10) || 0,
    cook_time: parseInt(draft.cookTime, 10) || 0,
    tags: JSON.stringify(draft.tags),
    ingredients: JSON.stringify(ingredients),
    steps: JSON.stringify(steps),
  };
}

// ─── Carte d'étape éditable ───────────────────────────────────

const STEP_TYPES: StepType[] = ['prep', 'cook', 'wait', 'rest'];

function EditableStepCard({
  step, index, onChange, onDelete,
}: {
  step: DraftStep;
  index: number;
  onChange: (s: DraftStep) => void;
  onDelete: () => void;
}) {
  const cfg = STEP_CONFIG[step.type] ?? STEP_CONFIG.prep;
  return (
    <View style={[editS.stepCard, { borderLeftColor: cfg.color }]}>
      {/* Type selector + supprimer */}
      <View style={editS.stepCardHeader}>
        <View style={editS.typeRow}>
          {STEP_TYPES.map((t) => {
            const tc = STEP_CONFIG[t];
            const isActive = step.type === t;
            return (
              <TouchableOpacity
                key={t}
                style={[editS.typeBtn, isActive && { backgroundColor: tc.color + '25', borderColor: tc.color }]}
                onPress={() => onChange({ ...step, type: t })}
                activeOpacity={0.7}
              >
                <Text style={editS.typeBtnEmoji}>{tc.emoji}</Text>
                {isActive && <Text style={[editS.typeBtnLabel, { color: tc.color }]}>{tc.label}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={onDelete} style={editS.deleteRowBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Text style={editS.deleteRowBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Label + durée */}
      <View style={editS.stepLabelRow}>
        <TextInput
          style={editS.stepLabelInput}
          value={step.label}
          onChangeText={(v) => onChange({ ...step, label: v })}
          placeholder={`Étape ${index + 1}`}
          placeholderTextColor={colors.textSecondary}
        />
        <TextInput
          style={editS.durationInput}
          value={step.duration}
          onChangeText={(v) => onChange({ ...step, duration: v })}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={[editS.durationUnit, { color: cfg.color }]}>min</Text>
      </View>

      {/* Instruction */}
      <TextInput
        style={editS.instructionInput}
        value={step.instruction}
        onChangeText={(v) => onChange({ ...step, instruction: v })}
        placeholder="Description de l'étape..."
        placeholderTextColor={colors.textSecondary}
        multiline
      />
    </View>
  );
}

// ─── Ligne d'ingrédient éditable ─────────────────────────────

function EditableIngredientRow({
  ing, onChange, onDelete,
}: {
  ing: DraftIngredient;
  onChange: (i: DraftIngredient) => void;
  onDelete: () => void;
}) {
  return (
    <View style={editS.ingRow}>
      <View style={styles.ingredientDot} />
      <TextInput
        style={editS.ingQtyInput}
        value={ing.qty}
        onChangeText={(v) => onChange({ ...ing, qty: v })}
        keyboardType="decimal-pad"
        placeholder="Qté"
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        style={editS.ingUnitInput}
        value={ing.unit}
        onChangeText={(v) => onChange({ ...ing, unit: v })}
        placeholder="unité"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={editS.ingNameInput}
        value={ing.name}
        onChangeText={(v) => onChange({ ...ing, name: v })}
        placeholder="Ingrédient"
        placeholderTextColor={colors.textSecondary}
      />
      <TouchableOpacity onPress={onDelete} style={editS.deleteRowBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Text style={editS.deleteRowBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Écran détail recette ─────────────────────────────────────

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { showAlert, AlertComponent } = useAppAlert();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [planningModalVisible, setPlanningModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [ingredientLines, setIngredientLines] = useState<IngredientLine[]>([]);
  const [totalPeople, setTotalPeople] = useState(1);
  const [pendingMealAdds, setPendingMealAdds] = useState<PendingAdd[]>([]);

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newTagText, setNewTagText] = useState('');

  useEffect(() => {
    if (id) {
      const r = getRecipeById(Number(id));
      setRecipe(r);
      if (r) navigation.setOptions({ title: r.title });
    }
  }, [id]);

  function enterEdit() {
    if (!recipe) return;
    setDraft(initDraft(recipe));
    setNewTagText('');
    setEditMode(true);
    navigation.setOptions({ title: 'Modifier' });
  }

  function cancelEdit() {
    setEditMode(false);
    setDraft(null);
    if (recipe) navigation.setOptions({ title: recipe.title });
  }

  function saveEdit() {
    if (!draft) return;
    const updated = serializeDraft(draft);
    updateRecipe(Number(id), updated);
    const r = getRecipeById(Number(id));
    setRecipe(r);
    setEditMode(false);
    setDraft(null);
    if (r) navigation.setOptions({ title: r.title });
  }

  function handleDelete() {
    deleteRecipe(Number(id));
    router.back();
  }

  function handlePlanningConfirm(pendingAdds: PendingAdd[], people: number) {
    if (!recipe || pendingAdds.length === 0) return;
    setPendingMealAdds(pendingAdds);
    setTotalPeople(people);
    setIngredientLines(parseIngredients(recipe.ingredients, people));
    setAdjustModalVisible(true);
  }

  /** Les créneaux ne sont écrits en base qu'une fois les courses tranchées */
  function confirmCalendar(adds: PendingAdd[]) {
    for (const { dateStr, slot, id, people } of adds) {
      setMeal(dateStr, slot, id, people);
    }
    setPendingMealAdds([]);
  }

  function handleNeedNothing() {
    confirmCalendar(pendingMealAdds);
    setAdjustModalVisible(false);
  }

  function handleAddToShopping(lines: IngredientLine[]) {
    if (!recipe) return;
    confirmCalendar(pendingMealAdds);
    const active = lines.filter((l) => l.qty !== null ? l.currentQty > 0 : l.included);
    const existing = getShoppingList().filter((i) => i.recipe_name === recipe.title && i.done === 0);
    const toInsert: { name: string; recipe_name: string }[] = [];
    for (const line of active) {
      const newName = reconstructLine(line);
      const baseKey = line.name.toLowerCase().trim();
      const match = existing.find((e) => ingredientBaseKey(e.name) === baseKey);
      if (match) {
        updateShoppingItemName(match.id, sumIngredientNames(match.name, newName));
      } else {
        toInsert.push({ name: newName, recipe_name: recipe.title });
      }
    }
    if (toInsert.length > 0) addToShoppingList(toInsert);
    setAdjustModalVisible(false);
    showAlert({
      title: 'Courses mises à jour !',
      message: `${active.length} ingrédient${active.length > 1 ? 's' : ''} ajouté${active.length > 1 ? 's' : ''} à ta liste de courses.`,
    });
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Recette introuvable.</Text>
      </View>
    );
  }

  // ─── MODE ÉDITION ────────────────────────────────────────────

  if (editMode && draft) {
    const d = draft;

    function updateStep(i: number, s: DraftStep) {
      setDraft({ ...d, steps: d.steps.map((st, idx) => idx === i ? s : st) });
    }
    function deleteStep(i: number) {
      setDraft({ ...d, steps: d.steps.filter((_, idx) => idx !== i) });
    }
    function addStep() {
      setDraft({ ...d, steps: [...d.steps, { label: '', instruction: '', duration: '10', type: 'prep' }] });
    }
    function updateIngredient(i: number, ing: DraftIngredient) {
      setDraft({ ...d, ingredients: d.ingredients.map((x, idx) => idx === i ? ing : x) });
    }
    function deleteIngredient(i: number) {
      setDraft({ ...d, ingredients: d.ingredients.filter((_, idx) => idx !== i) });
    }
    function addIngredient() {
      setDraft({ ...d, ingredients: [...d.ingredients, { qty: '', unit: '', name: '' }] });
    }
    function removeTag(tag: string) {
      setDraft({ ...d, tags: d.tags.filter((t) => t !== tag) });
    }
    function addTag() {
      const t = newTagText.trim().toLowerCase();
      if (t && !d.tags.includes(t)) setDraft({ ...d, tags: [...d.tags, t] });
      setNewTagText('');
    }

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: 0, paddingBottom: 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Barre Annuler */}
          <View style={editS.actionBar}>
            <TouchableOpacity onPress={cancelEdit} style={editS.cancelBtn}>
              <Text style={editS.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>

          {/* Catégorie */}
          <View style={editS.categoryRow}>
            {(['Entrée', 'Plat', 'Dessert'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[editS.catBtn, d.category === cat && { backgroundColor: CATEGORY_COLORS[cat] ?? colors.primary }]}
                onPress={() => setDraft({ ...d, category: cat })}
                activeOpacity={0.7}
              >
                <Text style={[editS.catBtnText, d.category === cat && { color: colors.surface }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Temps */}
          <View style={editS.timesRow}>
            <View style={editS.timeField}>
              <Text style={editS.timeFieldLabel}>🔪 Prépa</Text>
              <TextInput
                style={editS.timeInput}
                value={d.prepTime}
                onChangeText={(v) => setDraft({ ...d, prepTime: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={editS.timeFieldUnit}>min</Text>
            </View>
            <View style={editS.timeField}>
              <Text style={editS.timeFieldLabel}>🔥 Cuisson</Text>
              <TextInput
                style={editS.timeInput}
                value={d.cookTime}
                onChangeText={(v) => setDraft({ ...d, cookTime: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={editS.timeFieldUnit}>min</Text>
            </View>
          </View>

          {/* Titre */}
          <TextInput
            style={editS.titleInput}
            value={d.title}
            onChangeText={(v) => setDraft({ ...d, title: v })}
            placeholder="Titre de la recette"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          {/* Tags */}
          <View style={editS.tagsSection}>
            {d.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {d.tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, editS.tagChipEdit]}
                    onPress={() => removeTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <Text style={editS.tagRemove}> ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={editS.addTagRow}>
              <TextInput
                style={editS.addTagInput}
                value={newTagText}
                onChangeText={setNewTagText}
                placeholder="Ajouter un tag..."
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                onSubmitEditing={addTag}
                returnKeyType="done"
              />
              {newTagText.trim() ? (
                <TouchableOpacity onPress={addTag} style={editS.addTagBtn}>
                  <Text style={editS.addTagBtnText}>+</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            style={editS.descriptionInput}
            value={d.description}
            onChangeText={(v) => setDraft({ ...d, description: v })}
            placeholder="Courte description..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          {/* Étapes */}
          <View style={styles.divider} />
          <View style={editS.sectionHeader}>
            <Text style={styles.sectionLabel}>Étapes</Text>
            <TouchableOpacity onPress={addStep} style={editS.addRowBtn}>
              <Text style={editS.addRowBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {d.steps.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              {d.steps.map((step, i) => (
                <EditableStepCard
                  key={i}
                  step={step}
                  index={i}
                  onChange={(s) => updateStep(i, s)}
                  onDelete={() => deleteStep(i)}
                />
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={addStep} style={editS.addInlineBtn}>
              <Text style={editS.addInlineBtnText}>+ Ajouter une étape</Text>
            </TouchableOpacity>
          )}

          {/* Ingrédients */}
          <View style={styles.divider} />
          <View style={editS.sectionHeader}>
            <Text style={styles.sectionLabel}>Ingrédients</Text>
            <TouchableOpacity onPress={addIngredient} style={editS.addRowBtn}>
              <Text style={editS.addRowBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {d.ingredients.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {d.ingredients.map((ing, i) => (
                <EditableIngredientRow
                  key={i}
                  ing={ing}
                  onChange={(x) => updateIngredient(i, x)}
                  onDelete={() => deleteIngredient(i)}
                />
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={addIngredient} style={editS.addInlineBtn}>
              <Text style={editS.addInlineBtnText}>+ Ajouter un ingrédient</Text>
            </TouchableOpacity>
          )}

          {/* Supprimer */}
          <TouchableOpacity style={[styles.deleteBtn, { marginTop: spacing.xxxxl }]} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Supprimer la recette</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Bouton flottant Enregistrer */}
        <TouchableOpacity style={editS.floatingSaveBtn} onPress={saveEdit} activeOpacity={0.88}>
          <Text style={editS.floatingSaveText}>✓  Enregistrer</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // ─── MODE LECTURE ────────────────────────────────────────────

  const ingredients = parseStoredIngredients(recipe.ingredients);
  let steps: RecipeStep[] = [];
  try { if (recipe.steps) steps = JSON.parse(recipe.steps); } catch { /* ignore */ }
  let tags: string[] = [];
  try { if (recipe.tags) tags = JSON.parse(recipe.tags); } catch { /* ignore */ }
  const hasCookTime = recipe.cook_time > 0;
  const prepOnly = recipe.prep_time;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Badges */}
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[recipe.category] ?? '#888' }]}>
            <Text style={styles.categoryText}>{recipe.category}</Text>
          </View>
          {hasCookTime ? (
            <>
              <View style={[styles.timeBadge, styles.timeBadgePrep]}>
                <Text style={styles.timeText}>🔪 {prepOnly} min de prépa</Text>
              </View>
              <View style={[styles.timeBadge, styles.timeBadgeCook]}>
                <Text style={[styles.timeText, { color: '#E53E3E' }]}>🔥 {recipe.cook_time} min de cuisson</Text>
              </View>
            </>
          ) : (
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>⏱ {recipe.prep_time} min</Text>
            </View>
          )}
        </View>

        {/* Titre */}
        <Text style={styles.title}>{recipe.title}</Text>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Ingrédients */}
        {ingredients.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Ingrédients</Text>
            <View style={styles.ingredientsList}>
              {ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <View style={styles.ingredientDot} />
                  {ing.qty !== null && (
                    <Text style={styles.ingredientQty}>
                      {formatQty(ing.qty)}{ing.unit ? ` ${ing.unit}` : ''}
                    </Text>
                  )}
                  <Text style={styles.ingredientText}>{ing.name}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.planningBtn}
              onPress={() => setPlanningModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.planningBtnText}>📅  Ajouter au planning</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
          </>
        )}

        {/* Description */}
        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.description}>{recipe.description}</Text>

        {/* Étapes */}
        {steps.length > 0 && (
          <>
            <View style={styles.divider} />
            <RecipeTimeline steps={steps} />
          </>
        )}

        {/* Modifier */}
        <TouchableOpacity style={styles.editBtn} onPress={enterEdit} activeOpacity={0.8}>
          <Text style={styles.editBtnText}>✏️  Modifier la recette</Text>
        </TouchableOpacity>

        {/* Supprimer */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Supprimer la recette</Text>
        </TouchableOpacity>
      </ScrollView>

      {planningModalVisible && (
        <PlanningModal
          visible={planningModalVisible}
          recipe={recipe}
          onClose={() => setPlanningModalVisible(false)}
          onConfirm={handlePlanningConfirm}
        />
      )}

      {adjustModalVisible && (
        <IngredientsAdjustModal
          visible={adjustModalVisible}
          recipe={recipe}
          lines={ingredientLines}
          totalPeople={totalPeople}
          onClose={() => { setPendingMealAdds([]); setAdjustModalVisible(false); }}
          onAdd={handleAddToShopping}
          onNeedNothing={handleNeedNothing}
          onLinesChange={setIngredientLines}
        />
      )}

      {AlertComponent}
    </>
  );
}

// ─── Styles lecture ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: colors.textSecondary, fontSize: typography.fontSizes.md },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  categoryBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  categoryText: { color: colors.surface, fontWeight: typography.fontWeights.bold, fontSize: typography.fontSizes.sm },
  timeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeBadgePrep: { borderColor: '#FF6B35', backgroundColor: '#FFF0EA' },
  timeBadgeCook: { borderColor: '#E53E3E', backgroundColor: '#FFF5F5' },
  timeText: { color: colors.textSecondary, fontWeight: typography.fontWeights.semiBold, fontSize: typography.fontSizes.sm },
  title: { fontSize: 30, fontFamily: fonts.display, color: colors.textPrimary, marginBottom: spacing.lg, lineHeight: 38 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  sectionLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  description: { fontSize: typography.fontSizes.md, color: colors.textPrimary, lineHeight: typography.lineHeights.relaxed },
  ingredientsList: { gap: spacing.sm },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ingredientDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, flexShrink: 0 },
  ingredientQty: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.semiBold, color: colors.primary, minWidth: 52 },
  ingredientText: { flex: 1, fontSize: typography.fontSizes.md, color: colors.textPrimary },
  planningBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.primary,
  },
  planningBtnText: { color: colors.surface, fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tagChipText: { fontSize: typography.fontSizes.xs, color: colors.primary, fontWeight: typography.fontWeights.semiBold },
  editBtn: {
    marginTop: spacing.xxxxl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontWeight: typography.fontWeights.bold, fontSize: typography.fontSizes.md },
  deleteBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#DC2626', fontWeight: typography.fontWeights.bold, fontSize: typography.fontSizes.md },
});

// ─── Styles frise chronologique ───────────────────────────────

const timeline = StyleSheet.create({
  wrap: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  totalBadgeText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold, color: colors.primary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full },
  legendEmoji: { fontSize: 11 },
  legendLabel: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semiBold },
  steps: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  dotCol: { alignItems: 'center', width: 36 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dotEmoji: { fontSize: 16 },
  line: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  stepCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderLeftWidth: 3,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  stepCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stepLabel: { flex: 1, fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.bold, color: colors.textPrimary },
  stepInstruction: { fontSize: typography.fontSizes.sm, color: colors.textSecondary, lineHeight: typography.lineHeights.normal },
  durationBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.full, flexShrink: 0 },
  durationText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold },
  barTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, opacity: 0.7 },
});

// ─── Styles mode édition ──────────────────────────────────────

const editS = StyleSheet.create({
  // Barre Save/Cancel
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.dark,
    marginHorizontal: -spacing.xl,
    marginBottom: spacing.xl,
  },
  cancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelText: { color: 'rgba(255,255,255,0.55)', fontSize: typography.fontSizes.md },
  floatingSaveBtn: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxxl,
    borderRadius: radii.full,
    ...shadows.primary,
  },
  floatingSaveText: { color: colors.surface, fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.bold },

  // Catégorie
  categoryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  catBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  catBtnText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semiBold, color: colors.textSecondary },

  // Temps
  timesRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  timeField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeFieldLabel: { fontSize: typography.fontSizes.sm, color: colors.textSecondary, fontWeight: typography.fontWeights.medium },
  timeInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    ...shadows.sm,
  },
  timeFieldUnit: { fontSize: typography.fontSizes.sm, color: colors.textSecondary },

  // Titre
  titleInput: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    lineHeight: 36,
    marginBottom: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '50',
    paddingBottom: spacing.sm,
  },

  // Tags
  tagsSection: { gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm },
  tagChipEdit: { flexDirection: 'row', alignItems: 'center' },
  tagRemove: { fontSize: typography.fontSizes.xs, color: colors.primary, fontWeight: typography.fontWeights.bold },
  addTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addTagInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.fontSizes.sm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTagBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addTagBtnText: { color: colors.surface, fontSize: 20, fontWeight: typography.fontWeights.bold, lineHeight: 24 },

  // Description
  descriptionInput: {
    fontSize: typography.fontSizes.md,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.relaxed,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  addRowBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addRowBtnText: { color: colors.primary, fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.bold },
  addInlineBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addInlineBtnText: { color: colors.textSecondary, fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },

  // Étape éditable
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  stepCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeRow: { flexDirection: 'row', gap: spacing.xs },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeBtnEmoji: { fontSize: 13 },
  typeBtnLabel: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semiBold },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepLabelInput: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  durationInput: {
    width: 44,
    textAlign: 'center',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationUnit: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semiBold },
  instructionInput: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.normal,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
    minHeight: 48,
    textAlignVertical: 'top',
  },

  // Ingrédient éditable
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ingQtyInput: {
    width: 48,
    textAlign: 'center',
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  ingUnitInput: {
    width: 56,
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
    textAlign: 'center',
  },
  ingNameInput: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },

  // Bouton supprimer ligne
  deleteRowBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRowBtnText: { color: '#DC2626', fontSize: 9, fontWeight: typography.fontWeights.bold, lineHeight: 11 },
});
