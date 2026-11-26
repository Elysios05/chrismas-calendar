/**
 * Contenu personnel du salon d'Alexandre et Flavie (décision d'Alexandre du 25 nov : option A).
 *
 * C'est le contenu qui était le « défaut » des jeux jusqu'au 25 nov, avec leurs souvenirs à eux
 * (Ljubljana, le train de nuit, le décalage…). Depuis les salons, le défaut de src/data/games/ est générique
 * et ce contenu-ci va dans LEUR salon : `salon.config.contenu`, une entrée par jour (seulement les champs
 * personnalisables, voir les SCHEMA_… de src/data/games/).
 *
 * Usage : `modifierSalon({ ...salon.config, contenu: { ...CONTENU_ALEXANDRE_FLAVIE, ...salon.config.contenu } })`
 * (ou en pré-remplissage à la création de leur salon). ALEXANDRE : c'est ici que tu remplaces par vos vrais
 * souvenirs, ou plus tard directement dans l'éditeur du salon.
 */

import type { ContenuSalon } from "../../core/contracts";

export const CONTENU_ALEXANDRE_FLAVIE: ContenuSalon = {
  "1": {
    "nombre": 10,
    "questions": [
      {
        "id": "film",
        "emoji": "🎬",
        "surMoi": "Le film de Noël que tu remets chaque année, c'est…",
        "surAutre": "Le film de Noël que {autre} remet chaque année, c'est…",
        "options": [
          "Le Grinch",
          "Love Actually",
          "Maman j'ai raté l'avion",
          "Le Pôle Express"
        ],
        "exemple": {
          "alexandre": 0,
          "flavie": 2
        }
      },
      {
        "id": "gourmandise",
        "emoji": "🍪",
        "surMoi": "Tout décembre, tu ne manges plus qu'une seule chose :",
        "surAutre": "Tout décembre, {autre} ne mange plus qu'une seule chose :",
        "options": [
          "du pain d'épices",
          "de la raclette",
          "des clémentines",
          "du chocolat chaud"
        ],
        "exemple": {
          "alexandre": 1,
          "flavie": 0
        }
      },
      {
        "id": "coucher",
        "emoji": "🌙",
        "surMoi": "En vacances, tu t'endors vraiment vers…",
        "surAutre": "En vacances, {autre} s'endort vraiment vers…",
        "options": [
          "22 h",
          "23 h 30",
          "1 h du matin",
          "3 h du matin"
        ],
        "exemple": {
          "alexandre": 1,
          "flavie": 2
        }
      },
      {
        "id": "peur",
        "emoji": "😱",
        "surMoi": "Ce qui te fait le plus peur :",
        "surAutre": "Ce qui fait le plus peur à {autre} :",
        "options": [
          "les araignées",
          "le vide",
          "parler devant du monde",
          "les films d'horreur"
        ],
        "exemple": {
          "alexandre": 1,
          "flavie": 0
        }
      },
      {
        "id": "cadeau",
        "emoji": "🎁",
        "surMoi": "Le cadeau dont tu rêves en secret :",
        "surAutre": "Le cadeau dont {autre} rêve en secret :",
        "options": [
          "un billet d'avion",
          "une console",
          "un appareil photo",
          "un chat"
        ],
        "exemple": {
          "alexandre": 0,
          "flavie": 3
        }
      },
      {
        "id": "matin",
        "emoji": "☕",
        "surMoi": "Le matin, la première chose que tu fais :",
        "surAutre": "Le matin, la première chose que fait {autre} :",
        "options": [
          "regarder son téléphone",
          "un café",
          "se rendormir 20 minutes",
          "une douche"
        ],
        "exemple": {
          "alexandre": 2,
          "flavie": 0
        }
      },
      {
        "id": "chanson",
        "emoji": "🎵",
        "surMoi": "La chanson de Noël que tu chantes (faux) :",
        "surAutre": "La chanson de Noël que {autre} chante (faux) :",
        "options": [
          "All I Want for Christmas",
          "Petit Papa Noël",
          "Last Christmas",
          "Vive le vent"
        ],
        "exemple": {
          "alexandre": 2,
          "flavie": 0
        }
      },
      {
        "id": "hiver",
        "emoji": "🧣",
        "surMoi": "Quand il fait -5 °C dehors, tu veux…",
        "surAutre": "Quand il fait -5 °C dehors, {autre} veut…",
        "options": [
          "sortir marcher",
          "rester sous la couverture",
          "aller boire un vin chaud",
          "faire de la luge"
        ],
        "exemple": {
          "alexandre": 0,
          "flavie": 1
        }
      },
      {
        "id": "serie",
        "emoji": "📺",
        "surMoi": "Si tu dois lancer une série pour la 4ᵉ fois :",
        "surAutre": "Si {autre} doit lancer une série pour la 4ᵉ fois :",
        "options": [
          "Friends",
          "Kaamelott",
          "The Office",
          "Brooklyn Nine-Nine"
        ],
        "exemple": {
          "alexandre": 1,
          "flavie": 0
        }
      },
      {
        "id": "voyage",
        "emoji": "✈️",
        "surMoi": "Le prochain endroit où tu veux qu'on aille :",
        "surAutre": "Le prochain endroit où {autre} veut qu'on aille :",
        "options": [
          "la Laponie",
          "Venise à Noël",
          "New York",
          "un chalet en montagne"
        ],
        "exemple": {
          "alexandre": 3,
          "flavie": 1
        }
      }
    ]
  },
  "3": {
    "emoji": "🪟",
    "titre": "La vue de ta fenêtre",
    "consigne": "Prends en photo ce que tu vois de ta fenêtre, là, maintenant. Pas de mise en scène !",
    "idees": [
      "Ce que je regarde quand je pense à toi…",
      "Mon petit bout de ciel aujourd'hui",
      "Il manque juste toi dans ce cadre"
    ],
    "questions": [
      {
        "id": "heure",
        "texte": "À quel moment de la journée j'ai pris cette photo ?",
        "options": [
          "Le matin",
          "L'après-midi",
          "Le soir",
          "En pleine nuit"
        ]
      },
      {
        "id": "bruit",
        "texte": "Qu'est-ce que j'entends en ce moment ?",
        "options": [
          "Le silence",
          "Des voitures",
          "Des voisins",
          "De la musique"
        ]
      },
      {
        "id": "temperature",
        "texte": "Il fait combien dehors ?",
        "options": [
          "Moins de 0 °C",
          "Entre 0 et 5 °C",
          "Entre 5 et 10 °C",
          "Plus de 10 °C"
        ]
      },
      {
        "id": "boisson",
        "texte": "Qu'est-ce que j'ai dans la main (à part le téléphone) ?",
        "options": [
          "Un café",
          "Un thé",
          "Un chocolat chaud",
          "Rien du tout"
        ]
      },
      {
        "id": "prefere",
        "texte": "Ce que je préfère dans cette vue ?",
        "options": [
          "La lumière",
          "Le calme",
          "Le ciel",
          "Rien : tu n'y es pas"
        ]
      }
    ]
  },
  "5": {
    "nous": [
      {
        "mot": "Train de nuit",
        "variantes": [
          "train"
        ]
      },
      {
        "mot": "Appel vidéo",
        "variantes": [
          "visio",
          "facetime",
          "appel"
        ]
      },
      {
        "mot": "Valise"
      },
      {
        "mot": "Aéroport",
        "variantes": [
          "avion"
        ]
      },
      {
        "mot": "Carte postale",
        "variantes": [
          "carte"
        ]
      },
      {
        "mot": "Pizza du dimanche",
        "variantes": [
          "pizza"
        ]
      },
      {
        "mot": "Plaid sur le canapé",
        "variantes": [
          "plaid",
          "canape"
        ]
      },
      {
        "mot": "Billet de retour",
        "variantes": [
          "billet"
        ]
      }
    ],
    "noel": [
      {
        "mot": "Renne",
        "variantes": [
          "rennes",
          "caribou"
        ]
      },
      {
        "mot": "Bonhomme de neige",
        "variantes": [
          "bonhomme",
          "bonhomme neige"
        ]
      },
      {
        "mot": "Cheminée",
        "variantes": [
          "feu de cheminée"
        ]
      },
      {
        "mot": "Sucre d'orge",
        "variantes": [
          "sucre dorge",
          "canne en sucre"
        ]
      },
      {
        "mot": "Traîneau",
        "variantes": [
          "luge"
        ]
      },
      {
        "mot": "Couronne de l'Avent",
        "variantes": [
          "couronne"
        ]
      },
      {
        "mot": "Chaussette",
        "variantes": [
          "chaussettes",
          "chaussette de noel"
        ]
      },
      {
        "mot": "Boule de Noël",
        "variantes": [
          "boule",
          "boules"
        ]
      }
    ]
  },
  "7": {
    "enigmes": [
      {
        "id": "buche",
        "emojis": "🍫🪵",
        "reponse": "la bûche de Noël",
        "variantes": [
          "bûche"
        ],
        "indice": "Ça se mange, et ça ne brûle pas."
      },
      {
        "id": "etoile",
        "emojis": "⭐🌲",
        "reponse": "l'étoile du sapin",
        "variantes": [
          "étoile de Noël"
        ],
        "indice": "Tout en haut, et c'est toujours la galère à poser."
      },
      {
        "id": "chaussette",
        "emojis": "🧦🔥",
        "reponse": "la chaussette sur la cheminée",
        "variantes": [
          "chaussette de Noël",
          "la chaussette"
        ],
        "indice": "On l'accroche la veille, on la vide le matin."
      },
      {
        "id": "bonhomme",
        "emojis": "☃️🥕",
        "reponse": "le nez du bonhomme de neige",
        "variantes": [
          "le bonhomme de neige",
          "carotte"
        ],
        "indice": "Un légume qui sert de visage."
      },
      {
        "id": "distance",
        "emojis": "✈️💻❤️",
        "reponse": "l'amour à distance",
        "variantes": [
          "amour longue distance",
          "la distance"
        ],
        "indice": "C'est toute notre année, ça."
      },
      {
        "id": "raclette",
        "emojis": "🧀🥔♨️",
        "reponse": "la raclette",
        "variantes": [
          "soirée raclette"
        ],
        "indice": "Le plat qui vous réconcilie avec l'hiver."
      },
      {
        "id": "film",
        "emojis": "🎬🛋️🍿",
        "reponse": "la soirée film",
        "variantes": [
          "soirée cinéma",
          "notre soirée film"
        ],
        "indice": "Chacun chez soi, mais on appuie sur « lecture » en même temps."
      },
      {
        "id": "appel",
        "emojis": "📞🌙",
        "reponse": "l'appel du soir",
        "variantes": [
          "le coup de fil du soir",
          "appel du soir"
        ],
        "indice": "Tous les jours, et souvent trop court."
      }
    ]
  },
  "9": {
    "nbDessins": 3,
    "themes": [
      {
        "id": "rdv",
        "texte": "Notre premier rendez-vous",
        "idee": "ex. le cinéma"
      },
      {
        "id": "voyage",
        "texte": "Un voyage qu'on a fait",
        "idee": "ex. Venise"
      },
      {
        "id": "plat",
        "texte": "Un plat qu'on adore",
        "idee": "ex. la raclette"
      },
      {
        "id": "rire",
        "texte": "Un moment où on a beaucoup ri",
        "idee": "ex. la panne de voiture"
      },
      {
        "id": "objet",
        "texte": "Un objet qui me fait penser à toi",
        "idee": "ex. ton écharpe"
      },
      {
        "id": "bientot",
        "texte": "Ce qu'on fera quand on se reverra",
        "idee": "ex. un gros câlin"
      }
    ]
  },
  "11": {
    "nombre": 12,
    "questions": [
      {
        "id": "weekend",
        "type": "choix",
        "emoji": "🛌",
        "texte": "Un week-end entier libre, rien que nous deux. On fait quoi ?",
        "options": [
          "Grasse matinée et rien d'autre",
          "Une randonnée",
          "Un musée et un bon restaurant",
          "On improvise"
        ],
        "pingou": "Ah. Vous n'avez pas prévu le même week-end du tout 😅"
      },
      {
        "id": "sapin",
        "type": "choix",
        "emoji": "🎄",
        "texte": "Le sapin, on le décore comment ?",
        "options": [
          "Rouge et or, classique",
          "Bleu et blanc, givré",
          "N'importe comment, c'est plus drôle",
          "Pas de sapin"
        ],
        "pingou": "Il va falloir négocier avant le 24…"
      },
      {
        "id": "jetaime",
        "type": "qui",
        "emoji": "📞",
        "texte": "Qui dit « je t'aime » en premier au téléphone ?",
        "pingou": "Vous n'êtes même pas d'accord là-dessus ? 🐧"
      },
      {
        "id": "loto",
        "type": "choix",
        "emoji": "💸",
        "texte": "On gagne au loto demain. Premier réflexe ?",
        "options": [
          "On vit enfin ensemble",
          "On achète un appartement",
          "On voyage un an",
          "On ne dit rien à personne"
        ],
        "pingou": "Deux plans différents pour le même magot."
      },
      {
        "id": "retard",
        "type": "qui",
        "emoji": "⏰",
        "texte": "Qui est systématiquement en retard ?",
        "pingou": "Curieusement, personne ne se désigne soi-même…"
      },
      {
        "id": "soir",
        "type": "choix",
        "emoji": "🌙",
        "texte": "La soirée parfaite à distance, c'est…",
        "options": [
          "Un film lancé en même temps",
          "Un appel qui dure des heures",
          "Jouer ensemble",
          "Chacun son truc, mais en visio"
        ],
        "pingou": "Pas la même soirée parfaite. Il y a des indices à prendre, là."
      },
      {
        "id": "cuisine",
        "type": "qui",
        "emoji": "🍳",
        "texte": "Qui cuisine le mieux, honnêtement ?",
        "pingou": "L'honnêteté avait ses limites, visiblement."
      },
      {
        "id": "noel",
        "type": "choix",
        "emoji": "🎁",
        "texte": "Le meilleur moment de Noël ?",
        "options": [
          "Ouvrir les cadeaux",
          "Le repas",
          "La déco et la musique",
          "Ne rien faire du tout"
        ],
        "pingou": "Chacun son Noël, finalement."
      },
      {
        "id": "vacances",
        "type": "choix",
        "emoji": "🏔️",
        "texte": "Prochaines vacances à deux :",
        "options": [
          "La montagne sous la neige",
          "Une grande ville",
          "La mer, même en hiver",
          "Un endroit qu'on ne connaît pas"
        ],
        "pingou": "Deux destinations. Ça promet pour la réservation."
      },
      {
        "id": "bordel",
        "type": "qui",
        "emoji": "🧺",
        "texte": "Qui laisse traîner ses affaires partout ?",
        "pingou": "Chacun accuse l'autre. Classique."
      },
      {
        "id": "pardon",
        "type": "qui",
        "emoji": "🤝",
        "texte": "Qui s'excuse en premier après une dispute ?",
        "pingou": "Pas d'accord non plus. Au moins vous êtes constants."
      },
      {
        "id": "dans5ans",
        "type": "choix",
        "emoji": "🔮",
        "texte": "Dans cinq ans, on se voit…",
        "options": [
          "Dans la même ville, enfin",
          "À l'étranger, ensemble",
          "Avec un chat et trop de plantes",
          "Aucune idée, et c'est bien"
        ],
        "pingou": "Deux avenirs différents… il faudra en reparler 💞"
      }
    ]
  },
  "14": {
    "intro": "Flavie au four, Alexandre au frigo : même goûter, deux cuisines. On se raconte tout, étape par étape !"
  },
  "15": {
    "motsParPartie": 3,
    "mots": [
      {
        "mot": "GUIRLANDE",
        "indice": "Ça clignote et ça s'emmêle toujours."
      },
      {
        "mot": "PAIN D'ÉPICES",
        "indice": "Ça sent la cannelle et le miel."
      },
      {
        "mot": "BOULE À NEIGE",
        "indice": "On la secoue et il neige dedans."
      },
      {
        "mot": "TRAÎNEAU",
        "indice": "Il décolle le 24 au soir."
      },
      {
        "mot": "CHOCOLAT CHAUD",
        "indice": "La boisson des doigts gelés."
      },
      {
        "mot": "PATINOIRE",
        "indice": "On y tombe élégamment."
      },
      {
        "mot": "CASSE-NOISETTE",
        "indice": "Un ballet, et un soldat en bois."
      },
      {
        "mot": "MARRONS CHAUDS",
        "indice": "Ça se vend au coin de la rue en décembre."
      },
      {
        "mot": "LJUBLJANA",
        "indice": "Là où l'un de vous se réveille le matin.",
        "perso": true
      },
      {
        "mot": "NOTRE PREMIER NOËL",
        "indice": "Ce que vous fêtez cette année.",
        "perso": true
      },
      {
        "mot": "APPEL DU SOIR",
        "indice": "Tous les jours, et toujours trop court.",
        "perso": true
      },
      {
        "mot": "VALISE",
        "indice": "L'objet des retrouvailles… et des départs.",
        "perso": true
      },
      {
        "mot": "RACLETTE",
        "indice": "Le plat qui vous réconcilie avec l'hiver.",
        "perso": true
      },
      {
        "mot": "DÉCALAGE",
        "indice": "Une heure de trop entre vous deux.",
        "perso": true
      }
    ]
  },
  "17": {
    "mots": [
      {
        "mot": "GUIRLANDE",
        "definition": "Elle clignote et s'emmêle"
      },
      {
        "mot": "CANNELLE",
        "definition": "L'épice qui sent décembre"
      },
      {
        "mot": "TRAINEAU",
        "definition": "Il décolle le 24 au soir"
      },
      {
        "mot": "SAPIN",
        "definition": "On le décore, il perd ses aiguilles"
      },
      {
        "mot": "PATINS",
        "definition": "Pour glisser sur le lac gelé"
      },
      {
        "mot": "MARRONS",
        "definition": "Chauds, au coin de la rue"
      },
      {
        "mot": "ETOILE",
        "definition": "Tout en haut du sapin"
      },
      {
        "mot": "NEIGE",
        "definition": "Ce qu'on espère le 25 au matin"
      },
      {
        "mot": "LJUBLJANA",
        "definition": "La ville où l'un se réveille",
        "perso": true
      },
      {
        "mot": "TRAIN",
        "definition": "Ce qu'on prend pour se retrouver",
        "perso": true
      },
      {
        "mot": "JUILLET",
        "definition": "Le mois de votre rencontre",
        "perso": true
      },
      {
        "mot": "RACLETTE",
        "definition": "Le plat des retrouvailles",
        "perso": true
      },
      {
        "mot": "MINUIT",
        "definition": "L'heure de l'appel qui s'éternise",
        "perso": true
      },
      {
        "mot": "VALISE",
        "definition": "Toujours à moitié défaite",
        "perso": true
      },
      {
        "mot": "DECALAGE",
        "definition": "L'heure de trop entre vous",
        "perso": true
      }
    ]
  }
};
