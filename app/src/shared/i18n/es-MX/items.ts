// El español de Latinoamérica de los objetos: the notes on every key are in en/items.ts.
export default {
  unknownItem: 'Objeto {id}',
  unknownSpell: 'Hechizo {id}',

  // "hace ..." reads after "visto", "vistas", "Foto tomada" and alone in the character list.
  ago: {
    justNow: 'justo ahora',
    minutes: { one: 'hace {count} minuto', many: 'hace {count} minutos', other: 'hace {count} minutos' },
    hours: { one: 'hace {count} hora', many: 'hace {count} horas', other: 'hace {count} horas' },
    days: { one: 'hace {count} día', many: 'hace {count} días', other: 'hace {count} días' },
    weeks: { one: 'hace {count} semana', many: 'hace {count} semanas', other: 'hace {count} semanas' },
  },

  places: {
    bags: 'Bolsas',
    bank: 'Banco',
    worn: 'Equipado',
    // GS KEYRING.
    keyring: 'Llavero',
  },

  types: {
    weaponOf: 'Arma · {kind}',
    armorOf: 'Armadura · {kind}',
    // GS OTHER.
    unknown: 'Otros',
    // ItemClass esMX; gem, item enhancement and permanent are obsolete in Forever's table: the retail names, and GS MONEY.
    classes: {
      consumable: 'Consumible',
      container: 'Contenedor',
      weapon: 'Arma',
      gem: 'Gema',
      armor: 'Armadura',
      reagent: 'Componente',
      projectile: 'Proyectil',
      tradeGoods: 'Objeto comerciable',
      itemEnhancement: 'Mejora de objeto',
      recipe: 'Receta',
      money: 'Dinero',
      quiver: 'Carcaj',
      quest: 'Misión',
      key: 'Llave',
      permanent: 'Permanente',
      miscellaneous: 'Miscelánea',
    },
    // ItemSubClass 2.x DisplayName esMX.
    weapons: {
      axe: 'Hacha',
      bow: 'Arco',
      gun: 'Arma de fuego',
      mace: 'Maza',
      polearm: 'Arma de asta',
      sword: 'Espada',
      warglaive: 'Gujas de guerra',
      staff: 'Bastón',
      // The game's own name for subclasses 11 and 12.
      exotic: 'Arma exótica',
      fistWeapon: 'Arma de puño',
      miscellaneous: 'Miscelánea',
      dagger: 'Daga',
      thrown: 'Arma arrojadiza',
      spear: 'Lanza',
      crossbow: 'Ballesta',
      wand: 'Varita',
      fishingPole: 'Caña de pescar',
    },
    // ItemSubClass 4.x DisplayName esMX; sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: 'Miscelánea',
      cloth: 'Tela',
      leather: 'Cuero',
      mail: 'Malla',
      plate: 'Placas',
      cosmetic: 'Cosmético',
      shield: 'Escudo',
      libram: 'Tratado',
      idol: 'Ídolo',
      totem: 'Tótem',
      sigil: 'Sigilo',
      relic: 'Reliquia',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT), the long ones cut to fit 44px.
  slots: {
    head: 'Cabeza',
    neck: 'Cuello',
    shoulder: 'Hombros',
    back: 'Espalda',
    chest: 'Pecho',
    shirt: 'Camisa',
    tabard: 'Tabardo',
    wrist: 'Muñeca',
    hands: 'Manos',
    waist: 'Cintura',
    legs: 'Piernas',
    feet: 'Pies',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: 'Dedo',
    trinket: 'Abalorio',
    // GS MAINHANDSLOT "Mano derecha" and SECONDARYHANDSLOT "Mano izquierda", without "Mano".
    mainHand: 'Derecha',
    offHand: 'Izquierda',
    // GS RANGEDSLOT "A distancia", without the preposition.
    ranged: 'Distancia',
  },

  character: {
    // The game's order, GS PLAYER_LEVEL_NO_SPEC_WITH_RACE: "Brujo Gnomo de nivel 24".
    line: '{class} {race} de nivel {level}',
    kind: '{class} {race}',
  },
  races: {
    human: 'Humano',
    orc: 'Orco',
    dwarf: 'Enano',
    nightElf: 'Elfo de la noche',
    undead: 'No-muerto',
    tauren: 'Tauren',
    gnome: 'Gnomo',
    troll: 'Trol',
  },
  classes: {
    warrior: 'Guerrero',
    paladin: 'Paladín',
    hunter: 'Cazador',
    rogue: 'Pícaro',
    priest: 'Sacerdote',
    shaman: 'Chamán',
    mage: 'Mago',
    warlock: 'Brujo',
    druid: 'Druida',
  },
  classesAll: {
    warrior: 'Guerreros',
    paladin: 'Paladines',
    hunter: 'Cazadores',
    rogue: 'Pícaros',
    priest: 'Sacerdotes',
    shaman: 'Chamanes',
    mage: 'Magos',
    warlock: 'Brujos',
    druid: 'Druidas',
  },

  page: {
    noCharacter: 'Todavía no hay personajes. Activa el addon Twinmap Forever, juega con uno y sus bolsas aparecerán aquí, incluso con el juego cerrado.',
    filter: 'Filtrar por nombre o tipo',
    filterLabel: 'Filtrar objetos',
    whereLabel: 'Lugar',
    all: 'Todo',
    // Each part as "label: amount", like the game's "Dinero:" (GS MONEY_COLON).
    worth: 'Venta al mercader: {money}',
    auction: 'Casa de subastas: {money}',
    money: 'Dinero: {money}',
  },

  doll: {
    label: 'Equipamiento',
    // The game's window is "Información del personaje" (GS CHARACTER_BUTTON).
    open: 'Abre Información del personaje en el juego',
    keyHint: '{key} si no cambiaste la tecla',
    waitNote: 'La foto se toma en cuanto se abre la ventana y nada cubre al personaje.',
    cancel: 'Cancelar',
    save: 'Guardar…',
    retake: 'Repetir',
    taken: 'Foto tomada {ago}',
    none: 'Todavía no hay foto de {name}',
    noneNote: 'Abre Información del personaje en el juego y la foto se tomará sola.',
  },

  held: {
    bags: 'Bolsas',
    bagsNow: 'en este momento',
    bagsAsOf: 'vistas {ago}',
    bank: 'Banco',
    bankSeen: 'visto {ago}',
    // GS BAG_NAME_BACKPACK "Mochila"; ItemSubClass 1.11 "Bolsa de componentes".
    backpack: 'Mochila y bolsas',
    reagents: 'Bolsa de componentes',
    keyring: 'Llavero',
    bankBags: 'Banco y sus bolsas',
    // GS CONTAINER_SLOTS "casillas".
    used: '{used} de {count} ocupadas',
    // "vacío/vacía" would agree with the grid's heading (Llavero, Mochila...).
    empty: { one: 'sin objetos · {count} casilla', many: 'sin objetos · {count} casillas', other: 'sin objetos · {count} casillas' },
  },

  bank: {
    none: 'Todavía no se ha visto el banco',
    open: 'Abre tu banco una vez en el juego: lo que contiene aparecerá aquí, incluso con el juego cerrado.',
    where: 'Habla con un banquero en cualquier capital.',
  },

  professions: {
    primary: 'Profesiones',
    secondary: 'Habilidades secundarias',
    filter: 'Filtrar recetas',
    known: 'Conocidas',
    unknown: 'Sin aprender',
    unknownNote: 'El número: la habilidad a partir de la que cada una se vuelve amarilla.',
    optimal: 'Naranja: subida segura',
    medium: 'Amarillo: probable',
    easy: 'Verde: rara vez',
    trivial: 'Gris: ninguna',
    noMatch: 'Ninguna receta coincide.',
    none: 'Todavía no tienes profesiones',
    learn: 'Aprende una con un instructor de profesiones en cualquier ciudad: su nivel y sus recetas aparecerán aquí.',
    also: 'Cocina, Primeros auxilios y Pesca también cuentan.',
    unseen: 'Todavía no se han visto recetas',
    open: 'Abre {profession} una vez en el juego: sus recetas aparecerán aquí, incluso con el juego cerrado.',
    again: 'Abre {profession} una vez más en el juego: sus categorías y las recetas sin aprender también aparecerán aquí.',
    gathers: '{profession} no tiene recetas: solo se muestra su nivel.',
  },

  spellbook: {
    filter: 'Filtrar hechizos',
    passive: 'Pasivo',
    noMatch: 'Ningún hechizo coincide.',
    none: 'Todavía no hay libro de hechizos',
    login: 'Entra al juego con el addon de Twinmap actualizado: los hechizos de tu libro aparecerán aquí, incluso con el juego cerrado.',
  },

  table: {
    columns: {
      item: 'Objeto',
      character: 'Personaje',
      type: 'Tipo',
      where: 'Lugar',
      qty: 'Cant.',
      value: 'Valor',
      auction: 'En subasta',
    },
    nothingLike: '{name} no tiene nada parecido a "{typed}".',
    nothing: 'No hay nada aquí.',
    bagsNow: 'Bolsas en este momento',
    bagsAsOf: 'Bolsas vistas {ago}',
    bankSeen: 'Banco visto {ago}, la última vez que se abrió',
    bankUnseen: 'Banco todavía sin ver: ábrelo una vez en el juego',
  },

  others: {
    title: 'Otros personajes',
    // "la PC" in Latin America.
    where: 'guardados en esta PC',
    show: 'Mostrar a {name}',
    seen: '{name}: visto {ago}',
  },

  popup: {
    sellPrice: 'Precio de venta: {price}',
    auction: 'Casa de subastas: {price}',
    // GS AUCTION_PRICE_PER_ITEM "por unidad".
    each: '({price} por unidad)',
    notOnSale: 'Casa de subastas: no está a la venta',
    // After a first name; "lo" stands for "el objeto", whatever the item's gender.
    wears: 'lo lleva equipado',
    inBags: '{count} en las bolsas',
    inBank: '{count} en el banco',
    noneHeld: 'Ninguno de tus personajes tiene este objeto',
    // The NPC after a colon, like the game's "Vendedor" source line: "Vendido por" would agree with the item's gender.
    soldBy: 'Mercader: {npc}',
    soldByIn: 'Mercader: {npc}, {zone}',
    perPack: '{price} por {count}',
    moreVendors: { one: 'y {count} mercader más', many: 'y {count} mercaderes más', other: 'y {count} mercaderes más' },
    // Like the game's "Botín del jefe: %s" (GS WARDROBE_TOOLTIP_BOSS_DROP_FORMAT).
    dropsFrom: 'Botín: {npc}',
    dropsFromIn: 'Botín: {npc}, {zone}',
    moreDrops: { one: 'y {count} más', many: 'y {count} más', other: 'y {count} más' },
    // Object names come without an article ("Cofre robusto"): after a colon; "Encontrado en" would agree with the item's gender.
    foundIn: 'Se obtiene de: {object}',
    foundInIn: 'Se obtiene de: {object}, {zone}',
  },

  npc: {
    sells: '{count} en venta',
    subSells: '{sub} · {count} en venta',
    // The profession after a colon, like every game name.
    notLearned: 'Profesión todavía no aprendida: {profession}',
    teaches: 'Solo para {classes}.',
    teachesPick: 'Solo para {classes}: elige un personaje para ver qué puede aprender.',
    // GS AVAILABLE "Disponible": what can be learned now.
    learnNow: 'Disponible · {count}',
    atLevel: 'Nivel {level}',
    // GS SKILL "Habilidad".
    atSkill: 'Habilidad {skill}',
    // GS TRADESKILL_NEXT_RANK_HEADER.
    nextRank: 'Siguiente rango',
    sellsHeading: 'En venta · {count}',
    rank: 'Rango {rank}',
    nextNeeds: 'habilidad {skill}, nivel {level}',
    talent: 'Talento',
    quest: 'Misión',
    questTaught: 'Se aprende con la misión {quest}',
    classQuest: 'Se aprende con una misión de clase',
    columns: {
      item: 'Objeto',
      price: 'Precio',
      // No game abbreviation for the auction house: "Subasta", as players say it.
      ah: 'Subasta',
      bags: 'Bolsas',
      bank: 'Banco',
    },
    ahNote: 'El precio más bajo en la casa de subastas, por la misma cantidad',
    ahPrice: 'Subasta {price}',
    known: 'Conocidos · {count}',
    show: 'Mostrar',
    hide: 'Ocultar',
    noCharacter: 'Todavía no hay personajes: activa el addon Twinmap Forever y juega con uno.',
    // The profession is opened like a spell ("abre Herrería"): no "de" before the game name.
    recipesRead: '{name} · recetas de la última vez que abriste {profession}',
    recipesUnread: '{name} · abre {profession} una vez en el juego para ver las recetas conocidas',
    spellsNow: '{name}, nivel {level} · hechizos actuales',
    spellsAsOf: '{name}, nivel {level} · hechizos vistos {ago}',
    bankSeen: 'Banco visto {ago} · {name}',
    bankUnseen: 'Banco todavía sin ver: ábrelo una vez en el juego · {name}',
  },

  picker: {
    inGame: 'En el juego',
    seen: 'visto {ago}',
    list: 'Personajes',
    // GS UNLEARN "Olvidar".
    forget: 'Olvidar',
    note: 'Guardados en esta computadora, con lo que el addon transmitió mientras jugabas. Haz clic derecho en un personaje para olvidarlo.',
  },

  resize: 'Arrastra para cambiar el tamaño',
}
