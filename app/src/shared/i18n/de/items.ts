// Das Deutsch von items: the notes on every key are in en/items.ts.
export default {
  unknownItem: 'Gegenstand {id}',
  unknownSpell: 'Zauber {id}',

  // "vor ..." reads before "gesehen", after "Stand:", "Aufgenommen:" and alone in the character list.
  ago: {
    justNow: 'gerade eben',
    minutes: { one: 'vor {count} Minute', other: 'vor {count} Minuten' },
    hours: { one: 'vor {count} Stunde', other: 'vor {count} Stunden' },
    days: { one: 'vor {count} Tag', other: 'vor {count} Tagen' },
    weeks: { one: 'vor {count} Woche', other: 'vor {count} Wochen' },
  },

  places: {
    bags: 'Taschen',
    bank: 'Bank',
    // GS EQUIPPED.
    worn: 'Ausgerüstet',
    // GS KEYRING.
    keyring: 'Schlüsselbund',
  },

  types: {
    weaponOf: 'Waffe · {kind}',
    armorOf: 'Rüstung · {kind}',
    // GS OTHER.
    unknown: 'Anderes',
    // ItemClass deDE; gem, money, item enhancement and permanent are obsolete in Forever's table: the retail names, and GS MONEY.
    classes: {
      consumable: 'Verbrauchbar',
      container: 'Behälter',
      weapon: 'Waffe',
      gem: 'Edelstein',
      armor: 'Rüstung',
      reagent: 'Reagenz',
      projectile: 'Projektil',
      tradeGoods: 'Handwerkswaren',
      itemEnhancement: 'Gegenstandsverbesserung',
      recipe: 'Rezept',
      money: 'Geld',
      quiver: 'Köcher',
      quest: 'Quest',
      key: 'Schlüssel',
      permanent: 'Permanent',
      miscellaneous: 'Verschiedenes',
    },
    // ItemSubClass 2.x DisplayName deDE.
    weapons: {
      axe: 'Axt',
      bow: 'Bogen',
      gun: 'Schusswaffe',
      mace: 'Streitkolben',
      polearm: 'Stangenwaffe',
      sword: 'Schwert',
      warglaive: 'Kriegsgleven',
      staff: 'Stab',
      // The game's own name for subclasses 11 and 12.
      exotic: 'Exotika',
      fistWeapon: 'Faustwaffe',
      miscellaneous: 'Verschiedenes',
      dagger: 'Dolch',
      thrown: 'Wurfwaffe',
      spear: 'Speer',
      crossbow: 'Armbrust',
      wand: 'Zauberstab',
      fishingPole: 'Angel',
    },
    // ItemSubClass 4.x DisplayName deDE (mail is "Schwere Rüstung" in the game); sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: 'Verschiedenes',
      cloth: 'Stoff',
      leather: 'Leder',
      mail: 'Schwere Rüstung',
      plate: 'Platte',
      cosmetic: 'Kosmetisch',
      shield: 'Schild',
      libram: 'Buchband',
      idol: 'Götze',
      totem: 'Totem',
      sigil: 'Siegel',
      relic: 'Relikt',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT), the long ones rewritten to fit 44px.
  slots: {
    head: 'Kopf',
    neck: 'Hals',
    // GS INVTYPE_SHOULDER: "Schultern" does not fit.
    shoulder: 'Schulter',
    back: 'Rücken',
    chest: 'Brust',
    shirt: 'Hemd',
    // GS TABARDSLOT "Wappenrock" does not fit.
    tabard: 'Wappen',
    // GS WRISTSLOT "Handgelenke" does not fit: the arms, where the bracers go.
    wrist: 'Gelenke',
    hands: 'Hände',
    waist: 'Taille',
    legs: 'Beine',
    feet: 'Füße',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: 'Finger',
    trinket: 'Schmuck',
    // GS MAINHANDSLOT "Waffenhand" and SECONDARYHANDSLOT "Schildhand", without "hand".
    mainHand: 'Waffe',
    offHand: 'Schild',
    // GS INVTYPE_RANGED.
    ranged: 'Distanz',
  },

  character: {
    // As the game's tooltip: "Stufe 24 Gnom Hexenmeister".
    line: 'Stufe {level} {race} {class}',
    kind: '{race} {class}',
  },
  races: {
    human: 'Mensch',
    orc: 'Orc',
    dwarf: 'Zwerg',
    nightElf: 'Nachtelf',
    undead: 'Untoter',
    tauren: 'Tauren',
    gnome: 'Gnom',
    troll: 'Troll',
  },
  classes: {
    warrior: 'Krieger',
    paladin: 'Paladin',
    hunter: 'Jäger',
    rogue: 'Schurke',
    priest: 'Priester',
    shaman: 'Schamane',
    mage: 'Magier',
    warlock: 'Hexenmeister',
    druid: 'Druide',
  },
  classesAll: {
    warrior: 'Krieger',
    paladin: 'Paladine',
    hunter: 'Jäger',
    rogue: 'Schurken',
    priest: 'Priester',
    shaman: 'Schamanen',
    mage: 'Magier',
    warlock: 'Hexenmeister',
    druid: 'Druiden',
  },

  page: {
    noCharacter: 'Noch kein Charakter. Spielt einen mit aktiviertem Addon Twinmap Forever, dann erscheinen seine Taschen hier, auch bei geschlossenem Spiel.',
    filter: 'Nach Name oder Typ filtern',
    filterLabel: 'Gegenstände filtern',
    viewLabel: 'Ansicht',
    whereLabel: 'Ort',
    // A switch half, short: bag slots are "Plätze" in the game (GS CONTAINER_SLOTS).
    slots: 'Plätze',
    table: 'Liste',
    all: 'Alle',
    // Each part as "label: amount", like the game's "Geld:" (GS MONEY_COLON).
    worth: 'Verkaufswert: {money}',
    auction: 'Auktionshaus: {money}',
    money: 'Geld: {money}',
  },

  doll: {
    label: 'Ausgerüstet',
    // The game's window is "Charakterinfo" (GS CHARACTER_BUTTON).
    open: 'Öffnet im Spiel die Charakterinfo',
    keyHint: '{key}, falls Ihr die Taste nicht geändert habt',
    waitNote: 'Das Bild wird aufgenommen, sobald das Fenster offen ist und nichts den Charakter verdeckt.',
    cancel: 'Abbrechen',
    save: 'Speichern…',
    retake: 'Neues Bild',
    taken: 'Aufgenommen: {ago}',
    none: 'Noch kein Bild von {name}',
    noneNote: 'Öffnet im Spiel die Charakterinfo, dann wird es von selbst aufgenommen.',
  },

  held: {
    label: 'Taschen und Bank',
    bags: 'Taschen',
    bagsNow: 'aktuell',
    bagsAsOf: 'Stand: {ago}',
    bank: 'Bank',
    bankSeen: '{ago} gesehen',
    bankUnseen: 'noch nicht gesehen: öffnet sie einmal im Spiel',
    // GS BAG_NAME_BACKPACK "Rucksack"; ItemSubClass 1.11 "Reagenzientasche".
    backpack: 'Rucksack und Taschen',
    reagents: 'Reagenzientasche',
    keyring: 'Schlüsselbund',
    bankBags: 'Bank und ihre Taschen',
    used: '{used} von {count} belegt',
    // GS CONTAINER_SLOTS "Platz".
    empty: { one: 'leer · {count} Platz', other: 'leer · {count} Plätze' },
  },

  table: {
    columns: {
      item: 'Gegenstand',
      character: 'Charakter',
      type: 'Typ',
      where: 'Ort',
      qty: 'Anz.',
      value: 'Wert',
      auction: 'Im AH',
    },
    nothingLike: '{name} hat nichts, das zu "{typed}" passt.',
    nothing: 'Hier ist nichts.',
    bagsNow: 'Taschen: aktuell',
    bagsAsOf: 'Taschen, Stand: {ago}',
    bankSeen: 'Bank: zuletzt geöffnet {ago}',
    bankUnseen: 'Bank noch nicht gesehen: öffnet sie einmal im Spiel',
  },

  others: {
    title: 'Andere Charaktere',
    where: 'auf diesem PC gespeichert',
    show: '{name} anzeigen',
    seen: '{name}: {ago} gesehen',
  },

  popup: {
    sellPrice: 'Verkaufspreis: {price}',
    auction: 'Auktionshaus: {price}',
    // GS AUCTION_PRICE_PER_ITEM "pro Einheit".
    each: '({price} pro Einheit)',
    notOnSale: 'Auktionshaus: nicht im Angebot',
    // After a first name; "es" for the thing, whatever the item's gender.
    wears: 'trägt es',
    inBags: '{count} in den Taschen',
    inBank: '{count} in der Bank',
    noneHeld: 'Keiner Eurer Charaktere besitzt diesen Gegenstand',
    // The NPC after a colon: GS MERCHANT.
    soldBy: 'Händler: {npc}',
    soldByIn: 'Händler: {npc}, {zone}',
    perPack: '{price} für {count}',
    moreVendors: { one: 'und {count} weiterer Händler', other: 'und {count} weitere Händler' },
    // Like the game's "Bossbeute: %s" (GS WARDROBE_TOOLTIP_BOSS_DROP_FORMAT).
    dropsFrom: 'Beute: {npc}',
    dropsFromIn: 'Beute: {npc}, {zone}',
    moreDrops: { one: 'und {count} weiterer', other: 'und {count} weitere' },
    // Object names come without an article ("Robuste Truhe"): after a colon.
    foundIn: 'Fundort: {object}',
    foundInIn: 'Fundort: {object}, {zone}',
  },

  npc: {
    // "Verkauft {count}" would read as a past participle: the count after a colon.
    sells: 'Angebot: {count}',
    subSells: '{sub} · Angebot: {count}',
    // The profession after a colon, like every game name.
    notLearned: 'Beruf noch nicht erlernt: {profession}',
    teaches: 'Nur für {classes}.',
    teachesPick: 'Nur für {classes}: Wählt einen Charakter, um zu sehen, was er lernen kann.',
    // GS AVAILABLE "Verfügbar": what can be learned now.
    learnNow: 'Verfügbar · {count}',
    atLevel: 'Stufe {level}',
    // GS SKILL "Fertigkeit".
    atSkill: 'Fertigkeit {skill}',
    // GS TRADESKILL_NEXT_RANK_HEADER.
    nextRank: 'Nächster Rang',
    sellsHeading: 'Angebot · {count}',
    rank: 'Rang {rank}',
    nextNeeds: 'Fertigkeit {skill}, Stufe {level}',
    talent: 'Talent',
    quest: 'Quest',
    questTaught: 'Erlernt durch die Quest {quest}',
    classQuest: 'Erlernt durch eine Klassenquest',
    columns: {
      item: 'Gegenstand',
      price: 'Preis',
      ah: 'AH',
      bags: 'Taschen',
      bank: 'Bank',
    },
    ahNote: 'Der niedrigste Preis im Auktionshaus, für dieselbe Menge',
    ahPrice: 'AH {price}',
    known: 'Bekannt · {count}',
    show: 'Anzeigen',
    hide: 'Ausblenden',
    noCharacter: 'Noch kein Charakter: Spielt einen mit aktiviertem Addon Twinmap Forever.',
    // The profession is opened like a spell ("öffnet Schmiedekunst"): no "Fenster" before the game name.
    recipesRead: '{name} · Rezepte vom letzten Öffnen von {profession}',
    recipesUnread: '{name} · öffnet einmal {profession} im Spiel, um die bekannten Rezepte zu sehen',
    spellsNow: '{name}, Stufe {level} · aktuelle Zauber',
    spellsAsOf: '{name}, Stufe {level} · Zauber {ago} gesehen',
    bankSeen: 'Bank {ago} gesehen · {name}',
    bankUnseen: 'Bank noch nicht gesehen: öffnet sie einmal im Spiel · {name}',
  },

  picker: {
    inGame: 'Im Spiel',
    seen: '{ago} gesehen',
    list: 'Charaktere',
    forget: 'Vergessen',
    note: 'Auf diesem Computer gespeichert, aus dem, was das Addon beim Spielen gemeldet hat. Klickt mit der rechten Maustaste auf einen Charakter, um ihn zu vergessen.',
  },

  resize: 'Ziehen, um die Breite zu ändern',
}
