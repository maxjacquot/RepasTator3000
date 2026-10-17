import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, typography, spacing, radii, shadows } from './theme';
import type { Recipe } from './types';

const CATEGORIES = ['Entrée', 'Plat', 'Dessert'] as const;

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
  onSaved: (updated: Omit<Recipe, 'id'>) => void;
}

export function EditRecipeModal({ visible, recipe, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(recipe.title);
  const [category, setCategory] = useState(recipe.category);
  const [description, setDescription] = useState(recipe.description);
  const [prepTime, setPrepTime] = useState(String(recipe.prep_time));
  const [cookTime, setCookTime] = useState(String(recipe.cook_time));
  const [tagsText, setTagsText] = useState(() => {
    try { return (JSON.parse(recipe.tags) as string[]).join(', '); } catch { return ''; }
  });
  const [ingredientsJson, setIngredientsJson] = useState(() => {
    try { return JSON.stringify(JSON.parse(recipe.ingredients), null, 2); } catch { return recipe.ingredients; }
  });
  const [stepsJson, setStepsJson] = useState(() => {
    try { return JSON.stringify(JSON.parse(recipe.steps), null, 2); } catch { return recipe.steps; }
  });

  const [errors, setErrors] = useState<string[]>([]);

  function validate(): Omit<Recipe, 'id'> | null {
    const errs: string[] = [];

    if (!title.trim()) errs.push('Le titre est requis.');

    const prep = parseInt(prepTime, 10);
    const cook = parseInt(cookTime, 10);
    if (isNaN(prep) || prep < 0) errs.push('Temps de préparation invalide.');
    if (isNaN(cook) || cook < 0) errs.push('Temps de cuisson invalide.');

    let parsedIngredients = recipe.ingredients;
    try { JSON.parse(ingredientsJson); parsedIngredients = ingredientsJson; }
    catch { errs.push('JSON ingrédients invalide.'); }

    let parsedSteps = recipe.steps;
    try { JSON.parse(stepsJson); parsedSteps = stepsJson; }
    catch { errs.push('JSON étapes invalide.'); }

    const tags = JSON.stringify(
      tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    );

    if (errs.length > 0) { setErrors(errs); return null; }
    setErrors([]);

    return {
      title: title.trim(),
      category,
      description: description.trim(),
      prep_time: prep,
      cook_time: cook,
      tags,
      ingredients: parsedIngredients,
      steps: parsedSteps,
    };
  }

  function handleSave() {
    const updated = validate();
    if (updated) onSaved(updated);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
            <Text style={s.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Modifier</Text>
          <TouchableOpacity onPress={handleSave} style={s.saveBtn}>
            <Text style={s.saveText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {errors.length > 0 && (
            <View style={s.errorBox}>
              {errors.map((e, i) => <Text key={i} style={s.errorText}>• {e}</Text>)}
            </View>
          )}

          {/* Titre */}
          <Text style={s.label}>Titre</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Nom de la recette" placeholderTextColor={colors.textSecondary} />

          {/* Catégorie */}
          <Text style={s.label}>Catégorie</Text>
          <View style={s.categoryRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[s.catBtn, category === cat && s.catBtnActive]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[s.catBtnText, category === cat && s.catBtnTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Temps */}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Préparation (min)</Text>
              <TextInput style={s.input} value={prepTime} onChangeText={setPrepTime} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Cuisson (min)</Text>
              <TextInput style={s.input} value={cookTime} onChangeText={setCookTime} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
            </View>
          </View>

          {/* Description */}
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            placeholder="Courte description..."
            placeholderTextColor={colors.textSecondary}
          />

          {/* Tags */}
          <Text style={s.label}>Tags <Text style={s.hint}>(séparés par des virgules)</Text></Text>
          <TextInput
            style={s.input}
            value={tagsText}
            onChangeText={setTagsText}
            placeholder="végétarien, rapide, épicé..."
            placeholderTextColor={colors.textSecondary}
          />

          {/* Ingrédients */}
          <Text style={s.label}>Ingrédients <Text style={s.hint}>(JSON)</Text></Text>
          <TextInput
            style={[s.input, s.jsonArea]}
            value={ingredientsJson}
            onChangeText={setIngredientsJson}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textSecondary}
          />

          {/* Étapes */}
          <Text style={s.label}>Étapes <Text style={s.hint}>(JSON)</Text></Text>
          <TextInput
            style={[s.input, s.jsonArea]}
            value={stepsJson}
            onChangeText={setStepsJson}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textSecondary}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
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
  cancelText: { color: colors.textSecondary, fontSize: typography.fontSizes.md },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  saveText: {
    color: colors.surface,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.xs,
    paddingBottom: 60,
  },
  label: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  hint: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.regular,
    color: colors.textSecondary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  jsonArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: typography.fontSizes.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryRow: {
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
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.fontSizes.sm,
  },
});
