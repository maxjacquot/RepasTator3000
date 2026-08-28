import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getShoppingList,
  setShoppingItemsDone,
  clearShoppingList,
  deleteShoppingItemsByIds,
  addToShoppingList,
} from '../database';
import type { ShoppingItem } from '../database';
import { colors, fonts, typography, spacing, radii, shadows } from '../theme';
import { useAppAlert } from '../AppAlert';
import { aggregateShoppingItems, type ShoppingRow } from '../shoppingAggregate';

// ─── Rayons supermarché ───────────────────────────────────────

const RAYONS: { label: string; emoji: string; keywords: string[] }[] = [
  // ── Alimentaire ──────────────────────────────────────────────
  {
    label: 'Fruits & Légumes',
    emoji: '🥦',
    keywords: [
      'tomate', 'oignon', 'échalote', 'ail', 'carotte', 'poireau', 'courgette', 'champignon',
      'poivron', 'aubergine', 'brocoli', 'épinard', 'chou', 'céleri', 'artichaut', 'asperge',
      'betterave', 'concombre', 'fenouil', 'navet', 'radis', 'patate douce', 'pomme de terre',
      'potiron', 'potimarron', 'butternut', 'courge', 'maïs', 'petit pois', 'endive', 'laitue',
      'roquette', 'mâche', 'avocat', 'haricot vert', 'pois chiche', 'fève',
      'persil', 'basilic', 'ciboulette', 'menthe',
      'pomme', 'poire', 'banane', 'fraise', 'framboise', 'cerise', 'abricot', 'pêche', 'prune',
      'raisin', 'orange', 'citron', 'ananas', 'mangue', 'kiwi', 'melon', 'figue', 'myrtille',
      'fruit', 'légume', 'salade',
    ],
  },
  {
    label: 'Viandes',
    emoji: '🥩',
    keywords: ['poulet', 'guanciale', 'viande', 'bœuf', 'porc', 'lardon', 'jambon', 'veau', 'agneau', 'canard', 'dinde', 'saucisse', 'merguez', 'chorizo', 'steak', 'escalope', 'côtelette'],
  },
  {
    label: 'Poissons & Fruits de mer',
    emoji: '🐟',
    keywords: ['thon', 'anchois', 'poisson', 'saumon', 'crevette', 'merlan', 'cabillaud', 'moule', 'calmar', 'seiche', 'dorade', 'bar', 'lieu', 'sardine', 'maquereau', 'homard', 'crabe', 'langoustine'],
  },
  {
    label: 'Produits laitiers',
    emoji: '🧀',
    keywords: ['beurre', 'crème', 'œuf', 'oeuf', 'gruyère', 'pecorino', 'fromage', 'lait', 'yaourt', 'parmesan', 'mozzarella', 'ricotta', 'comté', 'emmental', 'gouda', 'camembert', 'brie', 'roquefort', 'feta', 'cottage', 'mascarpone', 'crème fraîche'],
  },
  {
    label: 'Boulangerie',
    emoji: '🥖',
    keywords: ['baguette', 'pain', 'brioche', 'croissant', 'pain de mie', 'bagel', 'wrap', 'tortilla'],
  },
  {
    label: 'Épicerie',
    emoji: '🌾',
    keywords: ['pâte', 'farine', 'sucre', 'sel', 'poivre', 'huile', 'vinaigre', 'bouillon', 'cassonade', 'moutarde', 'sauce', 'riz', 'lentille', 'fécule', 'levure', 'chocolat', 'miel', 'confiture', 'biscuit', 'céréale', 'granola', 'muesli', 'chips', 'crackers'],
  },
  {
    label: 'Épices',
    emoji: '🌶️',
    keywords: [
      'cumin', 'curcuma', 'curry', 'paprika', 'cannelle', 'vanille', 'cardamome', 'coriandre',
      'gingembre', 'piment', 'safran', 'muscade', 'anis', 'clou de girofle', 'fenugrec',
      'thym', 'romarin', 'laurier', 'origan', 'sauge', 'estragon', 'aneth', 'herbe de provence',
    ],
  },
  {
    label: 'Cuisine du monde',
    emoji: '🌍',
    keywords: [
      'soja', 'nuoc mam', 'miso', 'hoisin', 'teriyaki', 'oyster', 'sriracha', 'sambal',
      'mirin', 'saké', 'vinaigre de riz', 'huile de sésame', 'pâte de curry', 'wasabi', 'tahini',
      'nouille', 'vermicelle de riz', 'soba', 'udon', 'ramen', 'galette de riz', 'feuille de riz',
      'lait de coco', 'crème de coco', 'pâte de tamarin', 'tofu',
      'tortillas', 'nachos', 'jalapeño', 'guacamole', 'salsa', 'haricot noir', 'haricot rouge',
      'houmous', 'pita', 'chapati', 'naan', 'semoule', 'couscous', 'boulgour',
      'kimchi', 'tempeh', 'edamame',
    ],
  },
  {
    label: 'Boissons',
    emoji: '🍷',
    keywords: ['vin', 'jus', 'eau', 'bière', 'cidre', 'soda', 'cola', 'limonade', 'sirop', 'thé', 'café', 'infusion', 'kombucha', 'smoothie'],
  },
  // ── Non-alimentaire ──────────────────────────────────────────
  {
    label: 'Hygiène & Beauté',
    emoji: '🧴',
    keywords: [
      // Cheveux
      'shampoing', 'après-shampoing', 'démêlant', 'masque capillaire', 'gel coiffant', 'laque',
      // Corps & visage
      'savon', 'gel douche', 'bain moussant', 'gant de toilette', 'serviette', 'loofah',
      'crème hydratante', 'lotion corps', 'beurre corporel', 'huile corps',
      // Soins visage
      'nettoyant visage', 'tonique', 'sérum', 'crème visage', 'contour des yeux', 'masque visage', 'gommage',
      // Solaire
      'crème solaire', 'après-soleil', 'autobronzant',
      // Maquillage
      'fond de teint', 'bb crème', 'correcteur', 'mascara', 'eye-liner', 'rouge à lèvres', 'gloss',
      'fard à paupières', 'blush', 'poudre', 'highlighter', 'démaquillant', 'dissolvant',
      // Dentaire
      'dentifrice', 'brosse à dent', 'brosse à dents', 'fil dentaire', 'bain de bouche', 'blanchiment',
      // Déodorant / rasage
      'déodorant', 'anti-transpirant', 'rasoir', 'mousse à raser', 'gel à raser', 'après-rasage',
      'épilateur', 'cire', 'lame',
      // Coton & divers
      'coton', 'coton-tige', 'lingette', 'mouchoir', 'kleenex',
      // Féminin
      'serviette hygiénique', 'tampon', 'cup menstruelle', 'protège-slip',
      // Parfum
      'parfum', 'eau de toilette', 'déodorant',
    ],
  },
  {
    label: 'Entretien maison',
    emoji: '🧹',
    keywords: [
      // Lessive
      'lessive', 'assouplissant', 'détachant', 'filet de lavage',
      // Vaisselle
      'liquide vaisselle', 'pastille lave-vaisselle', 'sel lave-vaisselle', 'rinçage lave-vaisselle',
      // Nettoyage
      'nettoyant', 'désinfectant', 'javel', 'eau de javel', 'détartrant', 'anticalcaire',
      'nettoyant WC', 'nettoyant salle de bain', 'nettoyant cuisine', 'dégraissant',
      'nettoyant sol', 'cire parquet',
      // Outils ménagers
      'éponge', 'gratte-éponge', 'lavette', 'chiffon microfibre', 'brosse', 'balai',
      'serpillière', 'balai vapeur', 'pelle', 'raclette', 'aspirateur',
      // Sacs & emballages
      'sac poubelle', 'sac plastique', 'sac congélation', 'film plastique', 'papier aluminium',
      'papier cuisson', 'boîte hermétique',
      // Papier ménager
      'papier essuie-tout', 'sopalin', 'papier toilette', 'papier hygiénique',
      // Piles & éclairage
      'pile', 'ampoule', 'led',
      // Divers maison
      'allumette', 'bougie', 'diffuseur', 'désodorisant', 'anti-mite', 'anti-moustique',
      'ruban adhésif', 'scotch', 'colle',
    ],
  },
  {
    label: 'Animalerie',
    emoji: '🐾',
    keywords: [
      'croquette', 'pâtée', 'nourriture chat', 'nourriture chien', 'nourriture poisson',
      'litière', 'litière chat', 'jouet chat', 'jouet chien',
      'laisse', 'collier', 'harnais', 'cage', 'aquarium',
      'antiparasitaire', 'pipette', 'vermifuge',
    ],
  },
  {
    label: 'Bébé',
    emoji: '👶',
    keywords: [
      'couche', 'couches', 'culotte apprentissage', 'lingette bébé',
      'lait infantile', 'lait maternisé', 'petit pot', 'compote bébé',
      'biberon', 'tétine', 'sucette', 'tire-lait',
      'crème bébé', 'liniment', 'talc bébé', 'gel de dentition',
      'baignoire bébé', 'thermomètre bain',
    ],
  },
  {
    label: 'Pharmacie & Santé',
    emoji: '💊',
    keywords: [
      'doliprane', 'paracétamol', 'ibuprofène', 'aspirine', 'antidouleur',
      'sirop', 'pastille gorge', 'spray nasal', 'collyre',
      'pansement', 'bandage', 'compresse', 'sparadrap', 'antiseptique',
      'thermomètre', 'tensiomètre',
      'vitamine', 'complément alimentaire', 'magnésium', 'oméga',
      'probiotique', 'antiacide', 'laxatif', 'antidiarrhéique',
      'crème anti-démangeaison', 'crème chauffante',
      'préservatif', 'test de grossesse',
    ],
  },
  {
    label: 'Papeterie & Bureau',
    emoji: '📝',
    keywords: [
      'stylo', 'crayon', 'feutre', 'marqueur', 'surligneur',
      'cahier', 'bloc-notes', 'carnet', 'agenda', 'post-it',
      'enveloppe', 'timbre', 'papier', 'feuille',
      'ciseaux', 'règle', 'agrafeuse', 'trombone',
      'cartouche encre', 'toner',
    ],
  },
];

const RAYON_AUTRE = { label: 'Autres', emoji: '🛒' };

function getRayon(name: string): string {
  const lower = name.toLowerCase();
  const isFresh = lower.includes('fraîch') || lower.includes('frais');
  for (const rayon of RAYONS) {
    if (rayon.keywords.some((kw) => lower.includes(kw))) {
      if (isFresh && rayon.label === 'Épices') return 'Fruits & Légumes';
      return rayon.label;
    }
  }
  return RAYON_AUTRE.label;
}

// ─── Groupement ───────────────────────────────────────────────

type Group = { title: string; emoji: string; rows: ShoppingRow[] };

/** Par recette : le détail reste lisible recette par recette */
function groupByRecipe(items: ShoppingItem[]): Group[] {
  const map = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const key = item.recipe_name || 'Autre';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([title, groupItems]) => ({
    title,
    emoji: '🍽️',
    rows: aggregateShoppingItems(groupItems),
  }));
}

/** Par rayon : les mêmes ingrédients issus de recettes différentes sont totalisés */
function groupByRayon(items: ShoppingItem[]): Group[] {
  const map = new Map<string, ShoppingRow[]>();
  for (const row of aggregateShoppingItems(items)) {
    const key = getRayon(row.label);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const ordered: Group[] = [];
  for (const rayon of RAYONS) {
    if (map.has(rayon.label)) {
      ordered.push({ title: rayon.label, emoji: rayon.emoji, rows: map.get(rayon.label)! });
    }
  }
  if (map.has(RAYON_AUTRE.label)) {
    ordered.push({ title: RAYON_AUTRE.label, emoji: RAYON_AUTRE.emoji, rows: map.get(RAYON_AUTRE.label)! });
  }
  return ordered;
}

// ─── Panneau Courses ──────────────────────────────────────────

type ViewMode = 'recette' | 'rayon';

interface CoursesPanelProps {
  width: number;
  isFocused: boolean;
  focusKey: number;
}

export function CoursesPanel({ width, isFocused, focusKey }: CoursesPanelProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('recette');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItem, setNewItem] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { showAlert, AlertComponent } = useAppAlert();

  useEffect(() => {
    if (isFocused) setItems(getShoppingList());
  }, [isFocused, focusKey]);

  function handleToggle(row: ShoppingRow) {
    setShoppingItemsDone(row.ids, !row.done);
    setItems(getShoppingList());
  }

  function handleAddItem() {
    const name = newItem.trim();
    if (!name) return;
    addToShoppingList([{ name, recipe_name: '' }]);
    setItems(getShoppingList());
    setNewItem('');
    setAddModalVisible(false);
  }

  function handleClearAll() {
    showAlert({
      title: 'Vider la liste ?',
      message: 'Tous les articles de ta liste de courses vont être supprimés.',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider la liste',
          style: 'destructive',
          onPress: () => {
            clearShoppingList();
            setItems([]);
          },
        },
      ],
    });
  }

  function handleDeleteGroup(rows: ShoppingRow[]) {
    deleteShoppingItemsByIds(rows.flatMap((r) => r.ids));
    setItems(getShoppingList());
  }

  const groups = viewMode === 'recette' ? groupByRecipe(items) : groupByRayon(items);
  const doneCount = items.filter((i) => i.done === 1).length;

  return (
    <View style={[s.root, { width }]} pointerEvents={isFocused ? 'auto' : 'none'}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.xl }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>🛒 Courses</Text>
            {items.length > 0 && (
              <Text style={s.headerSub}>{doneCount}/{items.length} dans le panier</Text>
            )}
          </View>
          {items.length > 0 && (
            <TouchableOpacity style={s.clearBtn} onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={s.clearBtnText}>✓ J'ai fait les courses</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length > 0 && (
          <View style={s.toggle}>
            <TouchableOpacity
              style={[s.toggleBtn, viewMode === 'recette' && s.toggleBtnActive]}
              onPress={() => setViewMode('recette')}
              activeOpacity={0.8}
            >
              <Text style={[s.toggleText, viewMode === 'recette' && s.toggleTextActive]}>
                Par recette
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, viewMode === 'rayon' && s.toggleBtnActive]}
              onPress={() => setViewMode('rayon')}
              activeOpacity={0.8}
            >
              <Text style={[s.toggleText, viewMode === 'rayon' && s.toggleTextActive]}>
                Par rayon
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Liste */}
      {items.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🛍️</Text>
          <Text style={s.emptyTitle}>Liste vide</Text>
          <Text style={s.emptySub}>
            Ouvre une recette et appuie sur{'\n'}"Ajouter au planning"
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.title}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => {
            const allDone = group.rows.every((r) => r.done);
            return (
              <View style={[s.group, allDone && s.groupDone]}>
                <View style={s.groupHeader}>
                  <Text style={s.groupEmoji}>{group.emoji}</Text>
                  <Text style={s.groupTitle}>{group.title}</Text>
                  {allDone ? (
                    <TouchableOpacity
                      style={s.groupDeleteBtn}
                      onPress={() => handleDeleteGroup(group.rows)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.groupDeleteText}>Supprimer</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={s.groupCount}>{group.rows.length}</Text>
                  )}
                </View>

                <View style={s.groupItems}>
                  {group.rows.map((row) => (
                    <TouchableOpacity
                      key={row.key}
                      style={s.item}
                      onPress={() => handleToggle(row)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.checkbox, row.done && s.checkboxDone]}>
                        {row.done && <Text style={s.checkmark}>✓</Text>}
                      </View>
                      <View style={s.itemBody}>
                        <Text style={[s.itemName, row.done && s.itemNameDone]}>
                          {row.label}
                        </Text>
                        {viewMode === 'rayon' && row.sources.length > 0 ? (
                          <Text style={s.itemRecipe} numberOfLines={1}>
                            {row.sources.join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {row.amount ? (
                        <Text style={[s.itemQty, row.done && s.itemQtyDone]}>{row.amount}</Text>
                      ) : row.ids.length > 1 ? (
                        <Text style={[s.itemQty, row.done && s.itemQtyDone]}>×{row.ids.length}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
      {/* Bouton Ajouter */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + spacing.xl }]}
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color={colors.surface} />
        <Text style={s.fabText}>Ajouter</Text>
      </TouchableOpacity>

      {/* Modal ajout article */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setAddModalVisible(false); setNewItem(''); }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setAddModalVisible(false); setNewItem(''); }}
          />
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Ajouter un article</Text>
            <TextInput
              ref={inputRef}
              style={s.modalInput}
              placeholder="Ex : Shampoing, Piles AA…"
              placeholderTextColor={colors.textSecondary}
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => { setAddModalVisible(false); setNewItem(''); }}
                activeOpacity={0.7}
              >
                <Text style={s.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, !newItem.trim() && s.modalConfirmBtnDisabled]}
                onPress={handleAddItem}
                activeOpacity={0.7}
                disabled={!newItem.trim()}
              >
                <Text style={s.modalConfirmText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {AlertComponent}
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
    paddingBottom: spacing.xxxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.surface,
    lineHeight: 34,
  },
  headerSub: {
    fontSize: typography.fontSizes.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  clearBtnText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.surface,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radii.full,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  toggleText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semiBold,
    color: 'rgba(255,255,255,0.7)',
  },
  toggleTextActive: { color: colors.primary },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
    marginTop: -spacing.xl,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  groupDone: { opacity: 0.75 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupEmoji: { fontSize: 16 },
  groupTitle: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupCount: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: colors.textSecondary,
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  groupDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  groupDeleteText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    color: '#DC2626',
  },
  groupItems: { paddingVertical: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    fontSize: 13,
    color: colors.surface,
    fontWeight: typography.fontWeights.bold,
  },
  itemBody: { flex: 1 },
  itemName: {
    fontSize: typography.fontSizes.md,
    color: colors.textPrimary,
  },
  itemNameDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  itemRecipe: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemQty: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.primary,
    flexShrink: 0,
  },
  itemQtyDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxxxl,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.normal,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    ...shadows.md,
  },
  fabText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
    color: colors.surface,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxxl,
    gap: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  modalCancelText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  modalConfirmBtnDisabled: {
    backgroundColor: colors.border,
  },
  modalConfirmText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.surface,
  },
});
