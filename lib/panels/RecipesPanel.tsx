import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllRecipes, type Recipe } from '../database';
import { colors, fonts, typography, spacing, radii, shadows, Badge } from '../theme';
import { ImportModal } from '../ImportModal';
import { searchRecipes } from '../recipeSearch';

// ─── Helpers ──────────────────────────────────────────────────

const CATEGORIES = ['Toutes', 'Entrée', 'Plat', 'Dessert'];

const CATEGORY_EMOJI: Record<string, string> = {
  Entrée: '🥗',
  Plat: '🍽️',
  Dessert: '🍰',
};

const EMOJI_BG: Record<string, string> = {
  Entrée: colors.successLight,
  Plat: colors.primaryLight,
  Dessert: '#F5E8FF',
};

const CATEGORY_ACCENT: Record<string, string> = {
  Entrée: colors.success,
  Plat: colors.primary,
  Dessert: '#9B59B6',
};

function getBadge(recipe: Recipe): { label: string; color: string } {
  if (recipe.prep_time <= 15) return { label: 'Rapide', color: colors.primary };
  if (recipe.category === 'Entrée') return { label: 'Sain', color: colors.success };
  return { label: 'Facile', color: colors.success };
}

// ─── Carte recette ────────────────────────────────────────────

function RecipeCard({ recipe, ingredientHits, onPress }: { recipe: Recipe; ingredientHits: string[]; onPress: () => void }) {
  const emoji = CATEGORY_EMOJI[recipe.category] ?? '🍴';
  const emojiBg = EMOJI_BG[recipe.category] ?? colors.primaryLight;
  const accent = CATEGORY_ACCENT[recipe.category] ?? colors.primary;
  const badge = getBadge(recipe);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.cardAccent, { backgroundColor: accent }]} />
      <View style={[s.emojiBox, { backgroundColor: emojiBg }]}>
        <Text style={s.emojiText}>{emoji}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={1}>{recipe.title}</Text>
        <View style={s.cardMetaRow}>
          {recipe.cook_time > 0 ? (
            <>
              <Text style={s.cardMeta}>🔪 {recipe.prep_time} min</Text>
              <Text style={s.cardMetaSep}>·</Text>
              <Text style={[s.cardMeta, s.cardMetaCook]}>🔥 {recipe.cook_time} min</Text>
            </>
          ) : (
            <Text style={s.cardMeta}>⏱ {recipe.prep_time} min</Text>
          )}
        </View>
        <Badge label={badge.label} color={badge.color} style={s.badge} />
        {ingredientHits.length > 0 && (
          <Text style={s.cardHits} numberOfLines={1}>
            🧺 contient : {ingredientHits.join(', ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Panneau Recettes ─────────────────────────────────────────

interface RecipesPanelProps {
  width: number;
  isFocused: boolean;
  focusKey: number;
}

export function RecipesPanel({ width, isFocused, focusKey }: RecipesPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toutes');
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    if (isFocused) setRecipes(getAllRecipes());
  }, [isFocused, focusKey]);

  const filtered = searchRecipes(recipes, search).filter(
    ({ recipe }) => activeCategory === 'Toutes' || recipe.category === activeCategory
  );

  return (
    <View style={[s.root, { width }]} pointerEvents={isFocused ? 'auto' : 'none'}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={s.headerTitle}>Mes recettes</Text>
        <View style={s.headerBtns}>
          <TouchableOpacity
            style={s.importBtn}
            onPress={() => setImportVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={s.importBtnText}>Importer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ImportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImported={() => {
          setImportVisible(false);
          setRecipes(getAllRecipes());
        }}
      />

      {/* Recherche */}
      <View style={s.searchContainer}>
        <TextInput
          style={s.searchInput}
          placeholder="Rechercher un plat, un ingrédient..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filtres */}
      <View style={s.filterRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[s.filterBtn, activeCategory === cat && s.filterBtnActive]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.7}
          >
            <Text style={[s.filterText, activeCategory === cat && s.filterTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.recipe.id)}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={s.emptyText}>Aucune recette trouvée.</Text>}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item.recipe}
            ingredientHits={item.ingredientHits}
            onPress={() => router.push(`/recipe/${item.recipe.id}`)}
          />
        )}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxxl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.surface,
    lineHeight: 34,
  },
  headerBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
    marginBottom: 2,
  },
  importBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
  },
  importBtnText: {
    color: colors.surface,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    letterSpacing: 0.2,
  },
  cardHits: {
    marginTop: spacing.xs,
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    fontWeight: typography.fontWeights.semiBold,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    marginTop: -spacing.xl,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    fontSize: typography.fontSizes.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    ...shadows.md,
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
    paddingTop: spacing.xs,
    paddingBottom: 80,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.xxxxl,
    color: colors.textSecondary,
    fontSize: typography.fontSizes.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingLeft: spacing.md + spacing.xs,
    gap: spacing.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  emojiBox: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiText: { fontSize: 24 },
  cardBody: { flex: 1, gap: spacing.xs },
  cardTitle: {
    fontSize: typography.fontSizes.lg,
    fontFamily: fonts.display,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardMeta: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  cardMetaSep: {
    fontSize: typography.fontSizes.sm,
    color: colors.border,
  },
  cardMetaCook: {
    color: '#E53E3E',
  },
  badge: { alignSelf: 'flex-start' },
});
