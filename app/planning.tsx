import { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  TextInput,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getMealPlan,
  getRecipeById,
  getAllRecipes,
  setMeal,
  addToShoppingList,
  updateShoppingItemName,
  getShoppingList,
  mealKeyOf,
  type Recipe,
  type MealSlot,
} from '../lib/database';
import { colors, fonts, typography, spacing, radii, shadows, Badge } from '../lib/theme';
import { TabBar, type TabDef } from '../lib/TabBar';
import { CoursesPanel } from '../lib/panels/CoursesPanel';
import { RecipesPanel } from '../lib/panels/RecipesPanel';
import { PlanningModal, type PendingAdd } from '../lib/PlanningModal';
import {
  IngredientsAdjustModal,
  parseIngredients,
  reconstructLine,
  ingredientBaseKey,
  sumIngredientNames,
  type IngredientLine,
} from '../lib/ShoppingAdjustModal';
import { useAppAlert } from '../lib/AppAlert';
import { searchRecipes } from '../lib/recipeSearch';

// ─── Helpers date ─────────────────────────────────────────────

const DAYS_COUNT = 7;
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function getDateString(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function formatDayLabel(dateStr: string, offset: number): { main: string; sub: string } {
  const d = new Date(dateStr + 'T12:00:00');
  const dayNum = d.getDate();
  const month = MONTHS_FR[d.getMonth()];
  const dayName = DAYS_FR[d.getDay()];
  if (offset === 0) return { main: "Aujourd'hui", sub: `${dayName} ${dayNum} ${month}` };
  if (offset === 1) return { main: 'Demain', sub: `${dayName} ${dayNum} ${month}` };
  return { main: dayName, sub: `${dayNum} ${month}` };
}

type DayData = {
  dateStr: string;
  label: { main: string; sub: string };
  lunchRecipe: Recipe | null;
  lunchSideRecipe: Recipe | null;
  lunchSide2Recipe: Recipe | null;
  dinnerRecipe: Recipe | null;
  dinnerSideRecipe: Recipe | null;
  dinnerSide2Recipe: Recipe | null;
  lunchPeople: number;
  dinnerPeople: number;
};

// ─── Modale choix de recette ──────────────────────────────────

const PICKER_CATEGORIES = ['Toutes', 'Entrée', 'Plat', 'Dessert'];

const PICKER_EMOJI: Record<string, string> = {
  Entrée: '🥗',
  Plat: '🍽️',
  Dessert: '🍰',
};

const PICKER_EMOJI_BG: Record<string, string> = {
  Entrée: colors.successLight,
  Plat: colors.primaryLight,
  Dessert: colors.primaryLight,
};

function getPickerBadge(recipe: Recipe): { label: string; color: string } {
  if (recipe.prep_time <= 15) return { label: 'Rapide', color: colors.primary };
  if (recipe.category === 'Entrée') return { label: 'Sain', color: colors.success };
  return { label: 'Facile', color: colors.success };
}

interface RecipePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
}

function RecipePickerModal({ visible, onClose, onSelect }: RecipePickerModalProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toutes');

  useEffect(() => {
    if (visible) {
      setRecipes(getAllRecipes());
      setSearch('');
      setActiveCategory('Toutes');
    }
  }, [visible]);

  const filtered = searchRecipes(recipes, search).filter(
    ({ recipe }) => activeCategory === 'Toutes' || recipe.category === activeCategory
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={picker.root}>
        <View style={picker.header}>
          <Text style={picker.title}>Choisir une recette</Text>
          <TouchableOpacity onPress={onClose} style={picker.closeBtn}>
            <Text style={picker.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={picker.searchWrap}>
          <TextInput
            style={picker.search}
            placeholder="Rechercher un plat, un ingrédient..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={picker.filterRow}>
          {PICKER_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[picker.filterBtn, activeCategory === cat && picker.filterBtnActive]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[picker.filterText, activeCategory === cat && picker.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={({ recipe }) => String(recipe.id)}
          contentContainerStyle={picker.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={picker.empty}>Aucune recette trouvée.</Text>
          }
          renderItem={({ item: { recipe: item, ingredientHits } }) => {
            const emoji = PICKER_EMOJI[item.category] ?? '🍴';
            const emojiBg = PICKER_EMOJI_BG[item.category] ?? colors.primaryLight;
            const badge = getPickerBadge(item);
            return (
              <TouchableOpacity
                style={picker.item}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[picker.emojiBox, { backgroundColor: emojiBg }]}>
                  <Text style={picker.emojiText}>{emoji}</Text>
                </View>
                <View style={picker.itemBody}>
                  <Text style={picker.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={picker.itemMetaRow}>
                    {item.cook_time > 0 ? (
                      <>
                        <Text style={picker.itemMeta}>🔪 {item.prep_time} min</Text>
                        <Text style={picker.itemMetaSep}>·</Text>
                        <Text style={[picker.itemMeta, picker.itemMetaCook]}>🔥 {item.cook_time} min</Text>
                      </>
                    ) : (
                      <Text style={picker.itemMeta}>⏱ {item.prep_time} min</Text>
                    )}
                  </View>
                  <Badge label={badge.label} color={badge.color} style={picker.badge} />
                  {ingredientHits.length > 0 && (
                    <Text style={picker.itemHits} numberOfLines={1}>
                      🧺 contient : {ingredientHits.join(', ')}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Créneau repas ────────────────────────────────────────────

interface SideSlotProps {
  side: Recipe | null;
  onView: () => void;
  onClear: () => void;
  onAdd: () => void;
  placeholder: string;
}

function SideSlot({ side, onView, onClear, onAdd, placeholder }: SideSlotProps) {
  if (side) {
    return (
      <View style={styles.recipeRow}>
        <TouchableOpacity style={[styles.recipeCard, styles.sideCard]} onPress={onView} activeOpacity={0.75}>
          <View style={styles.recipeCardBody}>
            <Text style={styles.sideTitleText}>{side.title}</Text>
            <Text style={styles.recipeMeta}>{side.category} · ⏱ {side.prep_time} min</Text>
          </View>
          <Text style={styles.recipeChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.addSlotBtn, styles.addSideBtn]} onPress={onAdd} activeOpacity={0.7}>
      <Text style={styles.addSlotIcon}>+</Text>
      <Text style={styles.addSlotText}>{placeholder}</Text>
    </TouchableOpacity>
  );
}

interface MealSlotProps {
  icon: string;
  label: string;
  recipe: Recipe | null;
  sideRecipe: Recipe | null;
  side2Recipe: Recipe | null;
  people: number;
  onView: () => void;
  onClear: () => void;
  onAdd: () => void;
  onViewSide: () => void;
  onClearSide: () => void;
  onAddSide: () => void;
  onViewSide2: () => void;
  onClearSide2: () => void;
  onAddSide2: () => void;
}

function MealSlot({ icon, label, recipe, sideRecipe, side2Recipe, people, onView, onClear, onAdd, onViewSide, onClearSide, onAddSide, onViewSide2, onClearSide2, onAddSide2 }: MealSlotProps) {
  return (
    <View style={styles.slot}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotIcon}>{icon}</Text>
        <Text style={styles.slotLabel}>{label}</Text>
        {recipe && (
          <Text style={styles.peopleBadge}>👥 {people} pers.</Text>
        )}
      </View>

      {recipe ? (
        <>
          <View style={styles.recipeRow}>
            <TouchableOpacity style={styles.recipeCard} onPress={onView} activeOpacity={0.75}>
              <View style={styles.recipeCardBody}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.category} · ⏱ {recipe.prep_time} min
                </Text>
              </View>
              <Text style={styles.recipeChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sideSection}>
            <Text style={styles.sideLabel}>Accompagnements</Text>
            <SideSlot
              side={sideRecipe}
              onView={onViewSide}
              onClear={onClearSide}
              onAdd={onAddSide}
              placeholder="Ajouter un accompagnement"
            />
            {(sideRecipe || side2Recipe) && (
              <SideSlot
                side={side2Recipe}
                onView={onViewSide2}
                onClear={onClearSide2}
                onAdd={onAddSide2}
                placeholder="Ajouter un 2ème accompagnement"
              />
            )}
          </View>
        </>
      ) : (
        <TouchableOpacity style={styles.addSlotBtn} onPress={onAdd} activeOpacity={0.7}>
          <Text style={styles.addSlotIcon}>+</Text>
          <Text style={styles.addSlotText}>Ajouter une recette</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Page d'un jour ───────────────────────────────────────────

interface DayPageProps {
  day: DayData;
  width: number;
  height: number;
  isToday: boolean;
  router: ReturnType<typeof useRouter>;
  onClearMeal: (dateStr: string, slot: 'lunch' | 'dinner' | 'lunch_side' | 'dinner_side' | 'lunch_side2' | 'dinner_side2') => void;
  onAddMeal: (dateStr: string, slot: 'lunch' | 'dinner' | 'lunch_side' | 'dinner_side' | 'lunch_side2' | 'dinner_side2') => void;
}

function DayPage({ day, width, height, isToday, router, onClearMeal, onAddMeal }: DayPageProps) {
  return (
    <View style={[styles.page, { width, height }]}>
      <View style={styles.dayLabelBlock}>
        <Text style={[styles.dayMain, isToday && styles.dayMainToday]}>{day.label.main}</Text>
        <Text style={styles.daySub}>{day.label.sub}</Text>
      </View>

      <View style={styles.slotsContainer}>
        <MealSlot
          icon="🥗"
          label="Midi"
          recipe={day.lunchRecipe}
          sideRecipe={day.lunchSideRecipe}
          side2Recipe={day.lunchSide2Recipe}
          people={day.lunchPeople}
          onView={() => router.push(`/recipe/${day.lunchRecipe!.id}`)}
          onClear={() => onClearMeal(day.dateStr, 'lunch')}
          onAdd={() => onAddMeal(day.dateStr, 'lunch')}
          onViewSide={() => router.push(`/recipe/${day.lunchSideRecipe!.id}`)}
          onClearSide={() => onClearMeal(day.dateStr, 'lunch_side')}
          onAddSide={() => onAddMeal(day.dateStr, 'lunch_side')}
          onViewSide2={() => router.push(`/recipe/${day.lunchSide2Recipe!.id}`)}
          onClearSide2={() => onClearMeal(day.dateStr, 'lunch_side2')}
          onAddSide2={() => onAddMeal(day.dateStr, 'lunch_side2')}
        />
        <MealSlot
          icon="🥣"
          label="Soir"
          recipe={day.dinnerRecipe}
          sideRecipe={day.dinnerSideRecipe}
          side2Recipe={day.dinnerSide2Recipe}
          people={day.dinnerPeople}
          onView={() => router.push(`/recipe/${day.dinnerRecipe!.id}`)}
          onClear={() => onClearMeal(day.dateStr, 'dinner')}
          onAdd={() => onAddMeal(day.dateStr, 'dinner')}
          onViewSide={() => router.push(`/recipe/${day.dinnerSideRecipe!.id}`)}
          onClearSide={() => onClearMeal(day.dateStr, 'dinner_side')}
          onAddSide={() => onAddMeal(day.dateStr, 'dinner_side')}
          onViewSide2={() => router.push(`/recipe/${day.dinnerSide2Recipe!.id}`)}
          onClearSide2={() => onClearMeal(day.dateStr, 'dinner_side2')}
          onAddSide2={() => onAddMeal(day.dateStr, 'dinner_side2')}
        />
      </View>
    </View>
  );
}

// ─── Panneau Planning ─────────────────────────────────────────

interface PlanningPanelProps {
  width: number;
  isFocused: boolean;
  focusKey: number;
}

function PlanningPanel({ width, isFocused, focusKey }: PlanningPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert, AlertComponent } = useAppAlert();
  const [days, setDays] = useState<DayData[]>([]);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pickerTarget, setPickerTarget] = useState<{ dateStr: string; slot: 'lunch' | 'dinner' | 'lunch_side' | 'dinner_side' | 'lunch_side2' | 'dinner_side2' } | null>(null);
  const [planningRecipe, setPlanningRecipe] = useState<Recipe | null>(null);
  const [planningPreselect, setPlanningPreselect] = useState<{ dateStr: string; slot: 'lunch' | 'dinner' } | null>(null);
  const [adjustRecipe, setAdjustRecipe] = useState<Recipe | null>(null);
  const [adjustLines, setAdjustLines] = useState<IngredientLine[]>([]);
  const [adjustPeople, setAdjustPeople] = useState(1);
  const [pendingMealAdds, setPendingMealAdds] = useState<{ dateStr: string; slot: MealSlot; id: number; people: number }[]>([]);

  const loadData = useCallback(() => {
    const loaded: DayData[] = Array.from({ length: DAYS_COUNT }, (_, offset) => {
      const dateStr = getDateString(offset);
      const plan = getMealPlan(dateStr);
      return {
        dateStr,
        label: formatDayLabel(dateStr, offset),
        lunchRecipe: plan.lunch ? getRecipeById(plan.lunch) : null,
        lunchSideRecipe: plan.lunch_side ? getRecipeById(plan.lunch_side) : null,
        lunchSide2Recipe: plan.lunch_side2 ? getRecipeById(plan.lunch_side2) : null,
        dinnerRecipe: plan.dinner ? getRecipeById(plan.dinner) : null,
        dinnerSideRecipe: plan.dinner_side ? getRecipeById(plan.dinner_side) : null,
        dinnerSide2Recipe: plan.dinner_side2 ? getRecipeById(plan.dinner_side2) : null,
        lunchPeople: plan.lunch_people,
        dinnerPeople: plan.dinner_people,
      };
    });
    setDays(loaded);
  }, []);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, focusKey]);

  function handleClearMeal(dateStr: string, slot: 'lunch' | 'dinner' | 'lunch_side' | 'dinner_side' | 'lunch_side2' | 'dinner_side2') {
    setMeal(dateStr, slot, null);
    if (slot === 'lunch') { setMeal(dateStr, 'lunch_side', null); setMeal(dateStr, 'lunch_side2', null); }
    if (slot === 'dinner') { setMeal(dateStr, 'dinner_side', null); setMeal(dateStr, 'dinner_side2', null); }
    loadData();
  }

  function handleSelectRecipe(recipe: Recipe) {
    if (!pickerTarget) return;
    const { dateStr, slot } = pickerTarget;
    setPickerTarget(null);

    if (slot === 'lunch_side' || slot === 'dinner_side' || slot === 'lunch_side2' || slot === 'dinner_side2') {
      // Un accompagnement reprend le nombre de convives du créneau parent
      const plan = getMealPlan(dateStr);
      const people = mealKeyOf(slot) === 'lunch' ? plan.lunch_people : plan.dinner_people;
      setPendingMealAdds([{ dateStr, slot, id: recipe.id, people }]);
      setAdjustRecipe(recipe);
      setAdjustLines(parseIngredients(recipe.ingredients, people));
      setAdjustPeople(people);
    } else {
      setPlanningPreselect({ dateStr, slot });
      setPlanningRecipe(recipe);
    }
  }

  function handlePlanningConfirm(pendingAdds: PendingAdd[], totalPeople: number) {
    setPendingMealAdds(pendingAdds);
    if (planningRecipe && totalPeople > 0) {
      setAdjustRecipe(planningRecipe);
      setAdjustLines(parseIngredients(planningRecipe.ingredients, totalPeople));
      setAdjustPeople(totalPeople);
    }
    setPlanningRecipe(null);
    setPlanningPreselect(null);
    loadData();
  }

  function confirmCalendar() {
    for (const { dateStr, slot, id, people } of pendingMealAdds) {
      setMeal(dateStr, slot, id, people);
    }
    setPendingMealAdds([]);
    loadData();
  }

  function handleAddToShopping(lines: IngredientLine[]) {
    if (!adjustRecipe) return;
    confirmCalendar();
    const active = lines.filter((l) => l.qty !== null ? l.currentQty > 0 : l.included);
    const existing = getShoppingList().filter((i) => i.recipe_name === adjustRecipe.title && i.done === 0);
    const toInsert: { name: string; recipe_name: string }[] = [];
    for (const line of active) {
      const newName = reconstructLine(line);
      const baseKey = line.name.toLowerCase().trim();
      const match = existing.find((e) => ingredientBaseKey(e.name) === baseKey);
      if (match) {
        updateShoppingItemName(match.id, sumIngredientNames(match.name, newName));
      } else {
        toInsert.push({ name: newName, recipe_name: adjustRecipe.title });
      }
    }
    if (toInsert.length > 0) addToShoppingList(toInsert);
    setAdjustRecipe(null);
    showAlert({
      title: 'Courses mises à jour !',
      message: `${active.length} ingrédient${active.length > 1 ? 's' : ''} ajouté${active.length > 1 ? 's' : ''} à ta liste de courses.`,
    });
  }

  function handleNeedNothing() {
    confirmCalendar();
    setAdjustRecipe(null);
  }

  const plannedCount = days.reduce((acc, d) => {
    return acc + (d.lunchRecipe ? 1 : 0) + (d.dinnerRecipe ? 1 : 0);
  }, 0);

  return (
    <View style={[styles.panelRoot, { width }]} pointerEvents={isFocused ? 'auto' : 'none'}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>🏠</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Menu du jour</Text>
              <Text style={styles.headerSub}>
                {plannedCount === 0
                  ? 'Aucun repas planifié'
                  : `${plannedCount} repas planifié${plannedCount > 1 ? 's' : ''} cette semaine`}
              </Text>
            </View>
            <View style={[styles.headerBadge, plannedCount > 0 && styles.headerBadgeActive]}>
              <Text style={styles.headerBadgeText}>{plannedCount}/14</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(plannedCount / 14) * 100}%` as any }]} />
        </View>
      </View>

      <View style={styles.body} onLayout={(e) => setBodyHeight(e.nativeEvent.layout.height)}>
        {bodyHeight > 0 && (
          <FlatList
            data={days}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            keyExtractor={(item) => item.dateStr}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setCurrentDayIdx(idx);
            }}
            renderItem={({ item, index }) => (
              <DayPage
                day={item}
                width={width}
                height={bodyHeight}
                isToday={index === 0}
                router={router}
                onClearMeal={handleClearMeal}
                onAddMeal={(dateStr, slot) => setPickerTarget({ dateStr, slot })}
              />
            )}
          />
        )}
      </View>

      <View style={styles.dots}>
        {days.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentDayIdx && styles.dotActive,
              i === 0 && styles.dotToday,
              i === 0 && i === currentDayIdx && styles.dotTodayActive,
            ]}
          />
        ))}
      </View>

      <RecipePickerModal
        visible={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        onSelect={handleSelectRecipe}
      />

      {planningRecipe && (
        <PlanningModal
          visible
          recipe={planningRecipe}
          preselect={planningPreselect ?? undefined}
          onClose={() => { setPlanningRecipe(null); setPlanningPreselect(null); }}
          onConfirm={handlePlanningConfirm}
        />
      )}

      {adjustRecipe && (
        <IngredientsAdjustModal
          visible
          recipe={adjustRecipe}
          lines={adjustLines}
          totalPeople={adjustPeople}
          onClose={() => { setPendingMealAdds([]); setAdjustRecipe(null); }}
          onAdd={handleAddToShopping}
          onNeedNothing={handleNeedNothing}
          onLinesChange={setAdjustLines}
        />
      )}

      {AlertComponent}
    </View>
  );
}

// ─── Tabs planning ────────────────────────────────────────────

const PLANNING_TABS: TabDef[] = [
  { label: 'Planning', icon: '📅', activeColor: colors.primary },
  { label: 'Recettes', icon: '📖', activeColor: colors.primary },
  { label: 'Courses', icon: '🛒', activeColor: colors.primary },
];

// ─── Écran Planning ───────────────────────────────────────────

export default function PlanningScreen() {
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  function switchTab(newTab: number) {
    if (newTab === activeTab) return;
    Animated.timing(translateX, {
      toValue: -newTab * width,
      duration: 260,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    setActiveTab(newTab);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor={colors.dark} />
      <View style={styles.container}>
        <Animated.View
          style={[styles.panelRow, { width: width * 3, transform: [{ translateX }] }]}
        >
          <PlanningPanel width={width} isFocused={activeTab === 0} focusKey={focusKey} />
          <RecipesPanel width={width} isFocused={activeTab === 1} focusKey={focusKey} />
          <CoursesPanel width={width} isFocused={activeTab === 2} focusKey={focusKey} />
        </Animated.View>
        <TabBar tabs={PLANNING_TABS} activeTab={activeTab} onSwitch={switchTab} />
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  panelRow: {
    flex: 1,
    flexDirection: 'row',
  },
  panelRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  backBtnText: {
    fontSize: 18,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.surface,
  },
  headerSub: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: spacing.xs,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  headerBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  headerBadgeText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.full,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radii.full,
  },
  body: { flex: 1 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
  },
  dotToday: {
    backgroundColor: colors.primary + '44',
  },
  dotTodayActive: {
    width: 20,
    backgroundColor: colors.primary,
  },

  // Page d'un jour
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  dayLabelBlock: { gap: 2 },
  dayMain: {
    fontSize: 36,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    lineHeight: 44,
  },
  dayMainToday: {
    color: colors.primary,
  },
  daySub: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },

  // Créneaux repas
  slotsContainer: { gap: spacing.lg },
  slot: {
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.md,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  slotIcon: { fontSize: 18 },
  peopleBadge: {
    marginLeft: 'auto',
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  slotLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },

  // Recette assignée
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recipeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.md + 2,
    paddingLeft: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recipeCardBody: { flex: 1 },
  recipeTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  recipeMeta: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recipeChevron: {
    fontSize: 24,
    color: colors.textSecondary,
    lineHeight: 28,
  },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: typography.fontWeights.bold,
  },

  // Accompagnements
  sideSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sideLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sideCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideTitleText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
  },
  addSideBtn: {
    paddingVertical: spacing.sm,
  },

  // Bouton ajout vide
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    borderStyle: 'dashed',
  },
  addSlotIcon: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  addSlotText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
});

// ─── Styles modale picker ─────────────────────────────────────

const picker = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.display,
    color: colors.surface,
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
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    fontSize: typography.fontSizes.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    ...shadows.sm,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
  filterTextActive: {
    color: colors.surface,
  },
  list: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xxxxl,
    color: colors.textSecondary,
    fontSize: typography.fontSizes.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.md,
  },
  emojiBox: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiText: {
    fontSize: 26,
  },
  itemBody: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemMeta: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  itemHits: {
    marginTop: spacing.xs,
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  itemMetaSep: {
    fontSize: typography.fontSizes.sm,
    color: colors.border,
  },
  itemMetaCook: {
    color: '#E53E3E',
  },
  badge: {
    alignSelf: 'flex-start',
  },
});
