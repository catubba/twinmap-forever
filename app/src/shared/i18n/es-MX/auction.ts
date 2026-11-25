// El español de Latinoamérica de la casa de subastas: the notes on every key are in en/auction.ts.
export default {
  unknownItem: 'Objeto {id}',

  house: {
    // "Subastas" (GS AUCTIONS): the game has no short form of "Casa de subastas", and the button is narrow.
    line: 'Subastas {number} · {side} · {ruleset}',
    // Our choice: the game names no "ruleset"; the realm list calls it the type (GS REALM_TYPE).
    unknownRuleset: 'Tipo de reino {id}',
  },
  side: {
    alliance: 'Alianza',
    horde: 'Horda',
    neutral: 'Neutral',
  },
  ruleset: {
    normal: 'Normal',
    pvp: 'JcJ',
    roleplay: 'Rol',
    roleplayPvp: 'Rol JcJ',
  },
  category: {
    noClass: 'Otros',
    // Our choice: "Clase" would read as a character class.
    unknownClass: 'Categoría {id}',
    unknownSub: 'Subcategoría {id}',
  },
  // The game's slot names (GlobalStrings INVTYPE_*).
  slot: {
    head: 'Cabeza',
    neck: 'Cuello',
    shoulder: 'Hombro',
    shirt: 'Camisa',
    chest: 'Pecho',
    waist: 'Cintura',
    legs: 'Piernas',
    feet: 'Pies',
    wrist: 'Muñeca',
    hands: 'Manos',
    finger: 'Dedo',
    trinket: 'Abalorio',
    offHand: 'Mano izquierda',
    back: 'Espalda',
    tabard: 'Tabardo',
    heldInOffHand: 'Sostener con la mano izquierda',
    relic: 'Reliquia',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name. Shorter than the English.
    searchPlaceholder: 'Buscar un nombre o "un nombre exacto"',
    searchLabel: 'Buscar en la casa de subastas',
    filters: 'Filtros',
    filtersOn: 'Filtros · {count}',
    prices: 'Precios',
    // GS AUCTION_PRICE_PER_ITEM "por unidad"; Stack as the glossary.
    perUnit: 'Por unidad',
    perStack: 'Por montón',
    pricesOf: 'Precios de las {time}',
    notUpdated: '{age}, sin actualizar',
    nextAround: 'próximos alrededor de las {time}',
  },
  // "min" and "h" are the game's abbreviations (GS MINUTES_ABBR, HOURS_ABBR).
  age: {
    minutes: { one: 'hace {count} min', many: 'hace {count} min', other: 'hace {count} min' },
    hours: { one: 'hace {count} h', many: 'hace {count} h', other: 'hace {count} h' },
    days: { one: 'hace {count} día', many: 'hace {count} días', other: 'hace {count} días' },
  },
  filters: {
    level: 'Nivel {from} a {to}',
    from: 'desde',
    to: 'hasta',
    quality: 'Calidad',
    // Feminine, as "calidad".
    any: 'Todas',
    atLeast: {
      poor: 'Pobre o superior',
      common: 'Común o superior',
      uncommon: 'Inusual o superior',
      rare: 'Raro o superior',
      epic: 'Épico o superior',
      legendary: 'Legendario o superior',
    },
    lowestPrice: 'Precio mínimo {from} a {to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's o, p, c.
    priceExample: 'ej. 1g 50s',
    clear: 'Borrar',
  },

  choose: {
    title: '¿Qué casa de subastas?',
    intro: 'Twinmap muestra los precios de la casa de subastas donde vende tu personaje.',
    // "de tipo" so that every ruleset reads right after "reino".
    told: 'Según el juego, {who} juega en un reino de tipo {ruleset}.',
    toldSide: 'Según el juego, {who} juega en un reino de tipo {ruleset}, facción {side}.',
    region: 'Región',
    readFromGame: '(tomado del juego)',
    // The towns by their game names (GS POSTMASTER_LETTER_*).
    neutral: 'La casa de subastas neutral (Bahía del Botín, Gadgetzan, Vista Eterna)',
    note: 'Los precios llegan de Blizzard cada hora. Twinmap descarga unos 350 KB para tu casa de subastas; no se envía ningún dato tuyo.',
    show: 'Mostrar precios',
    follow: 'Seguir a mi personaje',
    cancel: 'Cancelar',
  },
  errors: {
    noHouse: 'Esta casa de subastas no tiene precios.',
    answered: 'prices.twinmap.app respondió con el código {status}.',
    notPrices: 'prices.twinmap.app envió algo que no son precios.',
    unreachable: 'Twinmap no pudo conectarse a prices.twinmap.app.',
  },

  wait: {
    noPrices: 'Todavía no hay precios',
    noEarlier: 'Twinmap no tiene precios anteriores de esta casa de subastas.',
    worksAsBefore: 'Todo lo demás de Twinmap funciona igual que antes.',
    again: 'Reintentar',
    getting: 'Obteniendo los precios',
    // {house} first: "De Subastas 2" reads badly.
    of: '{house}, desde prices.twinmap.app.',
  },

  nav: {
    yours: 'Lo tuyo',
    mine: 'Mis objetos',
    alerts: 'Alertas',
    categories: 'Categorías',
    all: 'Todos los objetos',
  },

  page: {
    // After a colon: a category name may start with an article.
    back: 'Volver: {place}',
    theSearch: 'búsqueda',
    notOnSale: 'Ahora no está a la venta en esta casa de subastas.',
    // GS ITEM_MIN_LEVEL, lowercase after the dot.
    requiresLevel: 'necesitas ser de nivel {level}',
    itemLevel: 'nivel de objeto {level}',
    lowest: 'Mínimo',
    typical: 'Habitual',
    available: 'Disponible',
    // What a vendor gives is the game's sell price (GS SELL_PRICE).
    vendorGives: 'Precio de venta',
    onSale: 'En venta, primero los más baratos',
    // GS AUCTION_HOUSE_HEADER_UNIT_PRICE.
    priceEach: 'Precio de la unidad',
    howMany: 'Cantidad',
    upToHere: 'Acumulado',
    costUpToHere: 'Costo acumulado',
    asAt: 'Así estaba la casa de subastas a las {time}. Los precios son por unidad; lo que está en venta ahora puede ser distinto.',
    youHave: 'Tienes',
    have: '{count} · {who}, {place}',
    // Our choice: an item with no bonuses.
    plain: 'sin bonificación',
    otherKind: '({kind})',
    none: 'Ninguno en tus personajes de esta casa de subastas',
    disenchant: 'Si lo desencantas',
    expected: 'Esperado',
    best: 'Mejor',
    notAllOnSale: 'no todo está en venta',
    disenchantIt: 'desencantarlo',
    sellIt: 'subastarlo',
    vendorIt: 'venderlo al mercader',
    draws: '{draws}, a los precios mínimos de las {time}.',
    draw: '{item} {count} ({chance}%)',
    alert: 'Alerta',
    whenLowest: 'Cuando el precio mínimo {when}',
    silver: '{field} plata',
    priceLabel: 'Precio en plata',
    now: 'ahora {price}',
    appearsNote: 'Cuando vuelva a estar en venta, después de una hora sin ninguno.',
    // Our choice: "variante" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: 'Solo esta variante ({kind})',
    inGame: 'Avisarme también en el juego',
    alertSet: 'Alerta creada. {see}',
    seeAlerts: 'Ver alertas',
    setAlert: 'Crear alerta',
    checked: 'Se revisa cada hora mientras Twinmap esté abierto.',
    playFirst: 'Juega con un personaje que tenga el addon activado para crearle alertas.',
    findInGame: 'Búscalo en el juego',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: 'Copiar',
    copied: 'Copiado',
  },
  // Subjunctive, after "Cuando el precio mínimo".
  when: {
    below: 'baje de',
    above: 'supere',
    appears: 'aparezca',
  },

  alerts: {
    item: 'Objeto',
    // The column reads with its cells: "Precio mínimo | baja de 1o".
    whenLowest: 'Precio mínimo',
    now: 'Ahora',
    state: 'Estado',
    inGame: 'En el juego',
    anyKind: 'cualquier variante',
    below: 'baja de {price}',
    above: 'supera {price}',
    notOnSale: 'sin subastas',
    // Feminine: an alert.
    met: 'Cumplida a las {time}',
    metAt: 'Cumplida a las {time}, {price}',
    waiting: 'en espera',
    sent: 'enviada',
    on: 'sí',
    off: 'no',
    remove: 'Quitar',
    none: 'Todavía no hay alertas en esta casa de subastas. Abre un objeto y crea una a la derecha de su página.',
    // "Ahora" and "Atención" must match the names of the tab Now and its part Attention (es-MX/app.ts).
    note: 'Las alertas se revisan cada hora, cuando llegan los precios nuevos, solo mientras Twinmap esté abierto. Una alerta cumplida aparece aquí, en Ahora bajo Atención, y en el juego si así lo eliges.',
  },

  mine: {
    worthAh: 'Valor en subasta',
    atVendor: 'Al mercader',
    notOnSale: 'Sin subastas ahora',
    items: { one: '{count} objeto', many: '{count} objetos', other: '{count} objetos' },
    where: 'Dónde',
    everything: 'Todo',
    colItem: 'Objeto',
    colWhere: 'Dónde',
    colHowMany: 'Cantidad',
    colLowestEach: 'Mín. por unidad',
    colAh: 'En subasta',
    colVendor: 'Mercader',
    colBetter: 'Mejor',
    // The game has no short form of "casa de subastas".
    better: {
      ah: 'Subasta',
      vendor: 'Mercader',
    },
    notOnSaleRow: 'sin subastas',
    none: 'Todavía no hay personajes de esta casa de subastas. Juega con uno que tenga activado el addon Twinmap Forever y sus bolsas aparecerán aquí.',
    betterNote: '"Mejor" toma en cuenta el 5% que se queda la casa de subastas; el depósito no se cuenta.',
    // Rewritten so no adjective agrees with the characters.
    guessed: {
      one: '{names}: se asume un reino {region} {ruleset}; el juego todavía no lo indica para este personaje.',
      many: '{names}: se asume un reino {region} {ruleset}; el juego todavía no lo indica para estos personajes.',
      other: '{names}: se asume un reino {region} {ruleset}; el juego todavía no lo indica para estos personajes.',
    },
  },
  place: {
    bags: 'Bolsas',
    bank: 'Banco',
    worn: 'Equipado',
  },
  held: {
    bags: 'bolsas',
    bank: 'banco',
    worn: 'equipado',
  },

  browse: {
    name: 'Nombre',
    lowest: 'Mínimo',
    typical: 'Habitual',
    available: 'Disponible',
    vendor: 'Mercader',
    hours: '24 h',
    kinds: { one: '{count} variante', many: '{count} variantes', other: '{count} variantes' },
    from: 'desde',
    plainRow: '(sin bonificación)',
    // "en la categoría" so {category} never follows "en el" or "en los".
    nothing: {
      typed: 'No hay nada en venta que coincida con "{typed}".',
      typedIn: 'No hay nada en venta que coincida con "{typed}" en la categoría {category}.',
      filters: 'No hay nada en venta que coincida con estos filtros.',
      filtersIn: 'No hay nada en venta que coincida con estos filtros en la categoría {category}.',
    },
    more: 'Mostrar {count} más de {total}',
  },

  foot: {
    attribution: '{source}, a través de la API de Battle.net. Twinmap no está afiliado a Blizzard ni respaldado por Blizzard.',
    source: 'Datos de subastas: Blizzard Entertainment',
    approximate: 'Las cantidades son aproximadas',
    hide: 'Ocultar esta línea',
  },

  chart: {
    label24h: 'Precios de las últimas 24 horas',
    label7d: 'Precios de los últimos 7 días',
    emptyHours: 'todavía no se registran precios en estas horas',
    emptyDays: 'todavía no se registran precios en estos días',
    pointHour: '{time}: habitual {typical}, mínimo {lowest}, {count} en venta',
    pointDay: '{time}: habitual {typical}, mínimo {lowest}, {count} en venta (promedio de sus horas)',
    today: 'hoy',
    // The game's coin letters (GS GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}o',
      silver: '{amount}p',
      copper: '{amount}c',
    },
    typical: 'Precio habitual (mediana)',
    lowest: 'Mínimo',
    available: 'Disponible',
    range: 'Periodo de la gráfica',
    hours: '24 h',
    days: '7 días',
    noteHours: 'Solo se trazan los precios que realmente se registraron: un punto por hora. Las líneas crecen a partir de ahí.',
    noteDays: 'Solo se trazan los precios que realmente se registraron: un punto por día, el mínimo del día y el promedio de sus horas. Las líneas crecen a partir de ahí.',
  },
}
