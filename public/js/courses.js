// Écran « Courses » : liste par recette ou par rayon (mêmes ingrédients additionnés), cocher, vider.
import { el, confirmer } from './ui.js';
import * as D from './donnees.js';
import { groupesParRecette, groupesParRayon } from './calculs.js';
import { fenetreArticle } from './fenetres.js';

let vue = 'recette'; // « recette » ou « rayon », gardé quand on revient sur l'écran

/** @param {{ redessiner: () => void }} nav */
export function ecranCourses(nav) {
  const articles = D.listeDeCourses();
  const faits = articles.filter((a) => a.done === 1).length;
  const groupes = vue === 'recette' ? groupesParRecette(articles) : groupesParRayon(articles);

  const ligne = (l) => el('button', {
    type: 'button', class: `article ${l.fait ? 'fait' : ''}`, 'aria-pressed': String(l.fait),
    onclick: () => { D.cocher(l.ids, !l.fait); nav.redessiner(); },
  },
  el('span', { class: 'case', 'aria-hidden': 'true' }, l.fait ? '✓' : ''),
  el('span', { class: 'article-corps' },
    el('span', { class: 'article-nom' }, l.nom),
    vue === 'rayon' && l.recettes.length ? el('span', { class: 'article-recettes' }, l.recettes.join(' · ')) : null),
  l.quantite ? el('span', { class: 'article-qte' }, l.quantite) : l.ids.length > 1 ? el('span', { class: 'article-qte' }, `×${l.ids.length}`) : null);

  const groupe = (g) => {
    const toutFait = g.lignes.every((l) => l.fait);
    return el('section', { class: `groupe-courses ${toutFait ? 'fait' : ''}` },
      el('div', { class: 'groupe-tete' },
        el('span', { class: 'groupe-emoji' }, g.emoji), el('h2', {}, g.titre),
        toutFait
          ? el('button', { type: 'button', class: 'supprimer-groupe', onclick: () => { D.supprimerArticles(g.lignes.flatMap((l) => l.ids)); nav.redessiner(); } }, '🗑 Supprimer')
          : el('span', { class: 'groupe-compte' }, g.lignes.length)),
      el('div', { class: 'groupe-articles' }, g.lignes.map(ligne)));
  };

  return [
    el('header', { class: 'entete entete-courses' },
      el('div', { class: 'titre' }, el('span', { id: 'volet-outils' }),
        el('div', {}, el('h1', {}, '🛒 Courses'), articles.length ? el('p', { class: 'entete-sous-titre' }, `${faits}/${articles.length} dans le panier`) : null)),
      articles.length ? el('button', {
        type: 'button', class: 'sur-entete',
        onclick: async () => {
          if (await confirmer({ titre: 'Vider la liste ?', message: 'Tous les articles de ta liste de courses vont être supprimés.', action: 'Vider la liste', danger: true })) {
            D.viderCourses();
            nav.redessiner();
          }
        },
      }, "✓ J'ai fait les courses") : null,
      articles.length ? el('div', { class: 'bascule-vue', role: 'group', 'aria-label': 'Affichage' },
        [['recette', 'Par recette'], ['rayon', 'Par rayon']].map(([v, texte]) => el('button', {
          type: 'button', class: vue === v ? 'actif' : '', 'aria-pressed': String(vue === v), onclick: () => { vue = v; nav.redessiner(); },
        }, texte))) : null,
    ),
    el('main', { class: 'contenu contenu-courses' },
      articles.length
        ? groupes.map(groupe)
        : el('div', { class: 'vide' }, el('p', { class: 'vide-emoji' }, '🛍️'), el('h2', {}, 'Liste vide'), el('p', {}, 'Ouvre une recette et appuie sur « Ajouter au planning »')),
      el('button', {
        type: 'button', class: 'principal bouton-flottant',
        onclick: async () => {
          const nom = await fenetreArticle();
          if (!nom) return;
          D.ajouterAuxCourses([{ name: nom, recipe_name: '' }]);
          nav.redessiner();
        },
      }, '+ Ajouter'),
    ),
  ];
}
