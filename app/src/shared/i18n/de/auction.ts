// Das Deutsch von auction: the notes on every key are in en/auction.ts.
export default {
  unknownItem: 'Gegenstand {id}',

  house: {
    // "AH", the short form the game and its players use, to keep the button short.
    line: 'AH {number} · {side} · {ruleset}',
    // Our choice: the game names no "ruleset"; the realm list calls it the type (GS REALM_TYPE "Typ").
    unknownRuleset: 'Realmtyp {id}',
  },
  side: {
    alliance: 'Allianz',
    horde: 'Horde',
    neutral: 'Neutral',
  },
  ruleset: {
    normal: 'Normal',
    pvp: 'PvP',
    roleplay: 'Rollenspiel',
    roleplayPvp: 'Rollenspiel-PvP',
  },
  category: {
    noClass: 'Sonstiges',
    // Our choice: "Klasse" would read as a character class (GS CATEGORY, SUBCATEGORY).
    unknownClass: 'Kategorie {id}',
    unknownSub: 'Unterkategorie {id}',
  },
  // The game's slot names (GlobalStrings INVTYPE_*).
  slot: {
    head: 'Kopf',
    neck: 'Hals',
    shoulder: 'Schulter',
    shirt: 'Hemd',
    chest: 'Brust',
    waist: 'Taille',
    legs: 'Beine',
    feet: 'Füße',
    wrist: 'Handgelenke',
    hands: 'Hände',
    finger: 'Finger',
    trinket: 'Schmuck',
    offHand: 'Schildhand',
    back: 'Rücken',
    tabard: 'Wappenrock',
    heldInOffHand: 'In Schildhand geführt',
    relic: 'Relikt',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name. Shorter than the English.
    searchPlaceholder: 'Name suchen, oder "genauer Name"',
    searchLabel: 'Im Auktionshaus suchen',
    filters: 'Filter',
    filtersOn: 'Filter · {count}',
    prices: 'Preise',
    // GS AUCTION_PRICE_PER_ITEM "pro Einheit", AUCTION_PRICE_PER_STACK "pro Stapel".
    perUnit: 'Pro Einheit',
    perStack: 'Pro Stapel',
    pricesOf: 'Preise von {time}',
    notUpdated: '{age}, nicht aktualisiert',
    nextAround: 'nächste gegen {time}',
  },
  // "Min." and "Std." are the game's abbreviations (GS MINUTES_ABBR, HOURS_ABBR).
  age: {
    minutes: { one: 'vor {count} Min.', other: 'vor {count} Min.' },
    hours: { one: 'vor {count} Std.', other: 'vor {count} Std.' },
    days: { one: 'vor {count} Tag', other: 'vor {count} Tagen' },
  },
  filters: {
    level: 'Stufe {from} bis {to}',
    from: 'von',
    to: 'bis',
    quality: 'Qualität',
    any: 'Alle',
    atLeast: {
      poor: 'Schlecht oder besser',
      common: 'Verbreitet oder besser',
      uncommon: 'Selten oder besser',
      rare: 'Rar oder besser',
      epic: 'Episch oder besser',
      legendary: 'Legendär oder besser',
    },
    lowestPrice: 'Tiefstpreis {from} bis {to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's K for copper.
    priceExample: 'z. B. 1g 50s',
    clear: 'Löschen',
  },

  choose: {
    title: 'Welches Auktionshaus?',
    intro: 'Twinmap zeigt die Preise des Auktionshauses, in dem Euer Charakter verkauft.',
    // "vom Typ" so that every ruleset reads right after "Realm", in bold on its own.
    told: 'Laut Spiel spielt {who} auf einem Realm vom Typ {ruleset}.',
    // "spielt Allianz", as players say it.
    toldSide: 'Laut Spiel spielt {who} {side} auf einem Realm vom Typ {ruleset}.',
    region: 'Region',
    readFromGame: '(aus dem Spiel gelesen)',
    // The towns by their deDE game names, which are the English ones (GS POSTMASTER_LETTER_*).
    neutral: 'Das neutrale Auktionshaus (Booty Bay, Gadgetzan, Everlook)',
    note: 'Die Preise kommen einmal pro Stunde von Blizzard. Twinmap lädt etwa 350 KB für Euer Auktionshaus herunter; über Euch wird nichts gesendet.',
    show: 'Preise anzeigen',
    follow: 'Meinem Charakter folgen',
    cancel: 'Abbrechen',
  },
  errors: {
    noHouse: 'Für dieses Auktionshaus gibt es keine Preise.',
    answered: 'prices.twinmap.app hat mit {status} geantwortet.',
    notPrices: 'prices.twinmap.app hat etwas anderes als Preise gesendet.',
    unreachable: 'Twinmap konnte prices.twinmap.app nicht erreichen.',
  },

  wait: {
    noPrices: 'Noch keine Preise',
    noEarlier: 'Twinmap hat keine älteren Preise dieses Auktionshauses zum Anzeigen.',
    worksAsBefore: 'Alles andere in Twinmap funktioniert wie bisher.',
    again: 'Erneut versuchen',
    getting: 'Preise werden geladen',
    of: 'Für {house}, von prices.twinmap.app.',
  },

  nav: {
    yours: 'Eigenes',
    mine: 'Meine Gegenstände',
    alerts: 'Alarme',
    categories: 'Kategorien',
    all: 'Alle Gegenstände',
  },

  page: {
    // After a colon: "zu" would need "zur" or "zum" before some category names.
    back: 'Zurück: {place}',
    theSearch: 'Suche',
    notOnSale: 'Derzeit in diesem Auktionshaus nicht im Angebot.',
    // GS ITEM_MIN_LEVEL, lowercase after the dot.
    requiresLevel: 'benötigt Stufe {level}',
    itemLevel: 'Gegenstandsstufe {level}',
    lowest: 'Tiefstpreis',
    typical: 'Üblich',
    available: 'Verfügbar',
    // What a vendor gives is the game's sell price (GS SELL_PRICE).
    vendorGives: 'Verkaufspreis',
    onSale: 'Jetzt im Angebot, günstigste zuerst',
    // GS AUCTION_HOUSE_HEADER_UNIT_PRICE.
    priceEach: 'Preis/Einheit',
    howMany: 'Anzahl',
    upToHere: 'Bis hier',
    costUpToHere: 'Kosten bis hier',
    asAt: 'Stand des Auktionshauses um {time}. Die Preise gelten pro Einheit; das aktuelle Angebot kann abweichen.',
    youHave: 'Ihr habt',
    have: '{count} · {who}, {place}',
    // Our choice: an item with no bonuses.
    plain: 'ohne Boni',
    otherKind: '({kind})',
    none: 'Keine, auf keinem Charakter dieses Auktionshauses',
    disenchant: 'Wenn Ihr es entzaubert',
    expected: 'Erwartet',
    // Reads with the line under it: "Am besten: entzaubern".
    best: 'Am besten',
    notAllOnSale: 'nicht alles im Angebot',
    disenchantIt: 'entzaubern',
    sellIt: 'im AH verkaufen',
    vendorIt: 'beim Händler verkaufen',
    draws: '{draws}, zu den Tiefstpreisen von {time}.',
    // de-DE writes a no-break space before %, as Intl does.
    draw: '{item} {count} ({chance} %)',
    alert: 'Alarm',
    // A main clause, not "Wenn der Tiefstpreis ...": after "wenn" German puts the verb last, and the price field follows.
    whenLowest: 'Tiefstpreis {when}',
    silver: '{field} Silber',
    priceLabel: 'Preis in Silber',
    now: 'aktuell {price}',
    appearsNote: 'Sobald es wieder angeboten wird, nach einer Stunde ohne Angebot.',
    // Our choice: "Variante" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: 'Nur diese Variante ({kind})',
    inGame: 'Auch im Spiel benachrichtigen',
    alertSet: 'Alarm gesetzt. {see}',
    seeAlerts: 'Alarme ansehen',
    setAlert: 'Alarm setzen',
    checked: 'Wird stündlich geprüft, solange Twinmap geöffnet ist.',
    playFirst: 'Spielt einen Charakter mit aktivem Addon, um Alarme für ihn zu setzen.',
    findInGame: 'Im Spiel finden',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: 'Kopieren',
    copied: 'Kopiert',
  },
  // Main clause after page.whenLowest: "Tiefstpreis fällt unter [5] Silber".
  when: {
    below: 'fällt unter',
    above: 'steigt über',
    appears: 'taucht wieder auf',
  },

  alerts: {
    item: 'Gegenstand',
    // The column reads with its cells: "Tiefstpreis | fällt unter 1G".
    whenLowest: 'Tiefstpreis',
    now: 'Aktuell',
    state: 'Status',
    inGame: 'Im Spiel',
    anyKind: 'jede Variante',
    below: 'fällt unter {price}',
    above: 'steigt über {price}',
    notOnSale: 'nicht im Angebot',
    met: 'Erreicht um {time}',
    metAt: 'Erreicht um {time}, {price}',
    waiting: 'wartet',
    sent: 'gesendet',
    on: 'an',
    off: 'aus',
    remove: 'Entfernen',
    none: 'Noch keine Alarme in diesem Auktionshaus. Öffnet einen Gegenstand und setzt rechts auf seiner Seite einen.',
    // "Jetzt" and "Achtung" must match the names of the tab Now and its part Attention (de/app.ts).
    note: 'Alarme werden stündlich beim Eintreffen neuer Preise geprüft, nur solange Twinmap geöffnet ist. Ein erreichter Alarm erscheint hier, in Jetzt unter Achtung und, wenn Ihr es wählt, im Spiel.',
  },

  mine: {
    worthAh: 'Wert im AH',
    atVendor: 'Beim Händler',
    notOnSale: 'Nicht im Angebot',
    items: { one: '{count} Gegenstand', other: '{count} Gegenstände' },
    where: 'Wo',
    everything: 'Alles',
    colItem: 'Gegenstand',
    colWhere: 'Wo',
    colHowMany: 'Anzahl',
    // "Stückpreis": the price of one, shorter than "Tiefster Preis/Einheit"; the lowest is what the list shows.
    colLowestEach: 'Stückpreis',
    colAh: 'Im AH',
    colVendor: 'Händler',
    colBetter: 'Besser',
    better: {
      ah: 'AH',
      vendor: 'Händler',
    },
    notOnSaleRow: 'nicht im Angebot',
    none: 'Noch kein Charakter in diesem Auktionshaus. Spielt einen mit aktivem Addon Twinmap Forever, dann erscheinen hier seine Taschen.',
    // "Anzahlung" as the game's auction house error (GS AUCTION_HOUSE_SELL_FRAME_ERROR_DEPOSIT).
    betterNote: '"Besser" rechnet die 5 % ein, die das Auktionshaus einbehält; die Anzahlung nicht.',
    // Rewritten so nothing agrees with the characters.
    guessed: {
      one: '{names}: gezählt als Realm {region} {ruleset}; das Spiel hat ihn für diesen Charakter noch nicht gemeldet.',
      other: '{names}: gezählt als Realm {region} {ruleset}; das Spiel hat ihn für diese Charaktere noch nicht gemeldet.',
    },
  },
  // GS HUD_EDIT_MODE_BAGS_LABEL, BANK, EQUIPPED.
  place: {
    bags: 'Taschen',
    bank: 'Bank',
    worn: 'Ausgerüstet',
  },
  held: {
    bags: 'Taschen',
    bank: 'Bank',
    worn: 'ausgerüstet',
  },

  browse: {
    name: 'Name',
    lowest: 'Tiefstpreis',
    typical: 'Üblich',
    available: 'Verfügbar',
    vendor: 'Händler',
    hours: '24 Std.',
    kinds: { one: '{count} Variante', other: '{count} Varianten' },
    from: 'ab',
    plainRow: '(ohne Boni)',
    // "in der Kategorie" so {category} never needs an article of its own.
    nothing: {
      typed: 'Nichts im Angebot passt zu "{typed}".',
      typedIn: 'Nichts im Angebot passt zu "{typed}" in der Kategorie {category}.',
      filters: 'Nichts im Angebot passt zu diesen Filtern.',
      filtersIn: 'Nichts im Angebot passt zu diesen Filtern in der Kategorie {category}.',
    },
    more: '{count} weitere von {total} anzeigen',
  },

  foot: {
    attribution: '{source}, über die Battle.net-API. Twinmap ist weder mit Blizzard verbunden noch von Blizzard unterstützt.',
    source: 'Auktionsdaten: Blizzard Entertainment',
    approximate: 'Mengen sind Näherungswerte',
    hide: 'Diese Zeile ausblenden',
  },

  chart: {
    label24h: 'Preise der letzten 24 Stunden',
    label7d: 'Preise der letzten 7 Tage',
    emptyHours: 'für diese Stunden noch keine Preise gesammelt',
    emptyDays: 'für diese Tage noch keine Preise gesammelt',
    pointHour: '{time}: üblich {typical}, Tiefstpreis {lowest}, {count} im Angebot',
    pointDay: '{time}: üblich {typical}, Tiefstpreis {lowest}, {count} im Angebot (Mittel seiner Stunden)',
    today: 'heute',
    // The game's coin letters (GS GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}G',
      silver: '{amount}S',
      copper: '{amount}K',
    },
    typical: 'Üblicher Preis (Median)',
    lowest: 'Tiefstpreis',
    available: 'Verfügbar',
    range: 'Zeitraum des Diagramms',
    hours: '24 Std.',
    days: '7 Tage',
    noteHours: 'Gezeichnet werden nur wirklich gesammelte Preise: ein Punkt pro Stunde. Von dort aus wachsen die Linien.',
    noteDays: 'Gezeichnet werden nur wirklich gesammelte Preise: ein Punkt pro Tag, der Tiefstpreis des Tages und das Mittel seiner Stunden. Von dort aus wachsen die Linien.',
  },
}
