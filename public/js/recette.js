// Écran d'une recette : lecture (ingrédients, description, frise des étapes) et modification.
import { el, confirmer } from './ui.js';
import * as D from './donnees.js';
import { lireIngredients, lireListe, formaterQte } from './calculs.js';
import { ajouterAuPlanning } from './fenetres.js';

export const ETAPES = {
  prep: { emoji: '🔪', nom: 'Préparation' },
  cook: { emoji: '🔥', nom: 'Cuisson' },
  wait: { emoji: '❄️', nom: 'Frigo' },
  rest: { emoji: '⏸️', nom: 'Repos' },
};
const CATEGORIES = ['Entrée', 'Plat', 'Dessert'];
const classeCategorie = (c) => `cat-${(c || '').normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`;

let modification = null; // { id, brouillon } : recette en cours de modification

/** @param {{ id: number, retour: () => void, redessiner: () => void }} nav */
export function ecranRecette(nav) {
  const r = D.recette(nav.id);
  const barre = (titre, ...boutons) => el('header', { class: 'entete entete-recette' },
    el('div', { class: 'titre' },
      el('button', { type: 'button', class: 'retour', 'aria-label': 'Retour', onclick: () => { modification = null; nav.retour(); } }, '←'),
      el('span', { id: 'volet-outils' }),
      el('h1', {}, titre)),
    boutons);
  if (!r) return [barre('Recette'), el('main', { class: 'contenu' }, el('p', { class: 'vide-texte' }, 'Recette introuvable.'))];
  if (modification?.id === r.id) return ecranModification(r, nav, barre);

  const ingredients = lireIngredients(r.ingredients);
  const etapes = lireListe(r.steps);
  const tags = lireListe(r.tags);
  const total = etapes.reduce((n, e) => n + e.duration, 0);

  return [
    barre('Recette'),
    el('main', { class: 'contenu contenu-recette' },
      el('div', { class: 'badges' },
        el('span', { class: `badge-categorie ${classeCategorie(r.category)}` }, r.category),
        r.cook_time > 0
          ? [el('span', { class: 'badge-temps' }, `🔪 ${r.prep_time} min de prépa`), el('span', { class: 'badge-temps cuisson' }, `🔥 ${r.cook_time} min de cuisson`)]
          : el('span', { class: 'badge-temps' }, `⏱ ${r.prep_time} min`)),
      el('h2', { class: 'recette-titre' }, r.title),
      tags.length ? el('div', { class: 'tags' }, tags.map((t) => el('span', { class: 'tag' }, t))) : null,
      el('hr'),
      ingredients.length ? [
        el('h3', { class: 'section' }, 'Ingrédients'),
        el('ul', { class: 'ingredients' }, ingredients.map((i) => el('li', {},
          i.qty !== null ? el('b', {}, `${formaterQte(i.qty)}${i.unit ? ` ${i.unit}` : ''}`) : null, ' ', i.name))),
        el('button', { type: 'button', class: 'principal grand pleine-largeur', onclick: async () => { await ajouterAuPlanning(r); nav.redessiner(); } }, '📅  Ajouter au planning'),
        el('hr'),
      ] : null,
      el('h3', { class: 'section' }, 'Description'),
      el('p', { class: 'description' }, r.description),
      etapes.length ? [
        el('hr'),
        el('div', { class: 'etapes-tete' }, el('h3', { class: 'section' }, 'Étapes'), el('span', { class: 'badge-total' }, `⏱ ${total} min au total`)),
        el('div', { class: 'legende' }, Object.entries(ETAPES).map(([type, e]) => el('span', { class: `legende-type type-${type}` }, `${e.emoji} ${e.nom}`))),
        el('ol', { class: 'frise' }, etapes.map((e, i) => {
          const type = ETAPES[e.type] ? e.type : 'prep';
          return el('li', { class: `etape type-${type}` },
            el('span', { class: 'etape-point', 'aria-hidden': 'true' }, ETAPES[type].emoji),
            el('div', { class: 'etape-carte' },
              el('div', { class: 'etape-tete' }, el('b', {}, `Étape ${i + 1} — ${e.label}`), el('span', { class: 'etape-duree' }, `${e.duration} min`)),
              e.instruction ? el('p', {}, e.instruction) : null,
              el('div', { class: 'etape-barre' }, el('span', { style: { width: `${Math.max(15, Math.round((e.duration / (total || 1)) * 100))}%` } }))));
        })),
      ] : null,
      el('div', { class: 'actions-recette' },
        el('button', { type: 'button', class: 'clair grand pleine-largeur', onclick: () => { modification = { id: r.id, brouillon: brouillonDe(r) }; nav.redessiner(); } }, '✏️  Modifier la recette'),
        boutonSupprimer(r, nav)),
    ),
  ];
}

function boutonSupprimer(r, nav) {
  return el('button', {
    type: 'button', class: 'supprimer-recette',
    onclick: async () => {
      if (!(await confirmer({ titre: 'Supprimer la recette ?', message: `« ${r.title} » sera supprimée.`, action: 'Supprimer', danger: true }))) return;
      D.supprimerRecette(r.id);
      modification = null;
      nav.retour();
    },
  }, 'Supprimer la recette');
}

// ─── Modification ─────────────────────────────────────────────

function brouillonDe(r) {
  return {
    title: r.title,
    category: r.category,
    description: r.description,
    prep: String(r.prep_time),
    cuisson: String(r.cook_time),
    tags: lireListe(r.tags),
    ingredients: lireIngredients(r.ingredients).map((i) => ({ qte: i.qty !== null ? String(i.qty) : '', unite: i.unit, nom: i.name })),
    etapes: lireListe(r.steps).map((e) => ({ label: e.label, instruction: e.instruction, duree: String(e.duration), type: e.type })),
  };
}

function versRecette(b) {
  return {
    title: b.title.trim() || 'Sans titre',
    category: b.category,
    description: b.description.trim(),
    prep_time: parseInt(b.prep, 10) || 0,
    cook_time: parseInt(b.cuisson, 10) || 0,
    tags: JSON.stringify(b.tags),
    ingredients: JSON.stringify(b.ingredients.filter((i) => i.nom.trim()).map((i) => ({
      qty: i.qte.trim() ? parseFloat(i.qte.replace(',', '.')) : null, unit: i.unite.trim(), name: i.nom.trim(),
    }))),
    steps: JSON.stringify(b.etapes.filter((e) => e.label.trim()).map((e) => ({
      label: e.label.trim(), instruction: e.instruction.trim(), duration: parseInt(e.duree, 10) || 0, type: e.type,
    }))),
  };
}

function ecranModification(r, nav, barre) {
  const b = modification.brouillon;
  const champ = (attrs, cle, objet = b) => el(attrs.rows ? 'textarea' : 'input', { ...attrs, value: objet[cle], oninput: (ev) => { objet[cle] = ev.target.value; } });
  const enregistrer = () => {
    D.modifierRecette(r.id, versRecette(b));
    modification = null;
    nav.redessiner();
  };
  const annuler = () => { modification = null; nav.redessiner(); };

  const tags = el('div', { class: 'tags' });
  const dessinerTags = () => tags.replaceChildren(...b.tags.map((t) => el('button', {
    type: 'button', class: 'tag modifiable', 'aria-label': `Retirer le tag ${t}`,
    onclick: () => { b.tags = b.tags.filter((x) => x !== t); dessinerTags(); },
  }, t, el('span', { 'aria-hidden': 'true' }, ' ✕'))));
  dessinerTags();
  const nouveauTag = el('input', { type: 'text', placeholder: 'Ajouter un tag...', autocapitalize: 'none', enterkeyhint: 'done', 'aria-label': 'Nouveau tag' });
  const ajouterTag = () => {
    const t = nouveauTag.value.trim().toLowerCase();
    if (t && !b.tags.includes(t)) b.tags.push(t);
    nouveauTag.value = '';
    dessinerTags();
  };
  nouveauTag.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ajouterTag(); } });

  const etapes = el('div', { class: 'etapes-modif' });
  const dessinerEtapes = () => etapes.replaceChildren(...(b.etapes.length ? b.etapes.map((e, i) => el('div', { class: `etape-modif type-${ETAPES[e.type] ? e.type : 'prep'}` },
    el('div', { class: 'etape-modif-tete' },
      el('div', { class: 'types', role: 'group', 'aria-label': 'Type d\'étape' }, Object.entries(ETAPES).map(([type, t]) => el('button', {
        type: 'button', class: `type ${e.type === type ? 'actif' : ''}`, 'aria-pressed': String(e.type === type), title: t.nom,
        onclick: () => { e.type = type; dessinerEtapes(); },
      }, t.emoji, e.type === type ? ` ${t.nom}` : null))),
      el('button', { type: 'button', class: 'retirer', 'aria-label': 'Supprimer l\'étape', onclick: () => { b.etapes.splice(i, 1); dessinerEtapes(); } }, '✕')),
    el('div', { class: 'etape-modif-ligne' },
      champ({ type: 'text', placeholder: `Étape ${i + 1}`, 'aria-label': 'Nom de l\'étape' }, 'label', e),
      champ({ type: 'text', inputmode: 'numeric', class: 'duree', placeholder: '0', 'aria-label': 'Durée en minutes' }, 'duree', e),
      el('span', { class: 'unite' }, 'min')),
    champ({ rows: 3, placeholder: 'Description de l\'étape...', 'aria-label': 'Description de l\'étape' }, 'instruction', e),
  )) : [el('button', { type: 'button', class: 'ajouter-ligne', onclick: () => { b.etapes.push({ label: '', instruction: '', duree: '10', type: 'prep' }); dessinerEtapes(); } }, '+ Ajouter une étape')]));
  dessinerEtapes();

  const ingredients = el('div', { class: 'ingredients-modif' });
  const dessinerIngredients = () => ingredients.replaceChildren(...(b.ingredients.length ? b.ingredients.map((ing, i) => el('div', { class: 'ingredient-modif' },
    champ({ type: 'text', inputmode: 'decimal', class: 'qte', placeholder: 'Qté', 'aria-label': 'Quantité' }, 'qte', ing),
    champ({ type: 'text', class: 'unite', placeholder: 'unité', autocapitalize: 'none', 'aria-label': 'Unité' }, 'unite', ing),
    champ({ type: 'text', class: 'nom', placeholder: 'Ingrédient', 'aria-label': 'Ingrédient' }, 'nom', ing),
    el('button', { type: 'button', class: 'retirer', 'aria-label': 'Supprimer l\'ingrédient', onclick: () => { b.ingredients.splice(i, 1); dessinerIngredients(); } }, '✕'),
  )) : [el('button', { type: 'button', class: 'ajouter-ligne', onclick: () => { b.ingredients.push({ qte: '', unite: '', nom: '' }); dessinerIngredients(); } }, '+ Ajouter un ingrédient')]));
  dessinerIngredients();

  const categories = el('div', { class: 'categories', role: 'group', 'aria-label': 'Catégorie' });
  const dessinerCategories = () => categories.replaceChildren(...CATEGORIES.map((c) => el('button', {
    type: 'button', class: `categorie ${classeCategorie(c)} ${b.category === c ? 'actif' : ''}`, 'aria-pressed': String(b.category === c),
    onclick: () => { b.category = c; dessinerCategories(); },
  }, c)));
  dessinerCategories();

  return [
    barre('Modifier', el('button', { type: 'button', class: 'sur-entete', onclick: annuler }, 'Annuler')),
    el('main', { class: 'contenu contenu-recette modification' },
      categories,
      el('div', { class: 'temps-modif' },
        el('label', {}, '🔪 Prépa', champ({ type: 'text', inputmode: 'numeric', placeholder: '0' }, 'prep'), 'min'),
        el('label', {}, '🔥 Cuisson', champ({ type: 'text', inputmode: 'numeric', placeholder: '0' }, 'cuisson'), 'min')),
      champ({ rows: 2, class: 'titre-modif', placeholder: 'Titre de la recette', 'aria-label': 'Titre de la recette' }, 'title'),
      tags,
      el('div', { class: 'ajout-tag' }, nouveauTag, el('button', { type: 'button', class: 'clair petit', onclick: ajouterTag }, '+')),
      el('hr'),
      el('h3', { class: 'section' }, 'Description'),
      champ({ rows: 3, placeholder: 'Courte description...', 'aria-label': 'Description' }, 'description'),
      el('hr'),
      el('div', { class: 'section-tete' }, el('h3', { class: 'section' }, 'Étapes'),
        el('button', { type: 'button', class: 'discret', onclick: () => { b.etapes.push({ label: '', instruction: '', duree: '10', type: 'prep' }); dessinerEtapes(); } }, '+ Ajouter')),
      etapes,
      el('hr'),
      el('div', { class: 'section-tete' }, el('h3', { class: 'section' }, 'Ingrédients'),
        el('button', { type: 'button', class: 'discret', onclick: () => { b.ingredients.push({ qte: '', unite: '', nom: '' }); dessinerIngredients(); } }, '+ Ajouter')),
      ingredients,
      el('div', { class: 'actions-recette' }, boutonSupprimer(r, nav)),
      el('button', { type: 'button', class: 'principal grand bouton-enregistrer', onclick: enregistrer }, '✓  Enregistrer'),
    ),
  ];
}
