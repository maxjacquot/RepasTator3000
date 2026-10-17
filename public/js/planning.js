// Écran « Planning » : les 7 prochains jours, midi et soir, avec jusqu'à 2 accompagnements par repas.
// Téléphone : un jour par page, on glisse d'un jour à l'autre (points en bas). Ordinateur : jours en grille.
import { el, septJours, pluriel } from './ui.js';
import * as D from './donnees.js';
import { choisirRecette, ajouterAuPlanning, planifierAvecCourses } from './fenetres.js';

let jourAffiche = 0; // gardé quand l'écran est redessiné

const REPAS = [
  { cle: 'lunch', icone: '🥗', nom: 'Midi' },
  { cle: 'dinner', icone: '🥣', nom: 'Soir' },
];

/** @param {{ ouvrirRecette: (id: number) => void, redessiner: () => void }} nav */
export function ecranPlanning(nav) {
  const jours = septJours().map((j) => ({ ...j, plan: D.jour(j.date) }));
  const planifies = jours.reduce((n, j) => n + (j.plan.lunch && D.recette(j.plan.lunch) ? 1 : 0) + (j.plan.dinner && D.recette(j.plan.dinner) ? 1 : 0), 0);

  async function ajouter(date, creneau) {
    const r = await choisirRecette();
    if (!r) return;
    if (creneau === 'lunch' || creneau === 'dinner') await ajouterAuPlanning(r, { date, creneau });
    else {
      // Accompagnement : même nombre de personnes que le repas
      const personnes = D.jour(date)[`${D.repasDe(creneau)}_people`];
      await planifierAvecCourses(r, [{ date, creneau, personnes }], personnes);
    }
    nav.redessiner();
  }
  const retirer = (date, creneau) => {
    D.retirer(date, creneau);
    nav.redessiner();
  };

  const plat = (r, date, creneau, accompagnement = false) => el('div', { class: 'plat-ligne' },
    el('button', { type: 'button', class: `plat ${accompagnement ? 'accompagnement' : ''}`, onclick: () => nav.ouvrirRecette(r.id) },
      el('span', {}, el('span', { class: 'plat-titre' }, r.title), el('span', { class: 'plat-infos' }, `${r.category} · ⏱ ${r.prep_time} min`)),
      el('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')),
    el('button', { type: 'button', class: 'retirer', 'aria-label': `Retirer ${r.title}`, onclick: () => retirer(date, creneau) }, '✕'));

  const boutonAjouter = (texte, date, creneau, accompagnement = false) => el('button', {
    type: 'button', class: `ajouter-plat ${accompagnement ? 'accompagnement' : ''}`, onclick: () => ajouter(date, creneau),
  }, el('span', { class: 'plus' }, '+'), texte);

  const creneau = ({ date, plan }, { cle, icone, nom }) => {
    const principal = plan[cle] && D.recette(plan[cle]);
    const acc1 = plan[`${cle}_side`] && D.recette(plan[`${cle}_side`]);
    const acc2 = plan[`${cle}_side2`] && D.recette(plan[`${cle}_side2`]);
    return el('section', { class: 'creneau-repas' },
      el('div', { class: 'creneau-tete' },
        el('span', { class: 'creneau-icone' }, icone), el('span', { class: 'creneau-nom' }, nom),
        principal ? el('span', { class: 'personnes-badge' }, `👥 ${plan[`${cle}_people`]} pers.`) : null),
      principal
        ? [
          plat(principal, date, cle),
          el('div', { class: 'accompagnements' },
            el('p', { class: 'accompagnements-titre' }, 'Accompagnements'),
            acc1 ? plat(acc1, date, `${cle}_side`, true) : boutonAjouter('Ajouter un accompagnement', date, `${cle}_side`, true),
            acc1 || acc2 ? (acc2 ? plat(acc2, date, `${cle}_side2`, true) : boutonAjouter('Ajouter un 2ème accompagnement', date, `${cle}_side2`, true)) : null),
        ]
        : boutonAjouter('Ajouter une recette', date, cle),
    );
  };

  const pages = el('div', { class: 'jours' }, jours.map((j) => el('article', { class: 'jour', 'aria-label': `${j.titre} ${j.sousTitre}` },
    el('div', { class: 'jour-tete' },
      el('h2', { class: `jour-titre ${j.decalage === 0 ? 'aujourdhui' : ''}` }, j.titre),
      el('p', { class: 'jour-date' }, j.sousTitre)),
    el('div', { class: 'creneaux-repas' }, REPAS.map((r) => creneau(j, r))),
  )));
  const points = el('div', { class: 'points', 'aria-hidden': 'true' }, jours.map((_, i) => el('span', { class: `point ${i === 0 ? 'aujourdhui' : ''}` })));
  const majPoints = () => points.querySelectorAll('.point').forEach((p, i) => p.classList.toggle('actif', i === jourAffiche));
  pages.addEventListener('scroll', () => {
    const i = Math.round(pages.scrollLeft / pages.clientWidth);
    if (i !== jourAffiche) {
      jourAffiche = i;
      majPoints();
    }
  }, { passive: true });
  majPoints();
  // Revenir au jour qui était affiché (après un ajout, un retrait…)
  requestAnimationFrame(() => { pages.scrollLeft = jourAffiche * pages.clientWidth; });

  return [
    el('header', { class: 'entete entete-planning' },
      el('div', { class: 'titre' }, el('span', { id: 'volet-outils' }),
        el('div', {}, el('h1', {}, 'Menu du jour'),
          el('p', { class: 'entete-sous-titre' }, planifies === 0 ? 'Aucun repas planifié' : `${pluriel(planifies, 'repas planifié', 'repas planifiés')} cette semaine`))),
      el('span', { class: `compte-repas ${planifies > 0 ? 'actif' : ''}` }, `${planifies}/14`),
      el('div', { class: 'progression', 'aria-hidden': 'true' }, el('span', { style: { width: `${(planifies / 14) * 100}%` } })),
    ),
    el('main', { class: 'contenu contenu-planning' }, pages, points),
  ];
}
