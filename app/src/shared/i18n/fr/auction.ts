// Le français de l’Hôtel des ventes: les notes sur chaque clé sont dans en/auction.ts.
export default {
  unknownItem: 'Objet {id}',

  house: {
    // "HV", the game's short form, to keep the button short.
    line: 'HV {number} · {side} · {ruleset}',
    // Our choice: the game names no "ruleset"; the realm list calls it the type of the realm.
    unknownRuleset: 'Type de royaume {id}',
  },
  side: {
    alliance: 'Alliance',
    horde: 'Horde',
    neutral: 'Neutre',
  },
  ruleset: {
    normal: 'Normal',
    pvp: 'JcJ',
    roleplay: 'Jeu de rôle',
    roleplayPvp: 'Jeu de rôle JcJ',
  },
  category: {
    noClass: 'Autres',
    // Our choice: "Classe" would read as a character class.
    unknownClass: 'Catégorie {id}',
    unknownSub: 'Sous-catégorie {id}',
  },
  // The game's slot names (GlobalStrings INVTYPE_*).
  slot: {
    head: 'Tête',
    neck: 'Cou',
    shoulder: 'Épaule',
    shirt: 'Chemise',
    chest: 'Torse',
    waist: 'Taille',
    legs: 'Jambes',
    feet: 'Pieds',
    wrist: 'Poignets',
    hands: 'Mains',
    finger: 'Doigt',
    trinket: 'Bijou',
    offHand: 'Main gauche',
    back: 'Dos',
    tabard: 'Tabard',
    heldInOffHand: 'Tenu(e) en main gauche',
    relic: 'Relique',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name.
    // Shorter than the English: the whole sentence did not fit the box.
    searchPlaceholder: 'Rechercher un nom, ou "un nom exact"',
    searchLabel: 'Rechercher dans l’Hôtel des ventes',
    filters: 'Filtres',
    filtersOn: 'Filtres · {count}',
    prices: 'Prix',
    perUnit: 'Prix unitaire',
    perStack: 'Prix par pile',
    pricesOf: 'Prix de {time}',
    notUpdated: '{age}, non mis à jour',
    nextAround: 'prochains prix vers {time}',
  },
  // "min" and "h" are the game's abbreviations and take no "de" after a million.
  age: {
    minutes: { one: 'il y a {count} min', many: 'il y a {count} min', other: 'il y a {count} min' },
    hours: { one: 'il y a {count} h', many: 'il y a {count} h', other: 'il y a {count} h' },
    days: { one: 'il y a {count} jour', many: 'il y a {count} de jours', other: 'il y a {count} jours' },
  },
  filters: {
    level: 'Niveau {from} à {to}',
    from: 'de',
    to: 'à',
    quality: 'Qualité',
    // Feminine, as "qualité".
    any: 'Toutes',
    atLeast: {
      poor: 'Mauvais et plus',
      common: 'Commun et plus',
      uncommon: 'Inhabituel et plus',
      rare: 'Rare et plus',
      epic: 'Épique et plus',
      legendary: 'Légendaire et plus',
    },
    lowestPrice: 'Prix le plus bas {from} à {to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's o, a, c.
    priceExample: 'ex. 1g 50s',
    clear: 'Effacer',
  },

  choose: {
    title: 'Quel Hôtel des ventes ?',
    intro: 'Twinmap affiche les prix de l’Hôtel des ventes où votre personnage vend.',
    // "Selon le jeu," keeps {who} away from "que", which would need "qu’" before a vowel.
    told: 'Selon le jeu, {who} joue sur un royaume {ruleset}.',
    toldSide: 'Selon le jeu, {who} joue sur un royaume {ruleset}, côté {side}.',
    region: 'Région',
    readFromGame: '(lu dans le jeu)',
    // The towns by their frFR game names.
    neutral: 'L’Hôtel des ventes neutre (Baie-du-Butin, Gadgetzan, Long-guet)',
    note: 'Les prix arrivent de Blizzard une fois par heure. Twinmap télécharge environ 350 Ko pour votre Hôtel des ventes ; rien sur vous n’est envoyé.',
    show: 'Afficher les prix',
    follow: 'Suivre mon personnage',
    cancel: 'Annuler',
  },
  errors: {
    noHouse: 'Cet Hôtel des ventes n’a pas de prix.',
    answered: 'prices.twinmap.app a répondu {status}.',
    notPrices: 'prices.twinmap.app a envoyé autre chose que des prix.',
    unreachable: 'Twinmap n’a pas pu joindre prices.twinmap.app.',
  },

  wait: {
    noPrices: 'Pas encore de prix',
    noEarlier: 'Twinmap n’a aucun prix plus ancien à afficher pour cet Hôtel des ventes.',
    worksAsBefore: 'Tout le reste de Twinmap fonctionne comme avant.',
    again: 'Réessayer',
    getting: 'Récupération des prix',
    // {house} first: "de HV" reads badly.
    of: '{house}, depuis prices.twinmap.app.',
  },

  nav: {
    yours: 'À vous',
    mine: 'Mes objets',
    alerts: 'Alertes',
    categories: 'Catégories',
    all: 'Tous les objets',
  },

  page: {
    // After a colon: "à" would need "aux" or "au" before some category names.
    back: 'Retour : {place}',
    theSearch: 'la recherche',
    requiresLevel: 'niveau {level} requis',
    itemLevel: 'niveau d’objet {level}',
    lowest: 'Plus bas',
    typical: 'Habituel',
    available: 'Disponible',
    // What a vendor gives is the game's sell price (GlobalStrings SELL_PRICE).
    vendorGives: 'Prix de vente',
    onSale: 'En vente, le moins cher d’abord',
    priceEach: 'Prix unitaire',
    howMany: 'Quantité',
    upToHere: 'Cumul',
    costUpToHere: 'Coût cumulé',
    asAt: 'État de l’Hôtel des ventes à {time}. Les prix sont unitaires ; ce qui est en vente maintenant peut différer.',
    youHave: 'Vous possédez',
    have: '{count} · {who}, {place}',
    // Our choice: an item with no bonuses.
    plain: 'sans bonus',
    otherKind: '({kind})',
    none: 'Aucun, sur tous vos personnages de cet Hôtel des ventes',
    disenchant: 'Si vous le désenchantez',
    expected: 'Attendu',
    best: 'Meilleur',
    notAllOnSale: 'pas tout en vente',
    disenchantIt: 'le désenchanter',
    sellIt: 'le vendre à l’HV',
    vendorIt: 'le vendre au marchand',
    draws: '{draws}, aux prix les plus bas de {time}.',
    // French writes a narrow space before %.
    draw: '{item} {count} ({chance} %)',
    alert: 'Alerte',
    whenLowest: 'Quand le prix le plus bas {when}',
    silver: '{field} argent',
    priceLabel: 'Prix en argent',
    now: 'actuellement {price}',
    appearsNote: 'Quand il est de nouveau en vente, après une heure sans aucune offre.',
    // Our choice: "variante" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: 'Cette variante uniquement ({kind})',
    inGame: 'Me prévenir aussi dans le jeu',
    alertSet: 'Alerte créée. {see}',
    seeAlerts: 'Voir les alertes',
    setAlert: 'Créer l’alerte',
    checked: 'Vérification toutes les heures tant que Twinmap est ouvert.',
    playFirst: 'Jouez avec un personnage ayant l’addon activé pour lui créer des alertes.',
    findInGame: 'Le trouver dans le jeu',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: 'Copier',
    copied: 'Copié',
  },
  when: {
    below: 'passe sous',
    above: 'passe au-dessus de',
    appears: 'apparaît',
  },

  alerts: {
    item: 'Objet',
    // The column reads with its cells: "Prix le plus bas | passe sous 1o".
    whenLowest: 'Prix le plus bas',
    now: 'Actuel',
    state: 'État',
    inGame: 'Dans le jeu',
    anyKind: 'toute variante',
    below: 'passe sous {price}',
    above: 'passe au-dessus de {price}',
    notOnSale: 'pas en vente',
    // Feminine: an alert.
    met: 'Atteinte à {time}',
    metAt: 'Atteinte à {time}, {price}',
    waiting: 'en attente',
    sent: 'envoyée',
    on: 'oui',
    off: 'non',
    remove: 'Supprimer',
    none: 'Aucune alerte dans cet Hôtel des ventes pour l’instant. Ouvrez un objet et créez-en une à droite de sa page.',
    // "Maintenant" and "Attention" must match the French names of the tab Now and its part Attention (fr/app.ts).
    note: 'Les alertes sont vérifiées toutes les heures, à l’arrivée des nouveaux prix, seulement tant que Twinmap est ouvert. Une alerte atteinte s’affiche ici, dans Maintenant sous Attention, et dans le jeu si vous le choisissez.',
  },

  mine: {
    worthAh: 'Valeur à l’HV',
    atVendor: 'Chez un marchand',
    notOnSale: 'Pas en vente',
    items: { one: '{count} objet', many: '{count} d’objets', other: '{count} objets' },
    where: 'Où',
    everything: 'Tout',
    colItem: 'Objet',
    colWhere: 'Où',
    colHowMany: 'Quantité',
    colLowestEach: 'Plus bas unitaire',
    colAh: 'À l’HV',
    colVendor: 'Marchand',
    colBetter: 'Meilleur',
    better: {
      ah: 'HV',
      vendor: 'Marchand',
    },
    notOnSaleRow: 'pas en vente',
    none: 'Aucun personnage de cet Hôtel des ventes pour l’instant. Jouez-en un avec l’addon Twinmap Forever activé, et ses sacs s’afficheront ici.',
    betterNote: '« Meilleur » tient compte des 5 % que garde l’Hôtel des ventes ; le dépôt n’est pas compté.',
    // Rewritten around "royaume supposé" so no adjective agrees with the characters (who may be women).
    guessed: {
      one: '{names} : royaume supposé {region} {ruleset}, que le jeu n’a pas encore indiqué pour ce personnage.',
      many: '{names} : royaume supposé {region} {ruleset}, que le jeu n’a pas encore indiqué pour ces personnages.',
      other: '{names} : royaume supposé {region} {ruleset}, que le jeu n’a pas encore indiqué pour ces personnages.',
    },
  },
  place: {
    bags: 'Sacs',
    bank: 'Banque',
    worn: 'Équipé',
  },
  held: {
    bags: 'sacs',
    bank: 'banque',
    worn: 'équipé',
  },

  browse: {
    name: 'Nom',
    lowest: 'Plus bas',
    typical: 'Habituel',
    available: 'Disponible',
    vendor: 'Marchand',
    hours: '24 h',
    kinds: { one: '{count} variante', many: '{count} de variantes', other: '{count} variantes' },
    from: 'dès',
    plainRow: '(sans bonus)',
    // "dans la catégorie" so {category} never follows "dans les" or "dans l’".
    nothing: {
      typed: 'Rien en vente ne correspond à « {typed} ».',
      typedIn: 'Rien en vente ne correspond à « {typed} » dans la catégorie {category}.',
      filters: 'Rien en vente ne correspond à ces filtres.',
      filtersIn: 'Rien en vente ne correspond à ces filtres dans la catégorie {category}.',
    },
    more: 'Afficher {count} de plus sur {total}',
  },

  foot: {
    attribution: '{source}, via l’API Battle.net. Twinmap n’est ni affilié à Blizzard ni approuvé par Blizzard.',
    source: 'Données de l’Hôtel des ventes : Blizzard Entertainment',
    approximate: 'Les quantités sont approximatives',
  },

  chart: {
    label24h: 'Prix sur les dernières 24 heures',
    label7d: 'Prix sur les 7 derniers jours',
    emptyHours: 'aucun prix encore collecté pour ces heures',
    emptyDays: 'aucun prix encore collecté pour ces jours',
    pointHour: '{time} : habituel {typical}, plus bas {lowest}, {count} en vente',
    pointDay: '{time} : habituel {typical}, plus bas {lowest}, {count} en vente (moyenne de ses heures)',
    today: 'auj.',
    // The game's coin letters (GlobalStrings GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}o',
      silver: '{amount}a',
      copper: '{amount}c',
    },
    typical: 'Prix habituel (médiane)',
    lowest: 'Plus bas',
    available: 'Disponible',
    range: 'Période du graphique',
    hours: '24 h',
    days: '7 jours',
    noteHours: 'Seuls les prix réellement collectés sont tracés : un point par heure. Les courbes s’allongent à partir de là.',
    noteDays: 'Seuls les prix réellement collectés sont tracés : un point par jour, le plus bas du jour et la moyenne de ses heures. Les courbes s’allongent à partir de là.',
  },
}
