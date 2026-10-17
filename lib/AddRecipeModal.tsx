import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { addRecipe } from './database';
import type { Ingredient } from './types';
import { colors, typography, spacing, radii, shadows } from './theme';

// ─── Constantes ───────────────────────────────────────────────

const CATEGORIES = ['Entrée', 'Plat', 'Dessert'] as const;
type Category = typeof CATEGORIES[number];

const STEP_TYPES = ['prep', 'cook', 'wait', 'rest'] as const;
type StepType = typeof STEP_TYPES[number];

const STEP_TYPE_LABELS: Record<StepType, string> = {
  prep: '🔪 Prépa',
  cook: '🔥 Cuisson',
  wait: '❄️ Attente',
  rest: '⏸️ Repos',
};

const PRESET_TAGS = [
  'végétarien', 'vegan', 'carnivore', 'poisson', 'volaille',
  'sandwich', 'soupe', 'salade', 'pâtes', 'riz',
  'rapide', 'batch-cooking', 'sans-gluten', 'épicé', 'doux',
  'enfants', 'light', 'fait-maison',
];

// ─── Types locaux ─────────────────────────────────────────────

type StepDraft = {
  label: string;
  instruction: string;
  duration: string;
  type: StepType;
};

type IngredientDraft = {
  qty: string;
  unit: string;
  name: string;
};

const UNIT_SHORTCUTS = ['g', 'kg', 'ml', 'cl', 'L', 'unité', 'c. à café', 'c. à soupe', 'pincée'];

type FormState = {
  title: string;
  category: Category;
  description: string;
  prep_time: string;
  cook_time: string;
  tags: string[];
  ingredients: IngredientDraft[];
  steps: StepDraft[];
};

function emptyForm(): FormState {
  return {
    title: '',
    category: 'Plat',
    description: '',
    prep_time: '',
    cook_time: '',
    tags: [],
    ingredients: [{ qty: '', unit: '', name: '' }],
    steps: [{ label: '', instruction: '', duration: '', type: 'prep' }],
  };
}

// ─── Sous-composants ──────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[s.input, multiline && s.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────

interface AddRecipeModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddRecipeModal({ visible, onClose, onAdded }: AddRecipeModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');

  function reset() {
    setForm(emptyForm());
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  // ── Ingrédients ──

  function setIngredient(index: number, patch: Partial<IngredientDraft>) {
    const next = form.ingredients.map((ing, i) => i === index ? { ...ing, ...patch } : ing);
    setForm({ ...form, ingredients: next });
  }

  function addIngredient() {
    setForm({ ...form, ingredients: [...form.ingredients, { qty: '', unit: '', name: '' }] });
  }

  function removeIngredient(index: number) {
    if (form.ingredients.length === 1) return;
    setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== index) });
  }

  // ── Étapes ──

  function setStep(index: number, patch: Partial<StepDraft>) {
    const next = form.steps.map((s, i) => i === index ? { ...s, ...patch } : s);
    setForm({ ...form, steps: next });
  }

  function addStep() {
    setForm({
      ...form,
      steps: [...form.steps, { label: '', instruction: '', duration: '', type: 'prep' }],
    });
  }

  function removeStep(index: number) {
    if (form.steps.length === 1) return;
    setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) });
  }

  // ── Tags ──

  function toggleTag(tag: string) {
    setForm({
      ...form,
      tags: form.tags.includes(tag)
        ? form.tags.filter((t) => t !== tag)
        : [...form.tags, tag],
    });
  }

  // ── Sauvegarde ──

  function handleSave() {
    if (!form.title.trim()) {
      setError('Le nom de la recette est obligatoire.');
      return;
    }
    const prepTime = parseInt(form.prep_time, 10);
    if (isNaN(prepTime) || prepTime <= 0) {
      setError('Le temps de préparation doit être un nombre positif.');
      return;
    }

    const cookTime = form.cook_time.trim() ? parseInt(form.cook_time, 10) : 0;
    const ingredients: Ingredient[] = form.ingredients
      .filter((i) => i.name.trim())
      .map((i) => {
        const qtyNum = i.qty.trim() ? parseFloat(i.qty.replace(',', '.')) : NaN;
        return {
          qty: !isNaN(qtyNum) ? qtyNum : null,
          unit: i.unit.trim(),
          name: i.name.trim(),
        };
      });
    const steps = form.steps
      .filter((s) => s.label.trim())
      .map((s) => ({
        label: s.label.trim(),
        instruction: s.instruction.trim(),
        duration: parseInt(s.duration, 10) || 0,
        type: s.type,
      }));

    addRecipe({
      title: form.title.trim(),
      category: form.category,
      prep_time: prepTime,
      cook_time: isNaN(cookTime) ? 0 : cookTime,
      description: form.description.trim(),
      ingredients: ingredients.length > 0 ? JSON.stringify(ingredients) : '[]',
      steps: steps.length > 0 ? JSON.stringify(steps) : '',
      tags: form.tags.length > 0 ? JSON.stringify(form.tags) : '[]',
    });

    reset();
    onAdded();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.cancelBtn} activeOpacity={0.7}>
            <Text style={s.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nouvelle recette</Text>
          <TouchableOpacity onPress={handleSave} style={s.saveBtn} activeOpacity={0.8}>
            <Text style={s.saveText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* Nom */}
          <SectionLabel>Nom de la recette *</SectionLabel>
          <TextInput
            style={s.input}
            value={form.title}
            onChangeText={(v) => setForm({ ...form, title: v })}
            placeholder="Ex : Poulet rôti aux herbes"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Catégorie */}
          <SectionLabel>Catégorie</SectionLabel>
          <View style={s.catRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.catBtn, form.category === cat && s.catBtnActive]}
                onPress={() => setForm({ ...form, category: cat })}
                activeOpacity={0.7}
              >
                <Text style={[s.catBtnText, form.category === cat && s.catBtnTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <SectionLabel>Description</SectionLabel>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            placeholder="Courte description de la recette…"
            placeholderTextColor={colors.textSecondary}
            multiline
          />

          {/* Temps */}
          <View style={s.timeRow}>
            <View style={s.timeField}>
              <SectionLabel>Prépa (min) *</SectionLabel>
              <TextInput
                style={s.input}
                value={form.prep_time}
                onChangeText={(v) => setForm({ ...form, prep_time: v })}
                placeholder="30"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <View style={s.timeField}>
              <SectionLabel>Cuisson (min)</SectionLabel>
              <TextInput
                style={s.input}
                value={form.cook_time}
                onChangeText={(v) => setForm({ ...form, cook_time: v })}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Tags */}
          <SectionLabel>Tags</SectionLabel>
          <View style={s.tagsWrap}>
            {PRESET_TAGS.map((tag) => {
              const active = form.tags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[s.tag, active && s.tagActive]}
                  onPress={() => toggleTag(tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ingrédients */}
          <SectionLabel>Ingrédients</SectionLabel>
          <View style={s.listBlock}>
            {form.ingredients.map((ing, i) => (
              <View key={i} style={s.ingBlock}>
                <View style={s.ingRow}>
                  <TextInput
                    style={[s.input, s.ingQtyInput]}
                    value={ing.qty}
                    onChangeText={(v) => setIngredient(i, { qty: v })}
                    placeholder="Qté"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[s.input, s.ingUnitInput]}
                    value={ing.unit}
                    onChangeText={(v) => setIngredient(i, { unit: v })}
                    placeholder="Unité"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TextInput
                    style={[s.input, s.ingNameInput]}
                    value={ing.name}
                    onChangeText={(v) => setIngredient(i, { name: v })}
                    placeholder="Ingrédient"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => removeIngredient(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.unitShortcuts}>
                  {UNIT_SHORTCUTS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[s.unitChip, ing.unit === u && s.unitChipActive]}
                      onPress={() => setIngredient(i, { unit: u })}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.unitChipText, ing.unit === u && s.unitChipTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addIngredient} activeOpacity={0.7}>
              <Text style={s.addRowBtnText}>+ Ajouter un ingrédient</Text>
            </TouchableOpacity>
          </View>

          {/* Étapes */}
          <SectionLabel>Étapes</SectionLabel>
          <View style={s.listBlock}>
            {form.steps.map((step, i) => (
              <View key={i} style={s.stepCard}>
                <View style={s.stepCardHeader}>
                  <Text style={s.stepNum}>Étape {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeStep(i)} activeOpacity={0.7}>
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={s.input}
                  value={step.label}
                  onChangeText={(v) => setStep(i, { label: v })}
                  placeholder="Titre de l'étape"
                  placeholderTextColor={colors.textSecondary}
                />
                <TextInput
                  style={[s.input, s.inputMultiline]}
                  value={step.instruction}
                  onChangeText={(v) => setStep(i, { instruction: v })}
                  placeholder="Description détaillée…"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />
                <View style={s.stepMeta}>
                  <TextInput
                    style={[s.input, s.stepDurationInput]}
                    value={step.duration}
                    onChangeText={(v) => setStep(i, { duration: v })}
                    placeholder="min"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                  <View style={s.stepTypeRow}>
                    {STEP_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[s.stepTypeBtn, step.type === t && s.stepTypeBtnActive]}
                        onPress={() => setStep(i, { type: t })}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.stepTypeBtnText, step.type === t && s.stepTypeBtnTextActive]}>
                          {STEP_TYPE_LABELS[t]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addStep} activeOpacity={0.7}>
              <Text style={s.addRowBtnText}>+ Ajouter une étape</Text>
            </TouchableOpacity>
          </View>

          <View style={s.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
  cancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.md,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
  },
  saveText: {
    color: colors.surface,
    fontWeight: typography.fontWeights.bold,
    fontSize: typography.fontSizes.md,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.sm,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: typography.fontSizes.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    ...shadows.sm,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  catRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  catBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  catBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catBtnText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  catBtnTextActive: {
    color: colors.surface,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeField: { flex: 1 },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  tagTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  listBlock: { gap: spacing.sm },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listInput: { flex: 1 },
  ingBlock: { gap: 6 },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingQtyInput: { width: 56, textAlign: 'center' },
  ingUnitInput: { width: 80 },
  ingNameInput: { flex: 1 },
  unitShortcuts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 2,
  },
  unitChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  unitChipText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  unitChipTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  removeBtnText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: typography.fontWeights.bold,
  },
  addRowBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addRowBtnText: {
    color: colors.primary,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepNum: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepDurationInput: {
    width: 64,
    textAlign: 'center',
  },
  stepTypeRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  stepTypeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepTypeBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  stepTypeBtnText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  stepTypeBtnTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  bottomSpacer: { height: 40 },
});
