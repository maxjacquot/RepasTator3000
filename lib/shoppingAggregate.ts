import type { ShoppingItem } from './types';

// ─── Normalisation texte ──────────────────────────────────────
// Table explicite plutôt que String.normalize(), pas garanti sur Hermes.

const ACCENTS: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y', œ: 'oe', æ: 'ae',
};

export function normalizeText(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) out += ACCENTS[ch] ?? ch;
  return out;
}

/** Clé de regroupement : accents, pluriel et ponctuation gommés */
function ingredientKey(label: string): string {
  const base = normalizeText(label).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return base.endsWith('s') && base.length > 3 ? base.slice(0, -1) : base;
}

// ─── Unités ───────────────────────────────────────────────────

export type Dimension = 'mass' | 'volume' | 'count';

/** factor = conversion vers l'unité de base de la dimension (g, ml, pièce) */
const UNITS: Record<string, { dim: Dimension; factor: number }> = {
  mg: { dim: 'mass', factor: 0.001 },
  g: { dim: 'mass', factor: 1 },
  gr: { dim: 'mass', factor: 1 },
  gramme: { dim: 'mass', factor: 1 },
  grammes: { dim: 'mass', factor: 1 },
  kg: { dim: 'mass', factor: 1000 },
  kilo: { dim: 'mass', factor: 1000 },
  kilos: { dim: 'mass', factor: 1000 },
  ml: { dim: 'volume', factor: 1 },
  cl: { dim: 'volume', factor: 10 },
  dl: { dim: 'volume', factor: 100 },
  l: { dim: 'volume', factor: 1000 },
  litre: { dim: 'volume', factor: 1000 },
  litres: { dim: 'volume', factor: 1000 },
  unite: { dim: 'count', factor: 1 },
  unites: { dim: 'count', factor: 1 },
  piece: { dim: 'count', factor: 1 },
  pieces: { dim: 'count', factor: 1 },
};

export type ParsedLine = {
  /** Quantité exprimée dans l'unité de base de la dimension */
  base: number | null;
  dim: Dimension;
  /** Nom seul, quantité et unité retirées */
  label: string;
};

/** "400 g courgettes" → { base: 400, dim: 'mass', label: 'courgettes' } */
export function parseShoppingLine(name: string): ParsedLine {
  const raw = name.trim();
  const m = raw.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);
  if (!m) return { base: null, dim: 'count', label: raw };

  const qty = parseFloat(m[1].replace(',', '.'));
  const rest = m[2].trim();
  const words = rest.split(/\s+/);
  const unit = words.length > 1 ? UNITS[normalizeText(words[0])] : undefined;

  if (unit) {
    return { base: qty * unit.factor, dim: unit.dim, label: words.slice(1).join(' ') };
  }
  return { base: qty, dim: 'count', label: rest };
}

// ─── Formatage ────────────────────────────────────────────────

function formatNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return (Number.isInteger(rounded) ? String(rounded) : String(rounded)).replace('.', ',');
}

/** 16000 g → "16 kg", 1500 ml → "1,5 L", 3 → "3" */
export function formatAmount(base: number, dim: Dimension): string {
  if (dim === 'mass') {
    return base >= 1000 ? `${formatNumber(base / 1000)} kg` : `${formatNumber(base)} g`;
  }
  if (dim === 'volume') {
    return base >= 1000 ? `${formatNumber(base / 1000)} L` : `${formatNumber(base)} ml`;
  }
  return formatNumber(base);
}

// ─── Agrégation ───────────────────────────────────────────────

export type ShoppingRow = {
  key: string;
  /** Nom affiché, première lettre en majuscule */
  label: string;
  /** Total formaté, null si la ligne n'a pas de quantité chiffrée */
  amount: string | null;
  /** Tous les articles fusionnés dans cette ligne */
  ids: number[];
  /** Recettes d'origine, sans doublon */
  sources: string[];
  /** Vrai si tous les articles fusionnés sont cochés */
  done: boolean;
};

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * Fusionne les articles portant le même ingrédient et additionne leurs
 * quantités. Deux dimensions différentes (300 g / 2 pièces) restent séparées.
 */
export function aggregateShoppingItems(items: ShoppingItem[]): ShoppingRow[] {
  type Acc = {
    key: string;
    label: string;
    dim: Dimension;
    total: number | null;
    ids: number[];
    sources: string[];
    done: boolean;
  };
  const map = new Map<string, Acc>();

  for (const item of items) {
    const parsed = parseShoppingLine(item.name);
    const key = `${ingredientKey(parsed.label)}|${parsed.base === null ? 'none' : parsed.dim}`;
    const existing = map.get(key);
    if (existing) {
      existing.total = existing.total === null || parsed.base === null
        ? existing.total
        : existing.total + parsed.base;
      existing.ids.push(item.id);
      existing.done = existing.done && item.done === 1;
      if (item.recipe_name && !existing.sources.includes(item.recipe_name)) {
        existing.sources.push(item.recipe_name);
      }
    } else {
      map.set(key, {
        key,
        label: capitalize(parsed.label),
        dim: parsed.dim,
        total: parsed.base,
        ids: [item.id],
        sources: item.recipe_name ? [item.recipe_name] : [],
        done: item.done === 1,
      });
    }
  }

  return Array.from(map.values()).map((acc) => ({
    key: acc.key,
    label: acc.label,
    amount: acc.total === null ? null : formatAmount(acc.total, acc.dim),
    ids: acc.ids,
    sources: acc.sources,
    done: acc.done,
  }));
}
