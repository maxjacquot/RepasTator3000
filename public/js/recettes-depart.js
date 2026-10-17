// Recettes de départ : mises dans une base vide (première ouverture). Reprises de l'ancienne appli Expo.
export const RECETTES_DEPART = [] = [
  {
    title: "Falafels maison au air fryer & sauce yaourt ail-citron",
    category: "Plat",
    prep_time: 51,
    cook_time: 15,
    description: "Des falafels maison ultra dorés et croustillants, cuits à l'air fryer pour un résultat léger et savoureux. Servis dans un pain pita avec une sauce au yaourt grec à l'ail et au citron.",
    ingredients: [
      { qty: 400, unit: 'g', name: "pois chiches cuits en boîte, égouttés" },
      { qty: 1, unit: 'unité', name: "oignon rouge" },
      { qty: 2, unit: 'unités', name: "gousses d'ail" },
      { qty: 20, unit: 'g', name: "persil frais" },
      { qty: 1, unit: 'c. à café', name: "cumin en poudre" },
      { qty: 1, unit: 'c. à café', name: "coriandre en poudre" },
      { qty: 3, unit: 'c. à soupe', name: "farine" },
      { qty: 1, unit: 'c. à soupe', name: "huile d'olive (pour badigeonner)" },
      { qty: 100, unit: 'g', name: "yaourt grec" },
      { qty: 0.5, unit: 'unité', name: "citron (jus)" },
      { qty: 2, unit: 'unités', name: "pains pita" },
    ],
    tags: ["végétarien", "fait-maison", "air-fryer", "sandwich"],
    steps: [
      {
        label: "Mixer la pâte",
        instruction:
          "Dans un mixeur, combiner les pois chiches égouttés, l'oignon rouge, les gousses d'ail, le persil frais, le cumin, la coriandre, la farine, le sel et le poivre. Mixer par impulsions jusqu'à obtenir une pâte grossière — pas une purée lisse. Ajuster l'assaisonnement.",
        duration: 5,
        type: "prep",
      },
      {
        label: "Façonner les falafels",
        instruction:
          "Avec les mains légèrement humides, former environ 10 à 12 boulettes d'environ 3 cm de diamètre. Les disposer sur une assiette et placer au réfrigérateur 15 minutes pour qu'elles se tiennent mieux à la cuisson.",
        duration: 18,
        type: "wait",
      },
      {
        label: "Préparer la sauce yaourt",
        instruction:
          "Mélanger le yaourt grec avec le jus d'un demi-citron et une pointe d'ail écrasé. Assaisonner avec sel et poivre. Réserver au frigo jusqu'au service.",
        duration: 3,
        type: "prep",
      },
      {
        label: "Préchauffer le air fryer",
        instruction: "Préchauffer le air fryer à 190 °C pendant 3 minutes.",
        duration: 3,
        type: "wait",
      },
      {
        label: "Cuisson des falafels",
        instruction:
          "Badigeonner les boulettes d'huile d'olive et les déposer dans le panier du air fryer en une seule couche, sans les superposer. Cuire à 190 °C pendant 15 minutes en les retournant à mi-cuisson pour une dorure uniforme.",
        duration: 15,
        type: "cook",
      },
      {
        label: "Assembler & servir",
        instruction:
          "Ouvrir les pains pita et les garnir de falafels chauds, de sauce yaourt ail-citron, de tomates en tranches et de feuilles de roquette.",
        duration: 7,
        type: "prep",
      },
    ],
  },
];

/** Recette de départ → format rangé sur le serveur (ingrédients, étapes et tags en JSON). */
export function versFormatStocke(r) {
  return {
    title: r.title,
    category: r.category,
    prep_time: r.prep_time,
    cook_time: r.cook_time,
    description: r.description,
    ingredients: r.ingredients.length > 0 ? JSON.stringify(r.ingredients) : '[]',
    steps: r.steps.length > 0 ? JSON.stringify(r.steps) : '',
    tags: r.tags.length > 0 ? JSON.stringify(r.tags) : '[]',
  };
}
