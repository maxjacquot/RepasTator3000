// Fenêtres de l'appli et enchaînements : choisir une recette, l'ajouter au planning, ajuster les
// ingrédients à acheter, importer des recettes, ajouter un article aux courses.
import { el, ouvrirFenetre, message, boutonRepete, pluriel, septJours } from './ui.js';
import * as D from './donnees.js';
import {
  chercherRecettes, lignesAAcheter, formaterQte, pas, ligneActive, texteLigne, cleArticle, additionner,
} from './calculs.js';
import { PROMPT_IA } from './import.js';

// ─── Carte d'une recette (liste des recettes et choix d'une recette) ───

export const CATEGORIES = ['Toutes', 'Entrée', 'Plat', 'Dessert'];
const EMOJI = { Entrée: '🥗', Plat: '🍽️', Dessert: '🍰' };

function etiquette(r) {
  if (r.prep_time <= 15) return { texte: 'Rapide', classe: 'accent' };
  return { texte: r.category === 'Entrée' ? 'Sain' : 'Facile', classe: 'vert' };
}

export function temps(r) {
  return r.cook_time > 0
    ? [el('span', {}, `🔪 ${r.prep_time} min`), el('span', { class: 'sep' }, '·'), el('span', { class: 'cuisson' }, `🔥 ${r.cook_time} min`)]
    : [el('span', {}, `⏱ ${r.prep_time} min`)];
}

/** Bouton-carte d'une recette. */
export function carteRecette({ recette: r, ingredientsTrouves }, onclick) {
  const e = etiquette(r);
  return el('button', { type: 'button', class: `carte-recette cat-${(r.category || '').normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()}`, onclick },
    el('span', { class: 'emoji' }, EMOJI[r.category] ?? '🍴'),
    el('span', { class: 'carte-recette-corps' },
      el('span', { class: 'carte-recette-titre' }, r.title),
      el('span', { class: 'temps' }, temps(r)),
      el('span', { class: `badge ${e.classe}` }, e.texte),
      ingredientsTrouves.length ? el('span', { class: 'trouves' }, `🧺 contient : ${ingredientsTrouves.join(', ')}`) : null,
    ),
  );
}

/** Recherche + filtres par catégorie au-dessus d'une liste de recettes. */
export function listeFiltrable(onChoisir, etat = { recherche: '', categorie: 'Toutes' }) {
  const liste = el('div', { class: 'liste-recettes' });
  const filtres = el('div', { class: 'filtres', role: 'group', 'aria-label': 'Catégorie' });
  const dessiner = () => {
    const resultats = chercherRecettes(D.toutesLesRecettes(), etat.recherche)
      .filter(({ recette }) => etat.categorie === 'Toutes' || recette.category === etat.categorie);
    liste.replaceChildren(...(resultats.length
      ? resultats.map((x) => carteRecette(x, () => onChoisir(x.recette)))
      : [el('p', { class: 'vide-texte' }, 'Aucune recette trouvée.')]));
    filtres.replaceChildren(...CATEGORIES.map((c) => el('button', {
      type: 'button',
      class: `filtre ${etat.categorie === c ? 'actif' : ''}`,
      'aria-pressed': String(etat.categorie === c),
      onclick: () => { etat.categorie = c; dessiner(); },
    }, c)));
  };
  const recherche = el('input', {
    type: 'search', class: 'recherche', placeholder: 'Rechercher un plat, un ingrédient...', value: etat.recherche,
    'aria-label': 'Rechercher une recette',
    oninput: (ev) => { etat.recherche = ev.target.value; dessiner(); },
  });
  dessiner();
  return { elements: [recherche, filtres, liste], recherche };
}

export function choisirRecette() {
  return ouvrirFenetre({ titre: 'Choisir une recette', feuille: true }, (fermer) => {
    const { elements, recherche } = listeFiltrable((r) => fermer(r));
    setTimeout(() => window.matchMedia('(pointer: fine)').matches && recherche.focus(), 50);
    return elements;
  });
}

// ─── Nombre de personnes ──────────────────────────────────────

const MIN_PERSONNES = 1;
const MAX_PERSONNES = 20;

function choixPersonnes(libelle, valeur, onChange) {
  const affichage = el('span', { class: 'personnes-valeur' });
  const moins = boutonRepete({ class: 'rond moins', 'aria-label': `${libelle} : une personne de moins` }, '−', () => changer(-1));
  const plus = boutonRepete({ class: 'rond plus', 'aria-label': `${libelle} : une personne de plus` }, '+', () => changer(1));
  const maj = () => {
    affichage.replaceChildren(`👥 ${valeur}`, el('small', {}, ' pers.'));
    moins.disabled = valeur <= MIN_PERSONNES;
    plus.disabled = valeur >= MAX_PERSONNES;
  };
  function changer(d) {
    valeur = Math.min(MAX_PERSONNES, Math.max(MIN_PERSONNES, valeur + d));
    maj();
    onChange(valeur);
  }
  maj();
  return el('div', { class: 'personnes' }, el('span', { class: 'personnes-libelle' }, libelle), el('span', { class: 'compteur' }, moins, affichage, plus));
}

// ─── Ajouter au planning ──────────────────────────────────────

const REPAS = [{ cle: 'lunch', icone: '☀️', nom: 'Midi' }, { cle: 'dinner', icone: '🌙', nom: 'Soir' }];

/**
 * Choix des créneaux des 7 prochains jours et du nombre de personnes.
 * Les retraits et changements de personnes sur un créneau déjà planifié sont faits tout de suite ;
 * les nouveaux créneaux ne sont écrits qu'après le choix des courses (voir planifierAvecCourses).
 * @returns {Promise<{ ajouts: {date, creneau, personnes}[], personnes: number } | null>}
 */
export function fenetrePlanning(recette, preselection) {
  const jours = septJours();
  const choix = {};
  const personnes = {};
  for (const { date } of jours) {
    const j = D.jour(date);
    choix[date] = { lunch: j.lunch === recette.id, dinner: j.dinner === recette.id };
    personnes[date] = { lunch: j.lunch_people, dinner: j.dinner_people };
  }
  if (preselection) choix[preselection.date][preselection.creneau] = true;

  return ouvrirFenetre({ titre: 'Ajouter au planning', sousTitre: recette.title, feuille: true }, (fermer) => {
    const liste = el('div', { class: 'jours-planning' });
    const valider = el('button', { type: 'button', class: 'principal grand pleine-largeur' });
    const total = () => Object.values(choix).reduce((n, c) => n + (c.lunch ? 1 : 0) + (c.dinner ? 1 : 0), 0);
    const majValider = () => {
      const n = total();
      valider.disabled = n === 0;
      valider.textContent = n === 0 ? 'Sélectionne un créneau' : `Confirmer (${n} créneau${n > 1 ? 'x' : ''})`;
    };
    const dessiner = () => {
      liste.replaceChildren(...jours.map(({ date, court }) => el('div', { class: 'jour-planning' },
        el('div', { class: 'jour-planning-nom' }, court),
        el('div', { class: 'creneaux' }, REPAS.map((r) => el('button', {
          type: 'button',
          class: `creneau ${choix[date][r.cle] ? 'actif' : ''}`,
          'aria-pressed': String(choix[date][r.cle]),
          onclick: () => { choix[date][r.cle] = !choix[date][r.cle]; dessiner(); },
        }, `${r.icone}  ${r.nom}`))),
        REPAS.filter((r) => choix[date][r.cle]).map((r) => choixPersonnes(`${r.icone}  ${r.nom}`, personnes[date][r.cle], (v) => { personnes[date][r.cle] = v; })),
      )));
      majValider();
    };
    valider.addEventListener('click', () => {
      const ajouts = [];
      let total = 0;
      for (const { date } of jours) {
        const j = D.jour(date);
        for (const { cle } of REPAS) {
          if (choix[date][cle]) {
            if (j[cle] !== recette.id) {
              total += personnes[date][cle];
              ajouts.push({ date, creneau: cle, personnes: personnes[date][cle] });
            } else D.changerPersonnes(date, cle, personnes[date][cle]); // déjà planifié : seulement les personnes
          } else if (j[cle] === recette.id) D.retirer(date, cle); // décoché : retiré tout de suite
        }
      }
      fermer({ ajouts, personnes: total });
    });
    dessiner();
    return [
      el('p', { class: 'aide' }, 'Sélectionne les créneaux où tu veux cuisiner cette recette, puis indique pour combien de personnes.'),
      liste,
      el('div', { class: 'pied-fenetre' }, valider),
    ];
  });
}

// ─── Ingrédients à acheter ────────────────────────────────────

/**
 * Quantités pour `personnes` (recette pour 1 personne), à ajuster avec − / +.
 * @returns {Promise<{ lignes: object[] } | 'rien' | null>} lignes à ajouter, « rien » (J'ai besoin de rien), null (fermé)
 */
export function ajusterIngredients(recette, personnes) {
  const lignes = lignesAAcheter(recette.ingredients, personnes);
  return ouvrirFenetre({ titre: 'Ingrédients à acheter', sousTitre: recette.title, feuille: true }, (fermer) => {
    const liste = el('div', { class: 'lignes-achat' });
    const ajouter = el('button', { type: 'button', class: 'principal grand pleine-largeur', onclick: () => fermer({ lignes: lignes.filter(ligneActive) }) });
    const majBouton = () => {
      const n = lignes.filter(ligneActive).length;
      ajouter.disabled = n === 0;
      ajouter.textContent = n === 0 ? 'Sélectionne au moins un ingrédient' : `Ajouter ${pluriel(n, 'ingrédient')} aux courses`;
    };
    const ligne = (l) => {
      const div = el('div', { class: 'ligne-achat' });
      const maj = () => {
        div.classList.toggle('zero', !ligneActive(l));
        div.replaceChildren(
          el('span', { class: 'ligne-achat-nom' }, l.nom),
          l.qte !== null
            ? el('span', { class: 'compteur' },
              boutonRepete({ class: 'rond moins', 'aria-label': `Moins de ${l.nom}` }, '−', (m) => changer(-m)),
              el('span', { class: 'qte' }, formaterQte(l.actuelle), l.unite ? el('small', {}, ` ${l.unite}`) : null),
              boutonRepete({ class: 'rond plus', 'aria-label': `Plus de ${l.nom}` }, '+', (m) => changer(m)))
            : el('button', {
              type: 'button', class: `coche ${l.inclus ? 'cochee' : ''}`, 'aria-pressed': String(l.inclus), 'aria-label': `Acheter : ${l.nom}`,
              onclick: () => { l.inclus = !l.inclus; maj(); majBouton(); },
            }, l.inclus ? '✓' : ''),
        );
      };
      // Pendant un appui long, on garde les mêmes boutons (sinon la répétition s'arrête) : seule la quantité change
      function changer(d) {
        l.actuelle = Math.max(0, Math.round((l.actuelle + d * pas(l.qte * personnes)) * 100) / 100);
        div.classList.toggle('zero', !ligneActive(l));
        div.querySelector('.qte').firstChild.textContent = formaterQte(l.actuelle);
        majBouton();
      }
      maj();
      return div;
    };
    liste.append(...lignes.map(ligne));
    majBouton();
    return [
      el('p', { class: 'aide' }, `Quantités calculées pour ${pluriel(personnes, 'personne')}. Ajuste si tu en as déjà à la maison — reste appuyé sur − ou + pour aller vite.`),
      liste,
      el('div', { class: 'pied-fenetre' }, ajouter, el('button', { type: 'button', class: 'discret', onclick: () => fermer('rien') }, "J'ai besoin de rien")),
    ];
  });
}

/** Ajoute les lignes aux courses (en additionnant à un article encore à acheter de la même recette). */
function ajouterIngredients(recette, lignes) {
  const existants = D.listeDeCourses().filter((a) => a.recipe_name === recette.title && a.done === 0);
  const nouveaux = [];
  for (const l of lignes) {
    const texte = texteLigne(l);
    const deja = existants.find((a) => cleArticle(a.name) === l.nom.toLowerCase().trim());
    if (deja) D.renommerArticle(deja.id, additionner(deja.name, texte));
    else nouveaux.push({ name: texte, recipe_name: recette.title });
  }
  if (nouveaux.length) D.ajouterAuxCourses(nouveaux);
}

/**
 * Après le choix des créneaux : ingrédients à acheter, puis écriture du planning (seulement si on n'a pas
 * fermé la fenêtre des ingrédients) et des courses.
 */
export async function planifierAvecCourses(recette, ajouts, personnes) {
  if (!ajouts.length) return false;
  const r = personnes > 0 ? await ajusterIngredients(recette, personnes) : 'rien';
  if (r === null) return false; // fenêtre fermée : rien n'est planifié
  for (const a of ajouts) D.planifier(a.date, a.creneau, recette.id, a.personnes);
  if (r !== 'rien') {
    ajouterIngredients(recette, r.lignes);
    await message({ titre: 'Courses mises à jour !', message: `${pluriel(r.lignes.length, 'ingrédient')} ajouté${r.lignes.length > 1 ? 's' : ''} à ta liste de courses.` });
  }
  return true;
}

/** Depuis la fiche d'une recette, ou un créneau vide du planning (preselection). */
export async function ajouterAuPlanning(recette, preselection) {
  const r = await fenetrePlanning(recette, preselection);
  if (!r) return false;
  await planifierAvecCourses(recette, r.ajouts, r.personnes);
  return true;
}

// ─── Importer des recettes ────────────────────────────────────

export function fenetreImport() {
  return ouvrirFenetre({ titre: 'Importer des recettes', sousTitre: "Collez le JSON généré par l'IA, ou choisissez un fichier." }, (fermer) => {
    const zone = el('textarea', { class: 'zone-import', rows: 7, placeholder: '[ { "title": "…", "category": "Plat", … } ]', 'aria-label': 'JSON des recettes' });
    const retour = el('div', { 'aria-live': 'polite' });
    const importer = (texte) => {
      if (!texte.trim()) return retour.replaceChildren(el('p', { class: 'alerte erreur' }, 'Rien à importer : collez le JSON des recettes.'));
      const { importees, erreurs } = D.importerRecettes(texte);
      if (importees === 0) {
        return retour.replaceChildren(el('div', { class: 'alerte erreur' }, el('b', {}, 'Erreur'), el('p', { class: 'pre' }, erreurs.length ? erreurs.join('\n') : 'Aucune recette valide trouvée.')));
      }
      fermer({ importees, erreurs });
    };
    const copier = el('button', {
      type: 'button', class: 'bouton-ia',
      onclick: async () => {
        await navigator.clipboard.writeText(PROMPT_IA);
        copier.querySelector('b').textContent = 'Prompt copié !';
        copier.querySelector('.emoji').textContent = '✅';
        setTimeout(() => {
          copier.querySelector('b').textContent = 'Copier le prompt IA';
          copier.querySelector('.emoji').textContent = '🤖';
        }, 2000);
      },
    }, el('span', { class: 'emoji' }, '🤖'), el('span', {}, el('b', {}, 'Copier le prompt IA'), el('small', {}, 'Collez-le dans ChatGPT, Claude… avec votre recette')));
    const fichier = el('input', {
      type: 'file', accept: '.json,application/json,text/plain', hidden: true,
      onchange: async (ev) => { const f = ev.target.files[0]; if (f) zone.value = await f.text(); },
    });
    const peutColler = !!navigator.clipboard?.readText;
    return [
      copier,
      el('label', { class: 'titre-champ' }, 'JSON des recettes', zone),
      el('div', { class: 'actions' },
        peutColler ? el('button', {
          type: 'button', class: 'clair',
          onclick: async () => {
            try { zone.value = await navigator.clipboard.readText(); } catch { retour.replaceChildren(el('p', { class: 'alerte attention' }, 'Le navigateur refuse de lire le presse-papier : collez dans la case (appui long, « Coller »).')); }
          },
        }, '📋 Coller') : null,
        el('button', { type: 'button', class: 'clair', onclick: () => fichier.click() }, '📄 Choisir un fichier'),
        fichier,
      ),
      retour,
      el('div', { class: 'actions droite' },
        el('button', { type: 'button', class: 'clair', onclick: () => fermer(null) }, 'Annuler'),
        el('button', { type: 'button', class: 'principal', onclick: () => importer(zone.value) }, 'Importer')),
    ];
  });
}

// ─── Ajouter un article aux courses ───────────────────────────

export function fenetreArticle() {
  return ouvrirFenetre({ titre: 'Ajouter un article' }, (fermer) => {
    const champ = el('input', { type: 'text', placeholder: 'Ex : Shampoing, Piles AA…', 'aria-label': 'Article', enterkeyhint: 'done' });
    const ajouter = el('button', { type: 'submit', class: 'principal', disabled: true }, 'Ajouter');
    champ.addEventListener('input', () => { ajouter.disabled = !champ.value.trim(); });
    setTimeout(() => champ.focus(), 30);
    return el('form', { onsubmit: (ev) => { ev.preventDefault(); if (champ.value.trim()) fermer(champ.value.trim()); } },
      champ,
      el('div', { class: 'actions droite' }, el('button', { type: 'button', class: 'clair', onclick: () => fermer(null) }, 'Annuler'), ajouter));
  });
}
