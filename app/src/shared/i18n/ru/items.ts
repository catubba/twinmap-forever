// Русский предметов: the notes on every key are in en/items.ts.
export default {
  unknownItem: 'Предмет {id}',
  unknownSpell: 'Заклинание {id}',

  // "... назад" reads after "обновлено", "открывали", "в игре", "Снимок:" and alone in the character list.
  ago: {
    justNow: 'только что',
    minutes: { one: '{count} минуту назад', few: '{count} минуты назад', many: '{count} минут назад', other: '{count} минуты назад' },
    hours: { one: '{count} час назад', few: '{count} часа назад', many: '{count} часов назад', other: '{count} часа назад' },
    days: { one: '{count} день назад', few: '{count} дня назад', many: '{count} дней назад', other: '{count} дня назад' },
    weeks: { one: '{count} неделю назад', few: '{count} недели назад', many: '{count} недель назад', other: '{count} недели назад' },
  },

  places: {
    bags: 'Сумки',
    bank: 'Банк',
    // GS CURRENTLY_EQUIPPED.
    worn: 'На персонаже',
    // A chip, short: the game's "Связка ключей" (GS KEYRING) cut to its noun; held.keyring has it whole.
    keyring: 'Ключи',
  },

  types: {
    weaponOf: 'Оружие · {kind}',
    armorOf: 'Броня · {kind}',
    // GS OTHER.
    unknown: 'Другое',
    // ItemClass ruRU (ClassName_lang); gem, item enhancement and permanent, not in Forever's table, from GS AUCTION_CATEGORY_*.
    classes: {
      consumable: 'Расходуемые',
      container: 'Сумки',
      weapon: 'Оружие',
      gem: 'Камни',
      armor: 'Доспехи',
      reagent: 'Реагенты',
      projectile: 'Боеприпасы',
      tradeGoods: 'Хозяйственные товары',
      itemEnhancement: 'Улучшения предметов',
      recipe: 'Рецепты',
      money: 'Деньги',
      quiver: 'Амуниция',
      quest: 'Задания',
      key: 'Ключи',
      permanent: 'Постоянные',
      miscellaneous: 'Разное',
    },
    // ItemSubClass 2.x DisplayName ruRU.
    weapons: {
      axe: 'Топор',
      bow: 'Лук',
      gun: 'Огнестрельное',
      mace: 'Дробящее',
      polearm: 'Древковое',
      sword: 'Меч',
      warglaive: 'Боевые клинки',
      staff: 'Посох',
      // The game's own name for subclasses 11 and 12.
      exotic: 'Экзотическое',
      fistWeapon: 'Кистевое',
      miscellaneous: 'Разное',
      dagger: 'Кинжал',
      thrown: 'Метательное',
      spear: 'Копье',
      crossbow: 'Арбалет',
      wand: 'Жезл',
      fishingPole: 'Удочка',
    },
    // ItemSubClass 4.x DisplayName ruRU; sigil (4.10) is not in Forever's table: the retail name. Relic: GS INVTYPE_RELIC.
    armors: {
      miscellaneous: 'Разное',
      cloth: 'Ткань',
      leather: 'Кожа',
      mail: 'Кольчуга',
      plate: 'Латы',
      cosmetic: 'Декоративный предмет',
      shield: 'Щит',
      libram: 'Манускрипт',
      idol: 'Идол',
      totem: 'Тотем',
      sigil: 'Печать',
      relic: 'Реликвия',
    },
  },

  // The game's slot names (GS HEADSLOT ... RANGEDSLOT), the long ones rewritten to fit 44px.
  slots: {
    head: 'Голова',
    neck: 'Шея',
    // GS INVTYPE_SHOULDER: "Плечи" is the slot, the short form reads the same.
    shoulder: 'Плечо',
    back: 'Спина',
    chest: 'Грудь',
    shirt: 'Рубашка',
    // GS TABARDSLOT "Гербовая накидка" does not fit.
    tabard: 'Накидка',
    wrist: 'Запястья',
    // GS HANDSSLOT "Кисти рук" without "рук".
    hands: 'Кисти',
    waist: 'Пояс',
    legs: 'Ноги',
    feet: 'Ступни',
    // GS FINGER0SLOT: the game names the slot, not the ring.
    ring: 'Палец',
    trinket: 'Аксессуар',
    // GS MAINHANDSLOT "Правая рука" and SECONDARYHANDSLOT "Левая рука", without "рука".
    mainHand: 'Правая',
    offHand: 'Левая',
    // GS INVTYPE_RANGED.
    ranged: 'Дальний бой',
  },

  character: {
    // GS PLAYER_LEVEL_NO_SPEC_WITH_RACE: "24-й уровень, Гном, Чернокнижник".
    line: '{level}-й уровень, {race}, {class}',
    kind: '{race}, {class}',
  },
  // ChrRaces ruRU, the masculine form.
  races: {
    human: 'Человек',
    orc: 'Орк',
    dwarf: 'Дворф',
    nightElf: 'Ночной эльф',
    undead: 'Нежить',
    tauren: 'Таурен',
    gnome: 'Гном',
    troll: 'Тролль',
  },
  // ChrClasses ruRU, the masculine form.
  classes: {
    warrior: 'Воин',
    paladin: 'Паладин',
    hunter: 'Охотник',
    rogue: 'Разбойник',
    priest: 'Жрец',
    shaman: 'Шаман',
    mage: 'Маг',
    warlock: 'Чернокнижник',
    druid: 'Друид',
  },
  // Only in npc.teaches, after "Обучает только": the genitive plural, lowercase mid-sentence.
  classesAll: {
    warrior: 'воинов',
    paladin: 'паладинов',
    hunter: 'охотников',
    rogue: 'разбойников',
    priest: 'жрецов',
    shaman: 'шаманов',
    mage: 'магов',
    warlock: 'чернокнижников',
    druid: 'друидов',
  },

  page: {
    noCharacter: 'Персонажей пока нет. Играйте с включенным аддоном Twinmap Forever, и сумки персонажа появятся здесь, даже когда игра закрыта.',
    filter: 'Фильтр по названию или типу',
    filterLabel: 'Фильтр предметов',
    whereLabel: 'Где',
    all: 'Все',
    // Each part as "label: amount", like the game's "Деньги:" (GS MONEY_COLON); GS SELL_PRICE.
    worth: 'Цена продажи: {money}',
    auction: 'Аукцион: {money}',
    money: 'Деньги: {money}',
  },

  doll: {
    label: 'На персонаже',
    // The game's window is "Информация о персонаже" (GS CHARACTER_BUTTON).
    open: 'Откройте в игре окно "Информация о персонаже"',
    keyHint: '{key}, если вы не меняли клавишу',
    waitNote: 'Снимок делается, как только окно открыто и персонажа ничто не закрывает.',
    cancel: 'Отмена',
    save: 'Сохранить…',
    retake: 'Переснять',
    taken: 'Снимок: {ago}',
    // The name before a colon: after "персонажа" it would have to decline.
    none: '{name}: снимка пока нет',
    noneNote: 'Откройте в игре окно "Информация о персонаже", и снимок будет сделан автоматически.',
  },

  held: {
    bags: 'Сумки',
    bagsNow: 'сейчас',
    bagsAsOf: 'обновлено {ago}',
    bank: 'Банк',
    // Impersonal plural: "when someone last opened it", no gender.
    bankSeen: 'открывали {ago}',
    // GS BAG_NAME_BACKPACK "Рюкзак"; ItemSubClass 1.11 "Сумка с реагентами"; GS KEYRING.
    backpack: 'Рюкзак и сумки',
    reagents: 'Сумка с реагентами',
    keyring: 'Связка ключей',
    bankBags: 'Банк и его сумки',
    used: 'занято: {used} из {count}',
    // GS CONTAINER_SLOTS "ячейка:ячейки:ячеек".
    empty: { one: 'пусто · {count} ячейка', few: 'пусто · {count} ячейки', many: 'пусто · {count} ячеек', other: 'пусто · {count} ячейки' },
  },

  bank: {
    none: 'Банк еще не открывали',
    open: 'Откройте банк один раз в игре: его содержимое появится здесь, даже когда игра закрыта.',
    where: 'Поговорите с банкиром в любой столице.',
  },

  professions: {
    primary: 'Профессии',
    secondary: 'Вторичные навыки',
    filter: 'Фильтр рецептов',
    known: 'Изученные',
    unknown: 'Не изучены',
    unknownNote: 'Число: уровень навыка, с которого рецепт становится желтым.',
    optimal: 'Оранжевый: навык растет наверняка',
    medium: 'Желтый: вероятно',
    easy: 'Зеленый: редко',
    trivial: 'Серый: не растет',
    noMatch: 'Нет подходящих рецептов.',
    none: 'Профессий пока нет',
    learn: 'Изучите профессию у учителя профессий в любом городе: ее уровень и рецепты появятся здесь.',
    also: 'Кулинария, первая помощь и рыбная ловля тоже считаются.',
    unseen: 'Рецептов пока не видно',
    open: 'Откройте окно профессии {profession} один раз в игре: ее рецепты появятся здесь, даже когда игра закрыта.',
    again: 'Откройте окно профессии {profession} в игре еще раз: здесь появятся и ее разделы, и неизученные рецепты.',
    gathers: 'У профессии {profession} нет рецептов: показывается только уровень.',
  },

  spellbook: {
    filter: 'Фильтр заклинаний',
    passive: 'Пассивный',
    noMatch: 'Нет подходящих заклинаний.',
    none: 'Книги заклинаний пока нет',
    login: 'Войдите в игру с обновленным аддоном Twinmap: заклинания из вашей книги появятся здесь, даже когда игра закрыта.',
  },

  talents: {
    spent: { one: '{count} очко потрачено', few: '{count} очка потрачено', many: '{count} очков потрачено', other: '{count} очка потрачено' },
    free: 'Очки талантов: {count}',
    rank: 'Уровень {rank}/{most}',
    next: 'Следующий уровень:',
    need: { one: 'Потратьте еще {count} очко на таланты ветки «{tree}»', few: 'Потратьте еще {count} очка на таланты ветки «{tree}»', many: 'Потратьте еще {count} очков на таланты ветки «{tree}»', other: 'Потратьте еще {count} очка на таланты ветки «{tree}»' },
    none: 'Талантов пока нет',
    learn: 'Таланты открываются на 10-м уровне, затем по очку за каждый уровень. Распределите их в окне талантов в игре: они появятся здесь.',
  },

  table: {
    columns: {
      item: 'Предмет',
      character: 'Персонаж',
      type: 'Тип',
      where: 'Где',
      qty: 'Кол-во',
      value: 'Цена',
      auction: 'Аукцион',
    },
    // The name before a colon: "у {name}" would have to decline.
    nothingLike: '{name}: нет ничего похожего на "{typed}".',
    nothing: 'Здесь ничего нет.',
    bagsNow: 'Сумки: сейчас',
    bagsAsOf: 'Сумки: обновлено {ago}',
    bankSeen: 'Банк: последний раз открывали {ago}',
    bankUnseen: 'Банк еще не открывали: откройте его один раз в игре',
  },

  others: {
    title: 'Другие персонажи',
    where: 'сохранены на этом ПК',
    show: 'Показать: {name}',
    seen: '{name}: в игре {ago}',
  },

  popup: {
    sellPrice: 'Цена продажи: {price}',
    // The short name of the Auction House, as the glossary allows.
    auction: 'Аукцион: {price}',
    // GS AUCTION_PRICE_PER_ITEM "за предмет".
    each: '({price} за предмет)',
    notOnSale: 'Аукцион: не продается',
    // After a first name. "носит его" or "ее" would need the item's gender.
    wears: 'носит этот предмет',
    inBags: '{count} в сумках',
    inBank: '{count} в банке',
    noneHeld: 'Ни у одного из ваших персонажей нет этого предмета',
    // The NPC after a colon: GS MERCHANT.
    soldBy: 'Торговец: {npc}',
    soldByIn: 'Торговец: {npc}, {zone}',
    // "шт." so the word does not agree with the number.
    perPack: '{price} за {count} шт.',
    moreVendors: { one: 'и еще {count} торговец', few: 'и еще {count} торговца', many: 'и еще {count} торговцев', other: 'и еще {count} торговца' },
    // Like the game's "Добыча с босса: %s" (GS WARDROBE_TOOLTIP_BOSS_DROP_FORMAT).
    dropsFrom: 'Добыча: {npc}',
    dropsFromIn: 'Добыча: {npc}, {zone}',
    moreDrops: { one: 'и еще {count}', few: 'и еще {count}', many: 'и еще {count}', other: 'и еще {count}' },
    // "Найдено в {object}" would decline the object: its name after a colon.
    foundIn: 'Источник: {object}',
    foundInIn: 'Источник: {object}, {zone}',
  },

  npc: {
    // The count after a colon, so "товар" does not agree with it.
    sells: 'Товаров: {count}',
    subSells: '{sub} · Товаров: {count}',
    // The profession after a colon, like every game name.
    notLearned: 'Профессия еще не изучена: {profession}',
    // {classes} is classesAll, written in the genitive plural for this sentence.
    teaches: 'Обучает только {classes}.',
    teachesPick: 'Обучает только {classes}: выберите персонажа, чтобы увидеть, что он может изучить.',
    // GS AVAILABLE "Доступно": what can be learned now.
    learnNow: 'Доступно · {count}',
    // GS UNIT_LEVEL_TEMPLATE.
    atLevel: '{level}-й уровень',
    // GS SKILL "Навыки", in the singular.
    atSkill: 'Навык {skill}',
    // GS TRADESKILL_NEXT_RANK_HEADER: the game calls a spell's rank "уровень".
    nextRank: 'Следующий уровень',
    sellsHeading: 'В продаже · {count}',
    rank: 'Уровень {rank}',
    nextNeeds: 'навык {skill}, {level}-й уровень',
    talent: 'Талант',
    quest: 'Задание',
    // The quest's name after a colon.
    questTaught: 'Награда за задание: {quest}',
    classQuest: 'Награда за классовое задание',
    columns: {
      item: 'Предмет',
      price: 'Цена',
      // A 30px to 66px column: "Аукцион" cut short.
      ah: 'Аук.',
      bags: 'Сумки',
      bank: 'Банк',
    },
    ahNote: 'Самая низкая цена на аукционе за такое же количество',
    ahPrice: 'Аук. {price}',
    known: 'Изучено · {count}',
    show: 'Показать',
    hide: 'Скрыть',
    noCharacter: 'Персонажей пока нет: играйте с включенным аддоном Twinmap Forever.',
    // The profession as a label before a colon: after "окна" it would have to decline.
    recipesRead: '{name} · {profession}: рецепты на момент последнего открытия окна',
    recipesUnread: '{name} · {profession}: откройте окно профессии в игре, чтобы увидеть известные рецепты',
    // {level} can be "?": GS LEVEL_ABBR "Ур." reads with it, "?-й уровень" does not.
    spellsNow: '{name}, ур. {level} · заклинания сейчас',
    spellsAsOf: '{name}, ур. {level} · заклинания обновлены {ago}',
    bankSeen: 'Банк: открывали {ago} · {name}',
    bankUnseen: 'Банк еще не открывали: откройте его один раз в игре · {name}',
  },

  picker: {
    inGame: 'В игре',
    // "был в игре" would need the character's gender: without the verb.
    seen: 'в игре {ago}',
    list: 'Персонажи',
    forget: 'Забыть',
    note: 'Сохранены на этом компьютере по данным, которые аддон передал во время игры. Щелкните правой кнопкой мыши по персонажу, чтобы забыть его.',
  },

  resize: 'Перетащите, чтобы изменить ширину',
}
