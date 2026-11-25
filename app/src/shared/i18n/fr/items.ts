// Le français des objets: les notes sur chaque clé sont dans en/items.ts.
export default {
  unknownItem: 'Objet {id}',
  unknownSpell: 'Sort {id}',

  // "il y a ..." reads after "vu", "vus", "vue", "Image prise" and alone in the character list.
  ago: {
    justNow: 'à l’instant',
    minutes: { one: 'il y a {count} minute', many: 'il y a {count} de minutes', other: 'il y a {count} minutes' },
    hours: { one: 'il y a {count} heure', many: 'il y a {count} d’heures', other: 'il y a {count} heures' },
    days: { one: 'il y a {count} jour', many: 'il y a {count} de jours', other: 'il y a {count} jours' },
    weeks: { one: 'il y a {count} semaine', many: 'il y a {count} de semaines', other: 'il y a {count} semaines' },
  },

  places: {
    bags: 'Sacs',
    bank: 'Banque',
    worn: 'Équipé',
    // A chip, short: the game's "Trousseau de clés" (GS KEYRING) cut to its noun; held.keyring has it whole.
    keyring: 'Trousseau',
  },

  types: {
    weaponOf: 'Arme · {kind}',
    armorOf: 'Armure · {kind}',
    unknown: 'Autre',
    // ItemClass frFR; gem, money, item enhancement and permanent are obsolete in Forever's table: the retail names, and GS MONEY.
    classes: {
      consumable: 'Consommable',
      container: 'Conteneur',
      weapon: 'Arme',
      gem: 'Gemme',
      armor: 'Armure',
      reagent: 'Composant',
      projectile: 'Projectile',
      tradeGoods: 'Artisanat',
      itemEnhancement: 'Amélioration d’objet',
      recipe: 'Recette',
      money: 'Argent',
      quiver: 'Carquois',
      quest: 'Quête',
      key: 'Clé',
      permanent: 'Permanent',
      miscellaneous: 'Divers',
    },
    // ItemSubClass 2.x DisplayName frFR, with the accent the game leaves off ("Epée").
    weapons: {
      axe: 'Hache',
      bow: 'Arc',
      gun: 'Arme à feu',
      mace: 'Masse',
      polearm: 'Arme d’hast',
      sword: 'Épée',
      warglaive: 'Glaives de guerre',
      staff: 'Bâton',
      // The game's own name for subclasses 11 and 12.
      exotic: 'Spéciale',
      fistWeapon: 'Arme de pugilat',
      miscellaneous: 'Divers',
      dagger: 'Dague',
      thrown: 'Armes de jet',
      spear: 'Lance',
      crossbow: 'Arbalète',
      wand: 'Baguette',
      fishingPole: 'Canne à pêche',
    },
    // ItemSubClass 4.x DisplayName frFR; sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: 'Divers',
      cloth: 'Tissu',
      leather: 'Cuir',
      mail: 'Mailles',
      plate: 'Plaques',
      cosmetic: 'Ornemental',
      shield: 'Bouclier',
      libram: 'Libram',
      idol: 'Idole',
      totem: 'Totem',
      sigil: 'Cachet',
      relic: 'Relique',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT), the long ones cut to fit 44px.
  slots: {
    head: 'Tête',
    neck: 'Cou',
    shoulder: 'Épaules',
    back: 'Dos',
    chest: 'Torse',
    shirt: 'Chemise',
    tabard: 'Tabard',
    wrist: 'Poignets',
    hands: 'Mains',
    waist: 'Taille',
    legs: 'Jambes',
    feet: 'Pieds',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: 'Doigt',
    trinket: 'Bijou',
    // GS MAINHANDSLOT "Main droite" and SECONDARYHANDSLOT "Main gauche", without "Main", which alone means hand.
    mainHand: 'Droite',
    offHand: 'Gauche',
    // GS RANGEDSLOT "À distance", without the preposition.
    ranged: 'Distance',
  },

  character: {
    // The game's order, GS PLAYER_LEVEL_NO_SPEC_WITH_RACE: "Démoniste Gnome de niveau 24".
    line: '{class} {race} de niveau {level}',
    kind: '{class} {race}',
  },
  races: {
    human: 'Humain',
    orc: 'Orc',
    dwarf: 'Nain',
    nightElf: 'Elfe de la nuit',
    undead: 'Mort-vivant',
    tauren: 'Tauren',
    gnome: 'Gnome',
    troll: 'Troll',
  },
  classes: {
    warrior: 'Guerrier',
    paladin: 'Paladin',
    hunter: 'Chasseur',
    rogue: 'Voleur',
    priest: 'Prêtre',
    shaman: 'Chaman',
    mage: 'Mage',
    warlock: 'Démoniste',
    druid: 'Druide',
  },
  classesAll: {
    warrior: 'Guerriers',
    paladin: 'Paladins',
    hunter: 'Chasseurs',
    rogue: 'Voleurs',
    priest: 'Prêtres',
    shaman: 'Chamans',
    mage: 'Mages',
    warlock: 'Démonistes',
    druid: 'Druides',
  },

  page: {
    noCharacter: 'Aucun personnage pour l’instant. Jouez-en un avec l’addon Twinmap Forever activé et ses sacs s’affichent ici, même quand le jeu est fermé.',
    filter: 'Filtrer par nom ou type',
    filterLabel: 'Filtrer les objets',
    viewLabel: 'Affichage',
    whereLabel: 'Lieu',
    // A switch half, short: "Emplacements" is too long, "cases" is what players call bag slots.
    slots: 'Cases',
    table: 'Liste',
    all: 'Tous',
    // Each part as "label : amount", like the game's "Argent :" (GS MONEY_COLON).
    worth: 'Vente au marchand : {money}',
    auction: 'Hôtel des ventes : {money}',
    money: 'Argent : {money}',
  },

  doll: {
    label: 'Équipement',
    // The game's window is "Infos personnage" (GS CHARACTER_BUTTON).
    open: 'Ouvrez la fenêtre Infos personnage en jeu',
    keyHint: '{key} si vous n’avez pas changé le raccourci',
    waitNote: 'L’image est prise dès que la fenêtre est ouverte et que rien ne cache le personnage.',
    cancel: 'Annuler',
    save: 'Enregistrer…',
    retake: 'Refaire',
    taken: 'Image prise {ago}',
    // The name as subject: "de {name}" would need "d’" before a vowel.
    none: '{name} n’a pas encore d’image',
    noneNote: 'Ouvrez la fenêtre Infos personnage en jeu, l’image se prend toute seule.',
  },

  held: {
    label: 'Sacs et banque',
    bags: 'Sacs',
    bagsNow: 'en ce moment',
    bagsAsOf: 'vus {ago}',
    bank: 'Banque',
    bankSeen: 'vue {ago}',
    bankUnseen: 'pas encore vue : ouvrez-la une fois en jeu',
    backpack: 'Sac à dos et sacs',
    reagents: 'Sac de composants',
    keyring: 'Trousseau de clés',
    bankBags: 'Banque et ses sacs',
    used: '{used} sur {count} utilisés',
    // GS CONTAINER_SLOTS "emplacements".
    empty: { one: 'vide · {count} emplacement', many: 'vide · {count} d’emplacements', other: 'vide · {count} emplacements' },
  },

  table: {
    columns: {
      item: 'Objet',
      character: 'Personnage',
      type: 'Type',
      where: 'Lieu',
      qty: 'Qté',
      value: 'Valeur',
      auction: 'À l’HV',
    },
    nothingLike: '{name} n’a rien qui corresponde à « {typed} ».',
    nothing: 'Rien ici.',
    bagsNow: 'Sacs en ce moment',
    bagsAsOf: 'Sacs vus {ago}',
    bankSeen: 'Banque vue {ago}, à sa dernière ouverture',
    bankUnseen: 'Banque pas encore vue : ouvrez-la une fois en jeu',
  },

  others: {
    title: 'Autres personnages',
    where: 'gardés sur ce PC',
    show: 'Afficher {name}',
    seen: '{name} : vu {ago}',
  },

  popup: {
    sellPrice: 'Prix de vente : {price}',
    auction: 'Hôtel des ventes : {price}',
    // GS AUCTION_PRICE_PER_ITEM "par unité".
    each: '({price} par unité)',
    notOnSale: 'Hôtel des ventes : pas en vente',
    // After a first name. "le porte" or "l’a équipé" would need the item's gender.
    wears: 'porte cet objet',
    inBags: '{count} dans les sacs',
    inBank: '{count} à la banque',
    noneHeld: 'Aucun de vos personnages n’a cet objet',
    soldBy: 'Vendu par {npc}',
    soldByIn: 'Vendu par {npc}, {zone}',
    // As a shop writes it: "2 a les 5".
    perPack: '{price} les {count}',
    moreVendors: { one: 'et {count} autre marchand', many: 'et {count} d’autres marchands', other: 'et {count} autres marchands' },
    // "de {npc}" would need "d’" before a vowel: the name after a colon, like the game's "Butin de boss :".
    dropsFrom: 'Butin : {npc}',
    dropsFromIn: 'Butin : {npc}, {zone}',
    moreDrops: { one: 'et {count} autre', many: 'et {count} d’autres', other: 'et {count} autres' },
    // Object names come without an article ("Coffre solide"): after a colon, like the game's "Vendu par :".
    foundIn: 'Trouvé dans : {object}',
    foundInIn: 'Trouvé dans : {object}, {zone}',
  },

  npc: {
    sells: '{count} en vente',
    subSells: '{sub} · {count} en vente',
    // The profession after a colon: "pas encore appris(e)" would agree with its gender.
    notLearned: 'Métier pas encore appris : {profession}',
    teaches: 'Réservé aux {classes}.',
    teachesPick: 'Réservé aux {classes} : choisissez un personnage pour voir ce qu’il peut apprendre.',
    // GS AVAILABLE "Disponible": what can be learned now.
    learnNow: 'Disponible · {count}',
    atLevel: 'Niveau {level}',
    // GS SKILL "Compétence".
    atSkill: 'Compétence {skill}',
    nextRank: 'Rang suivant',
    sellsHeading: 'En vente · {count}',
    rank: 'Rang {rank}',
    nextNeeds: 'compétence {skill}, niveau {level}',
    talent: 'Talent',
    quest: 'Quête',
    questTaught: 'Appris par la quête {quest}',
    classQuest: 'Appris par une quête de classe',
    columns: {
      item: 'Objet',
      price: 'Prix',
      ah: 'HV',
      bags: 'Sacs',
      bank: 'Banque',
    },
    ahNote: 'Le prix le plus bas à l’Hôtel des ventes, pour la même quantité',
    ahPrice: 'HV {price}',
    known: 'Connus · {count}',
    show: 'Afficher',
    hide: 'Cacher',
    noCharacter: 'Aucun personnage pour l’instant : jouez-en un avec l’addon Twinmap Forever activé.',
    recipesRead: '{name} · recettes vues à la dernière ouverture de la fenêtre {profession}',
    recipesUnread: '{name} · ouvrez une fois la fenêtre {profession} en jeu pour voir les recettes connues',
    spellsNow: '{name}, niveau {level} · sorts actuels',
    spellsAsOf: '{name}, niveau {level} · sorts vus {ago}',
    bankSeen: 'Banque vue {ago} · {name}',
    bankUnseen: 'Banque pas encore vue : ouvrez-la une fois en jeu · {name}',
  },

  // The shopping list (M10-F4): en/items.ts says where each text shows.
  shopping: {
    title: 'Liste de courses',
    forWho: 'Pour {name}',
    making: 'À fabriquer · {count}',
    makeFirst: 'À fabriquer d’abord · {count}',
    missing: 'Manquant · {count}',
    ready: 'Déjà là · {count}',
    toBuy: 'à acheter : {price}',
    youKnow: '{profession} · recette connue',
    needs: '{profession} : {skill} requis, vous avez {have}',
    notKnown: '{profession} · pas encore apprise',
    takes: '{items} par fabrication',
    takesFor: '{items} pour {count}',
    amount: '{count} {item}',
    toLearn: '{profession} : {skill} pour l’apprendre',
    make: 'fabriquer {count}',
    of: '{missing} sur {count}',
    folded: { one: '{count} manquant', many: '{count} manquants', other: '{count} manquants' },
    foldedNone: 'Tout est à portée de main',
    fold: 'Replier la liste de courses',
    unfold: 'Déplier la liste de courses',
    fewer: 'Un de moins',
    more: 'Un de plus',
    add: 'Ajouter à la liste de courses : {item}',
  },

  picker: {
    inGame: 'En jeu',
    seen: 'vu {ago}',
    list: 'Personnages',
    forget: 'Oublier',
    note: 'Gardés sur cet ordinateur, d’après ce que l’addon a transmis pendant vos parties. Faites un clic droit sur un personnage pour l’oublier.',
  },

  resize: 'Faites glisser pour redimensionner',
}
