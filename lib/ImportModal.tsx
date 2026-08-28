import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { importRecipes } from './database';
import { colors, typography, spacing, radii, shadows } from './theme';

// ─── Types ────────────────────────────────────────────────────

type Step =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; count: number }
  | { kind: 'error'; message: string };

const AI_PROMPT = `Tu es un assistant qui convertit des recettes en JSON pour une application de cuisine.

Génère un tableau JSON en respectant exactement ce format :

[
  {
    "title": "Nom de la recette",
    "category": "Plat",
    "prep_time": 30,
    "cook_time": 20,
    "description": "Courte description en 1-2 phrases.",
    "tags": ["végétarien", "rapide"],
    "ingredients": [
      { "qty": 200, "unit": "g", "name": "farine" },
      { "qty": 1000, "unit": "ml", "name": "eau" },
      { "qty": 2, "unit": "unités", "name": "œufs" },
      { "qty": 1, "unit": "c. à café", "name": "cumin en poudre" },
      { "qty": 2, "unit": "c. à soupe", "name": "huile d'olive" }
    ],
    "steps": [
      {
        "label": "Nom de l'étape",
        "instruction": "Description détaillée. Si vous n'utilisez qu'une partie d'un ingrédient, indiquez la fraction (ex: la moitié de l'eau, 1/3 de la farine).",
        "duration": 10,
        "type": "prep"
      }
    ]
  }
]

Règles générales :
- "category" : uniquement "Plat", "Entrée" ou "Dessert"
- "prep_time" : somme des durées des étapes de type "prep" uniquement (0 si aucune)
- "cook_time" : somme des durées des étapes de type "cook" uniquement (0 si aucune)
- "type" dans les steps : "prep" (préparation active), "cook" (cuisson active), "wait" (attente/four/frigo), "rest" (repos après cuisson)
- "tags" : tableau de mots-clés parmi : végétarien, vegan, carnivore, poisson, volaille, sandwich, soupe, salade, pâtes, riz, rapide, batch-cooking, sans-gluten, épicé, doux, enfants, light, fait-maison — 1 à 5 tags max
- Les quantités d'ingrédients doivent être pour 1 personne uniquement
- Ne pas inclure d'accompagnement dans la recette (pas de "servir avec...", "accompagner de…", etc.) — la recette doit être autonome et complète en elle-même

Règles pour les ingrédients :
- Chaque ingrédient est un objet { "qty", "unit", "name" }
- "name" : nom seul, sans quantité ni unité
- "qty" : nombre (entier ou décimal), ou null si pas de quantité mesurable
- "unit" : UNIQUEMENT une de ces valeurs, choisie selon le type d'ingrédient :
  → Tout ce qui se pèse (farine, légumes, viande, fromage, pâtes, riz…) : TOUJOURS "g", jamais "kg"
    Convertis systématiquement : 1 kg de farine → { "qty": 1000, "unit": "g" }, 1,5 kg → 1500
  → Tout ce qui se mesure en liquide (eau, lait, crème, huile en grande quantité…) : TOUJOURS "ml", jamais "cl" ni "L"
    Convertis systématiquement : 1 L d'eau → { "qty": 1000, "unit": "ml" }, 20 cl de crème → 200
  → Achetables à la pièce (œufs, citrons, oignons…) : "unité" (singulier) ou "unités" (pluriel)
  → Épices et condiments (achetés en flacon) : garder la mesure recette ("c. à café", "c. à soupe", "pincée") — l'app les affichera sans quantité dans la liste de courses
- N'invente pas d'autre unité : pas de "gousse", "botte", "tranche", "sachet", "boîte", "verre". Convertis en g, en ml, ou en unités.
  Exemples : 2 gousses d'ail → { "qty": 2, "unit": "unités", "name": "gousse d'ail" } ; 1 botte de persil → { "qty": 30, "unit": "g", "name": "persil" }
- "name" doit rester constant d'une recette à l'autre pour un même produit : nom simple et au singulier, sans qualificatif de taille ni de préparation
  Écris "courgette", pas "courgettes moyennes" ni "courgette émincée" — l'app additionne les quantités des ingrédients portant le même nom
- NE PAS inclure sel, poivre, et condiments toujours présents en cuisine — ils sont sous-entendus

Règles pour les étapes (steps) :
- Si une quantité d'ingrédient est répartie sur plusieurs étapes, utiliser des fractions dans les instructions au lieu de valeurs absolues
  Exemple : recette avec 1L d'eau utilisé en deux fois → étape 1 : "versez la moitié de l'eau", étape 2 : "ajoutez le reste de l'eau"
  Autres exemples de fractions : "1/3 de la farine", "les 2/3 restants", "la moitié du lait"
- Génère uniquement le JSON brut, sans texte autour

Voici la ou les recettes à convertir :
[COLLE ICI TA RECETTE]`;

// ─── Composant ────────────────────────────────────────────────

interface ImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ImportModal({ visible, onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [promptCopied, setPromptCopied] = useState(false);

  async function handleCopyPrompt() {
    await Clipboard.setStringAsync(AI_PROMPT);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  function reset() {
    setStep({ kind: 'idle' });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleClipboard() {
    setStep({ kind: 'loading' });
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        setStep({ kind: 'error', message: 'Le presse-papier est vide.' });
        return;
      }
      const result = importRecipes(text);
      if (result.imported === 0) {
        const msg = result.errors.length > 0
          ? result.errors.join('\n')
          : 'Aucune recette valide trouvée.';
        setStep({ kind: 'error', message: msg });
      } else {
        setStep({ kind: 'success', count: result.imported });
        onImported();
      }
    } catch (e: unknown) {
      setStep({ kind: 'error', message: String(e) });
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.card}>

            {/* En-tête */}
            <View style={s.header}>
              <Text style={s.title}>Importer des recettes</Text>
              <Text style={s.subtitle}>
                Collez un JSON généré par l'IA ou choisissez un fichier depuis votre appareil.
              </Text>
            </View>

            {/* Contenu selon l'étape */}
            {step.kind === 'idle' && (
              <View style={s.actions}>
                {/* Copier le prompt IA */}
                <TouchableOpacity
                  style={[s.promptBtn, promptCopied && s.promptBtnCopied]}
                  onPress={handleCopyPrompt}
                  activeOpacity={0.75}
                >
                  <Text style={s.promptIcon}>{promptCopied ? '✅' : '🤖'}</Text>
                  <View style={s.promptBody}>
                    <Text style={[s.promptTitle, promptCopied && s.promptTitleCopied]}>
                      {promptCopied ? 'Prompt copié !' : 'Copier le prompt IA'}
                    </Text>
                    <Text style={s.promptDesc}>
                      Collez-le dans ChatGPT, Claude… avec votre recette
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={s.separator} />

                <TouchableOpacity style={s.actionBtn} onPress={handleClipboard} activeOpacity={0.75}>
                  <Text style={s.actionIcon}>📋</Text>
                  <View>
                    <Text style={s.actionTitle}>Depuis le presse-papier</Text>
                    <Text style={s.actionDesc}>Copiez le JSON depuis l'IA puis importez</Text>
                  </View>
                </TouchableOpacity>

              </View>
            )}

            {step.kind === 'loading' && (
              <View style={s.feedback}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.feedbackText}>Import en cours…</Text>
              </View>
            )}

            {step.kind === 'success' && (
              <View style={s.feedback}>
                <Text style={s.feedbackIcon}>✅</Text>
                <Text style={s.feedbackTitle}>
                  {step.count} recette{step.count > 1 ? 's' : ''} importée{step.count > 1 ? 's' : ''} !
                </Text>
                <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={s.closeBtnText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}

            {step.kind === 'error' && (
              <View style={s.feedback}>
                <Text style={s.feedbackIcon}>❌</Text>
                <Text style={s.feedbackTitle}>Erreur</Text>
                <Text style={s.feedbackError}>{step.message}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={reset} activeOpacity={0.8}>
                  <Text style={s.retryBtnText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Annuler (sauf sur success/loading) */}
            {(step.kind === 'idle' || step.kind === 'error') && (
              <>
                <View style={s.divider} />
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={s.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.extraBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.relaxed,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  promptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  promptBtnCopied: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  promptIcon: {
    fontSize: 26,
    width: 36,
    textAlign: 'center',
  },
  promptBody: {
    flex: 1,
  },
  promptTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.primary,
  },
  promptTitleCopied: {
    color: '#2E7D32',
  },
  promptDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
  },
  actionIcon: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  actionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semiBold,
    color: colors.textPrimary,
  },
  actionDesc: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  feedback: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  feedbackIcon: {
    fontSize: 40,
  },
  feedbackTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  feedbackText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  feedbackError: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.relaxed,
  },
  closeBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
  },
  closeBtnText: {
    color: colors.surface,
    fontWeight: typography.fontWeights.bold,
    fontSize: typography.fontSizes.md,
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeights.semiBold,
    fontSize: typography.fontSizes.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  cancelBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: typography.fontWeights.medium,
  },
});
