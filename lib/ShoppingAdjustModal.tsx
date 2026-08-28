import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { Recipe } from './types';
import { colors, typography, spacing, radii, shadows } from './theme';
import { RepeatButton } from './RepeatButton';
import { parseStoredIngredients } from './ingredients';

export { parseStoredIngredients };

// ─── Helpers ingrédients ──────────────────────────────────────

export const BUYABLE_UNITS = new Set(['g', 'kg', 'ml', 'cl', 'L', 'unité', 'unités']);

export type IngredientLine = {
  id: number;
  qty: number | null;
  unit: string;
  name: string;
  currentQty: number;
  included: boolean;
};

export function parseIngredients(stored: string, factor: number): IngredientLine[] {
  return parseStoredIngredients(stored).map((ing, id) => {
    const isBuyable = ing.qty !== null && BUYABLE_UNITS.has(ing.unit);
    return {
      id,
      qty: isBuyable ? ing.qty : null,
      unit: ing.unit,
      name: ing.name,
      currentQty: isBuyable && ing.qty !== null ? ing.qty * factor : 0,
      included: true,
    };
  });
}

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

export function reconstructLine(line: IngredientLine): string {
  if (line.qty === null) return line.name;
  const parts: string[] = [formatQty(line.currentQty)];
  if (line.unit) parts.push(line.unit);
  parts.push(line.name);
  return parts.join(' ');
}

function getStep(qty: number): number {
  if (!Number.isInteger(qty)) return 0.5;
  if (qty >= 500) return 50;
  if (qty >= 100) return 10;
  return 1;
}

export function ingredientBaseKey(name: string): string {
  const m = name.match(/^\d+(?:[.,]\d+)?\s+\S+\s+(.*)/);
  if (m) return m[1].toLowerCase().trim();
  const m2 = name.match(/^\d+(?:[.,]\d+)?\s+(.*)/);
  if (m2) return m2[1].toLowerCase().trim();
  return name.toLowerCase().trim();
}

export function sumIngredientNames(existing: string, adding: string): string {
  const parse = (s: string) => {
    const m = s.match(/^(\d+(?:[.,]\d+)?)(.*)/);
    return m ? { qty: parseFloat(m[1].replace(',', '.')), suffix: m[2] } : null;
  };
  const e = parse(existing);
  const a = parse(adding);
  if (!e || !a) return existing;
  const total = e.qty + a.qty;
  const formatted = Number.isInteger(total) ? String(total) : total.toFixed(1).replace('.', ',');
  return formatted + e.suffix;
}

// ─── Modale ajustement ingrédients ───────────────────────────

interface IngredientsAdjustModalProps {
  visible: boolean;
  recipe: Recipe;
  lines: IngredientLine[];
  /** Nombre total de convives couverts par cet ajout aux courses */
  totalPeople: number;
  onClose: () => void;
  onAdd: (lines: IngredientLine[]) => void;
  onNeedNothing: () => void;
  onLinesChange: (lines: IngredientLine[]) => void;
}

export function IngredientsAdjustModal({
  visible, recipe, lines, totalPeople, onClose, onAdd, onNeedNothing, onLinesChange,
}: IngredientsAdjustModalProps) {
  function adjustQty(id: number, delta: number) {
    onLinesChange(lines.map((l) => {
      if (l.id !== id || l.qty === null) return l;
      const step = getStep(l.qty * totalPeople);
      const next = Math.max(0, Math.round((l.currentQty + delta * step) * 100) / 100);
      return { ...l, currentQty: next };
    }));
  }

  function toggleIncluded(id: number) {
    onLinesChange(lines.map((l) =>
      l.id === id ? { ...l, included: !l.included } : l
    ));
  }

  const activeCount = lines.filter((l) =>
    l.qty !== null ? l.currentQty > 0 : l.included
  ).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Ingrédients à acheter</Text>
            <Text style={s.subtitle}>{recipe.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>
          Quantités calculées pour {totalPeople} personne{totalPeople > 1 ? 's' : ''}.
          {' '}Ajuste si tu en as déjà à la maison — reste appuyé sur − ou + pour aller vite.
        </Text>

        <FlatList
          data={lines}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const isZero = item.qty !== null ? item.currentQty === 0 : !item.included;
            return (
              <View style={[s.row, isZero && s.rowDisabled]}>
                <Text style={[s.rowName, isZero && s.rowNameDisabled]} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.qty !== null ? (
                  <View style={s.stepper}>
                    <RepeatButton style={[s.stepBtn, s.stepBtnMinus]} onPress={(mult) => adjustQty(item.id, -mult)}>
                      <Text style={s.stepBtnText}>−</Text>
                    </RepeatButton>
                    <View style={s.stepValue}>
                      <Text style={[s.stepValueText, isZero && s.stepValueZero]}>
                        {formatQty(item.currentQty)}
                        {item.unit ? <Text style={s.stepUnit}> {item.unit}</Text> : null}
                      </Text>
                    </View>
                    <RepeatButton style={[s.stepBtn, s.stepBtnPlus]} onPress={(mult) => adjustQty(item.id, mult)}>
                      <Text style={s.stepBtnText}>+</Text>
                    </RepeatButton>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.checkbox, item.included && s.checkboxActive]}
                    onPress={() => toggleIncluded(item.id)}
                    activeOpacity={0.7}
                  >
                    {item.included && <Text style={s.checkmark}>✓</Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.addBtn, activeCount === 0 && s.addBtnDisabled]}
            onPress={() => onAdd(lines)}
            disabled={activeCount === 0}
            activeOpacity={0.85}
          >
            <Text style={s.addBtnText}>
              {activeCount === 0
                ? 'Sélectionne au moins un ingrédient'
                : `Ajouter ${activeCount} ingrédient${activeCount > 1 ? 's' : ''} aux courses`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.needNothingBtn} onPress={onNeedNothing} activeOpacity={0.75}>
            <Text style={s.needNothingText}>J'ai besoin de rien</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.dark,
  },
  title: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.extraBold, color: colors.surface },
  subtitle: { fontSize: typography.fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: colors.surface, fontSize: 16, fontWeight: typography.fontWeights.bold },
  hint: { fontSize: typography.fontSizes.sm, color: colors.textSecondary, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, fontStyle: 'italic' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  rowDisabled: { opacity: 0.45 },
  rowName: { flex: 1, fontSize: typography.fontSizes.md, color: colors.textPrimary, fontWeight: typography.fontWeights.medium },
  rowNameDisabled: { textDecorationLine: 'line-through', color: colors.textSecondary },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepBtnMinus: { backgroundColor: colors.border },
  stepBtnPlus: { backgroundColor: colors.primary },
  stepBtnText: { fontSize: 18, fontWeight: typography.fontWeights.bold, color: colors.textPrimary, lineHeight: 20 },
  stepValue: { minWidth: 48, alignItems: 'center' },
  stepValueText: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.extraBold, color: colors.textPrimary },
  stepValueZero: { color: colors.textSecondary },
  stepUnit: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.textSecondary },
  checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { fontSize: 13, color: colors.surface, fontWeight: typography.fontWeights.bold },
  footer: { padding: spacing.xl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.sm },
  addBtn: { backgroundColor: colors.primary, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center', ...shadows.primary },
  addBtnDisabled: { backgroundColor: colors.border, shadowOpacity: 0, elevation: 0 },
  addBtnText: { color: colors.surface, fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.extraBold },
  needNothingBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  needNothingText: { color: colors.textSecondary, fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, textDecorationLine: 'underline' },
});
