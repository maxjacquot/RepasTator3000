import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { getMealPlan, setMeal, setMealPeople, DEFAULT_PEOPLE, type Recipe } from './database';
import { colors, typography, spacing, radii, shadows } from './theme';
import { RepeatButton } from './RepeatButton';

// ─── Helpers ──────────────────────────────────────────────────

type SlotKey = 'lunch' | 'dinner';

const MIN_PEOPLE = 1;
const MAX_PEOPLE = 20;

const DAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS_SHORT = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];

export function getPlanningDays() {
  return Array.from({ length: 7 }, (_, offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    const label = offset === 0
      ? `Aujourd'hui, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
      : offset === 1
      ? `Demain, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
      : `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
    return { dateStr, label };
  });
}

// ─── Sélecteur de convives ────────────────────────────────────

interface PeoplePickerProps {
  icon: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function PeoplePicker({ icon, label, value, onChange }: PeoplePickerProps) {
  function bump(delta: number) {
    onChange(Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, value + delta)));
  }
  return (
    <View style={s.peopleRow}>
      <Text style={s.peopleLabel}>{icon}  {label}</Text>
      <View style={s.peopleStepper}>
        <RepeatButton
          style={[s.peopleBtn, value <= MIN_PEOPLE && s.peopleBtnDisabled]}
          onPress={() => bump(-1)}
          disabled={value <= MIN_PEOPLE}
        >
          <Text style={s.peopleBtnText}>−</Text>
        </RepeatButton>
        <Text style={s.peopleValue}>
          👥 {value}<Text style={s.peopleUnit}> pers.</Text>
        </Text>
        <RepeatButton
          style={[s.peopleBtn, s.peopleBtnPlus, value >= MAX_PEOPLE && s.peopleBtnDisabled]}
          onPress={() => bump(1)}
          disabled={value >= MAX_PEOPLE}
        >
          <Text style={[s.peopleBtnText, s.peopleBtnTextPlus]}>+</Text>
        </RepeatButton>
      </View>
    </View>
  );
}

// ─── Composant PlanningModal ───────────────────────────────────

export type PendingAdd = { dateStr: string; slot: SlotKey; id: number; people: number };

export interface PlanningModalProps {
  visible: boolean;
  recipe: Recipe;
  /** Pré-sélectionne un créneau à l'ouverture (optionnel) */
  preselect?: { dateStr: string; slot: SlotKey };
  onClose: () => void;
  /** pendingAdds = créneaux à ajouter (setMeal différé), totalPeople = convives cumulés */
  onConfirm: (pendingAdds: PendingAdd[], totalPeople: number) => void;
}

export function PlanningModal({ visible, recipe, preselect, onClose, onConfirm }: PlanningModalProps) {
  const days = getPlanningDays();
  const [selected, setSelected] = useState<Record<string, Record<SlotKey, boolean>>>({});
  const [people, setPeople] = useState<Record<string, Record<SlotKey, number>>>({});

  useEffect(() => {
    if (!visible) return;
    const initSel: Record<string, Record<SlotKey, boolean>> = {};
    const initPeople: Record<string, Record<SlotKey, number>> = {};
    for (const { dateStr } of days) {
      const plan = getMealPlan(dateStr);
      initSel[dateStr] = {
        lunch: plan.lunch === recipe.id,
        dinner: plan.dinner === recipe.id,
      };
      initPeople[dateStr] = {
        lunch: plan.lunch_people ?? DEFAULT_PEOPLE,
        dinner: plan.dinner_people ?? DEFAULT_PEOPLE,
      };
    }
    // Pré-sélection depuis l'accueil
    if (preselect) {
      initSel[preselect.dateStr] = {
        ...(initSel[preselect.dateStr] ?? { lunch: false, dinner: false }),
        [preselect.slot]: true,
      };
    }
    setSelected(initSel);
    setPeople(initPeople);
  }, [visible, recipe.id, preselect?.dateStr, preselect?.slot]);

  function toggle(dateStr: string, slot: SlotKey) {
    setSelected((prev) => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], [slot]: !prev[dateStr]?.[slot] },
    }));
  }

  function setSlotPeople(dateStr: string, slot: SlotKey, value: number) {
    setPeople((prev) => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] ?? { lunch: DEFAULT_PEOPLE, dinner: DEFAULT_PEOPLE }),
        [slot]: value,
      },
    }));
  }

  function handleConfirm() {
    const pendingAdds: PendingAdd[] = [];
    let totalPeople = 0;
    for (const { dateStr } of days) {
      const sel = selected[dateStr];
      if (!sel) continue;
      const nb = people[dateStr] ?? { lunch: DEFAULT_PEOPLE, dinner: DEFAULT_PEOPLE };
      const plan = getMealPlan(dateStr);
      for (const slot of ['lunch', 'dinner'] as SlotKey[]) {
        if (sel[slot]) {
          if (plan[slot] !== recipe.id) {
            totalPeople += nb[slot];
            pendingAdds.push({ dateStr, slot, id: recipe.id, people: nb[slot] });
          } else {
            // Déjà planifié : on met simplement le nombre de convives à jour
            setMealPeople(dateStr, slot, nb[slot]);
          }
        } else if (plan[slot] === recipe.id) {
          setMeal(dateStr, slot, null); // suppressions immédiates
        }
      }
    }
    onClose();
    onConfirm(pendingAdds, totalPeople);
  }

  const totalSelected = Object.values(selected).reduce(
    (acc, sel) => acc + (sel?.lunch ? 1 : 0) + (sel?.dinner ? 1 : 0),
    0
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Ajouter au planning</Text>
            <Text style={s.subtitle}>{recipe.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>
          Sélectionne les créneaux où tu veux cuisiner cette recette, puis indique pour combien
          de personnes.
        </Text>

        <FlatList
          data={days}
          keyExtractor={(item) => item.dateStr}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const sel = selected[item.dateStr] ?? { lunch: false, dinner: false };
            const nb = people[item.dateStr] ?? { lunch: DEFAULT_PEOPLE, dinner: DEFAULT_PEOPLE };
            return (
              <View style={s.dayRow}>
                <Text style={s.dayLabel}>{item.label}</Text>
                <View style={s.slotBtns}>
                  <TouchableOpacity
                    style={[s.slotBtn, sel.lunch && s.slotBtnActive]}
                    onPress={() => toggle(item.dateStr, 'lunch')}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.slotBtnText, sel.lunch && s.slotBtnTextActive]}>☀️  Midi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.slotBtn, sel.dinner && s.slotBtnActive]}
                    onPress={() => toggle(item.dateStr, 'dinner')}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.slotBtnText, sel.dinner && s.slotBtnTextActive]}>🌙  Soir</Text>
                  </TouchableOpacity>
                </View>

                {(sel.lunch || sel.dinner) && (
                  <View style={s.peopleBlock}>
                    {sel.lunch && (
                      <PeoplePicker
                        icon="☀️"
                        label="Midi"
                        value={nb.lunch}
                        onChange={(v) => setSlotPeople(item.dateStr, 'lunch', v)}
                      />
                    )}
                    {sel.dinner && (
                      <PeoplePicker
                        icon="🌙"
                        label="Soir"
                        value={nb.dinner}
                        onChange={(v) => setSlotPeople(item.dateStr, 'dinner', v)}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.confirmBtn, totalSelected === 0 && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={totalSelected === 0}
            activeOpacity={0.85}
          >
            <Text style={s.confirmBtnText}>
              {totalSelected === 0
                ? 'Sélectionne un créneau'
                : `Confirmer (${totalSelected} créneau${totalSelected > 1 ? 'x' : ''})`}
            </Text>
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
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.surface,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: typography.fontWeights.bold,
  },
  hint: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    fontStyle: 'italic',
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  dayRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  dayLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
  },
  slotBtns: { flexDirection: 'row', gap: spacing.sm },
  slotBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  slotBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  slotBtnText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  slotBtnTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  // Convives
  peopleBlock: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  peopleLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  peopleStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  peopleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  peopleBtnPlus: { backgroundColor: colors.primary },
  peopleBtnDisabled: { opacity: 0.4 },
  peopleBtnText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  peopleBtnTextPlus: { color: colors.surface },
  peopleValue: {
    minWidth: 74,
    textAlign: 'center',
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.textPrimary,
  },
  peopleUnit: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.primary,
  },
  confirmBtnDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    color: colors.surface,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.extraBold,
  },
});
