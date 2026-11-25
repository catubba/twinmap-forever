// Русский аукциона: the notes on every key are in en/auction.ts.
export default {
  unknownItem: 'Предмет {id}',

  house: {
    // "Аукцион", the game's short form (GS AUCTIONS), to keep the button short.
    line: 'Аукцион {number} · {side} · {ruleset}',
    // Our choice: the game names no "ruleset"; the realm list calls it the type of the realm.
    unknownRuleset: 'Тип мира {id}',
  },
  side: {
    alliance: 'Альянс',
    horde: 'Орда',
    // Masculine: it reads with "аукцион" on the button.
    neutral: 'Нейтральный',
  },
  // GS GDAPI_REALMTYPE_*.
  ruleset: {
    normal: 'Обычный',
    pvp: 'PvP',
    roleplay: 'Ролевой',
    roleplayPvp: 'Ролевой PvP',
  },
  category: {
    noClass: 'Разное',
    // Our choice: "Класс" would read as a character class.
    unknownClass: 'Категория {id}',
    unknownSub: 'Подкатегория {id}',
  },
  // The game's slot names (GlobalStrings INVTYPE_*).
  slot: {
    head: 'Голова',
    neck: 'Шея',
    shoulder: 'Плечо',
    shirt: 'Рубашка',
    chest: 'Грудь',
    waist: 'Пояс',
    legs: 'Ноги',
    feet: 'Ступни',
    wrist: 'Запястья',
    hands: 'Кисти рук',
    finger: 'Палец',
    trinket: 'Аксессуар',
    offHand: 'Левая рука',
    back: 'Спина',
    tabard: 'Гербовая накидка',
    heldInOffHand: 'Левая рука',
    relic: 'Реликвия',
  },

  tools: {
    // Straight quotes on purpose: the search only understands " for an exact name. Shorter than the English.
    searchPlaceholder: 'Поиск: название или "точное название"',
    searchLabel: 'Поиск на аукционе',
    filters: 'Фильтры',
    filtersOn: 'Фильтры · {count}',
    prices: 'Цены',
    // GS AUCTION_PRICE_PER_STACK "за связку".
    perUnit: 'За штуку',
    perStack: 'За связку',
    pricesOf: 'Цены на {time}',
    notUpdated: '{age}, не обновлены',
    nextAround: 'следующие около {time}',
  },
  // "мин." and "ч." are the game's abbreviations (GS MINUTES_ABBR, HOURS_ABBR): no agreement with the number.
  age: {
    minutes: { one: '{count} мин. назад', few: '{count} мин. назад', many: '{count} мин. назад', other: '{count} мин. назад' },
    hours: { one: '{count} ч. назад', few: '{count} ч. назад', many: '{count} ч. назад', other: '{count} ч. назад' },
    days: { one: '{count} день назад', few: '{count} дня назад', many: '{count} дней назад', other: '{count} дня назад' },
  },
  filters: {
    // "от ... до" in the sentence; the empty fields say which end they are.
    level: 'Уровень от {from} до {to}',
    from: 'мин.',
    to: 'макс.',
    quality: 'Качество',
    // Neuter, as "качество".
    any: 'Любое',
    atLeast: {
      poor: 'Низкое и выше',
      common: 'Обычное и выше',
      uncommon: 'Необычное и выше',
      rare: 'Редкое и выше',
      epic: 'Превосходное и выше',
      legendary: 'Легендарное и выше',
    },
    lowestPrice: 'Мин. цена от {from} до {to}',
    // Kept as g and s: the price field only reads g, s, c (shared/ah.ts), not the game's з, с, м.
    priceExample: 'напр. 1g 50s',
    clear: 'Сброс',
  },

  choose: {
    title: 'Какой аукционный дом?',
    intro: 'Twinmap показывает цены аукционного дома, где торгует ваш персонаж.',
    // "мира типа" so that {ruleset}, in bold, stays in the nominative.
    told: 'По данным игры, {who} играет в мире типа {ruleset}.',
    // "фракция:" keeps {side} in the nominative.
    toldSide: 'По данным игры, {who} играет в мире типа {ruleset}, фракция: {side}.',
    region: 'Регион',
    readFromGame: '(из данных игры)',
    // The towns by their ruRU game names.
    neutral: 'Нейтральный аукционный дом (Пиратская Бухта, Прибамбасск, Круговзор)',
    note: 'Цены приходят от Blizzard раз в час. Twinmap загружает около 350 КБ для вашего аукционного дома; о вас ничего не отправляется.',
    show: 'Показать цены',
    follow: 'Следовать за моим персонажем',
    cancel: 'Отмена',
  },
  errors: {
    noHouse: 'Для этого аукционного дома нет цен.',
    answered: 'Сервер prices.twinmap.app ответил: {status}.',
    notPrices: 'Сервер prices.twinmap.app прислал что-то другое вместо цен.',
    unreachable: 'Twinmap не удалось связаться с сервером prices.twinmap.app.',
  },

  wait: {
    noPrices: 'Цен пока нет',
    noEarlier: 'У Twinmap нет более ранних цен этого аукционного дома.',
    worksAsBefore: 'Все остальное в Twinmap работает как прежде.',
    again: 'Повторить',
    getting: 'Загрузка цен',
    // {house} first, so it needs no case.
    of: '{house}, с сервера prices.twinmap.app.',
  },

  nav: {
    yours: 'Ваше',
    mine: 'Мои предметы',
    // Our choice: "оповещение" for an alert, here and on the item's page.
    alerts: 'Оповещения',
    categories: 'Категории',
    all: 'Все предметы',
  },

  page: {
    // After a colon: {place} stays in the nominative.
    back: 'Назад: {place}',
    theSearch: 'Поиск',
    notOnSale: 'Сейчас не продается на этом аукционе.',
    // GS ITEM_MIN_LEVEL "Требуется %d-й уровень", lowercase after the dot.
    requiresLevel: 'требуется {level}-й уровень',
    itemLevel: 'уровень предмета {level}',
    lowest: 'Мин. цена',
    typical: 'Обычная цена',
    available: 'Доступно',
    // What a vendor gives is the game's sell price (GS SELL_PRICE).
    vendorGives: 'Цена продажи',
    onSale: 'Сейчас в продаже, сначала дешевые',
    priceEach: 'Цена за шт.',
    howMany: 'Количество',
    // Running totals of the rows above: how many, and what they cost.
    upToHere: 'Всего',
    costUpToHere: 'Сумма',
    asAt: 'Состояние аукциона на {time}. Цены указаны за штуку; то, что в продаже сейчас, может отличаться.',
    youHave: 'У вас есть',
    have: '{count} · {who}, {place}',
    // Our choice: an item with no bonuses.
    plain: 'без бонусов',
    otherKind: '({kind})',
    none: 'Нет ни у одного персонажа этого аукционного дома',
    // GS ROLL_DISENCHANT "Распылить".
    disenchant: 'Если распылить',
    // The expected value: what disenchanting gives on average.
    expected: 'В среднем',
    best: 'Выгоднее всего',
    notAllOnSale: 'не все в продаже',
    disenchantIt: 'распылить',
    sellIt: 'продать на аукционе',
    vendorIt: 'продать торговцу',
    draws: '{draws}, по минимальным ценам на {time}.',
    // ru-RU writes a no-break space before %, as Intl does.
    draw: '{item} {count} ({chance} %)',
    alert: 'Оповещение',
    // Reads with auction.when and the field: "Когда мин. цена опустится ниже [5] серебра".
    whenLowest: 'Когда мин. цена {when}',
    // Genitive: it follows "ниже" or "выше".
    silver: '{field} серебра',
    priceLabel: 'Цена в серебре',
    now: 'сейчас {price}',
    appearsNote: 'Когда снова появится в продаже, после часа без предложений.',
    // Our choice: "вариант" for a kind of an item (its bonuses), here and in browse.kinds.
    kindOnly: 'Только этот вариант ({kind})',
    inGame: 'Оповещать и в игре',
    alertSet: 'Оповещение создано. {see}',
    seeAlerts: 'Открыть оповещения',
    setAlert: 'Создать оповещение',
    checked: 'Проверяется каждый час, пока открыт Twinmap.',
    playFirst: 'Войдите в игру персонажем с включенным аддоном, чтобы создавать для него оповещения.',
    findInGame: 'Найти в игре',
    // Straight quotes: this is what to type in the game's search for an exact name.
    quoted: '"{name}"',
    copy: 'Копировать',
    copied: 'Скопировано',
  },
  // After page.whenLowest "Когда мин. цена": future tense, as "когда" wants.
  when: {
    below: 'опустится ниже',
    above: 'поднимется выше',
    appears: 'появится снова',
  },

  alerts: {
    item: 'Предмет',
    // The column reads with its cells: "Мин. цена | опустится ниже 1з".
    whenLowest: 'Мин. цена',
    now: 'Сейчас',
    state: 'Статус',
    inGame: 'В игре',
    anyKind: 'любой вариант',
    below: 'опустится ниже {price}',
    above: 'поднимется выше {price}',
    notOnSale: 'нет в продаже',
    // Neuter: an alert, "оповещение".
    met: 'Сработало в {time}',
    metAt: 'Сработало в {time}, {price}',
    waiting: 'ожидание',
    sent: 'отправлено',
    on: 'вкл.',
    off: 'выкл.',
    remove: 'Удалить',
    none: 'На этом аукционе пока нет оповещений. Откройте предмет и создайте оповещение справа на его странице.',
    // "Сейчас" and "Внимание" must match the names of the tab Now and its part Attention (ru/app.ts), in quotes so they need no case.
    note: 'Оповещения проверяются каждый час, когда приходят новые цены, и только пока открыт Twinmap. Сработавшее оповещение показывается здесь, на вкладке "Сейчас" в разделе "Внимание" и, если вы выберете, в игре.',
  },

  mine: {
    worthAh: 'Стоимость на аукционе',
    atVendor: 'У торговца',
    notOnSale: 'Нет в продаже',
    items: { one: '{count} предмет', few: '{count} предмета', many: '{count} предметов', other: '{count} предмета' },
    where: 'Где',
    everything: 'Все',
    colItem: 'Предмет',
    colWhere: 'Где',
    colHowMany: 'Количество',
    colLowestEach: 'Мин. за шт.',
    colAh: 'Аукцион',
    colVendor: 'Торговец',
    colBetter: 'Выгоднее',
    // No short form for the auction house in Russian: the game's short "Аукцион".
    better: {
      ah: 'Аукцион',
      vendor: 'Торговец',
    },
    notOnSaleRow: 'нет в продаже',
    none: 'Пока нет ни одного персонажа этого аукционного дома. Войдите в игру персонажем с включенным аддоном Twinmap Forever, и здесь появятся его сумки.',
    // "Залог", the game's deposit at the auction house.
    betterNote: '"Выгоднее" учитывает 5 %, которые забирает аукционный дом; залог не учитывается.',
    // Rewritten so nothing agrees with the characters (who may be women) and {ruleset} stays in the nominative.
    guessed: {
      one: '{names}: предполагается регион {region}, тип мира {ruleset}; для этого персонажа игра его еще не сообщила.',
      few: '{names}: предполагается регион {region}, тип мира {ruleset}; для этих персонажей игра его еще не сообщила.',
      many: '{names}: предполагается регион {region}, тип мира {ruleset}; для этих персонажей игра его еще не сообщила.',
      other: '{names}: предполагается регион {region}, тип мира {ruleset}; для этих персонажей игра его еще не сообщила.',
    },
  },
  // GS HUD_EDIT_MODE_BAGS_LABEL, BANK, CURRENTLY_EQUIPPED "На персонаже".
  place: {
    bags: 'Сумки',
    bank: 'Банк',
    worn: 'На персонаже',
  },
  held: {
    bags: 'сумки',
    bank: 'банк',
    worn: 'на персонаже',
  },

  browse: {
    name: 'Название',
    lowest: 'Мин. цена',
    typical: 'Обычная',
    available: 'Доступно',
    vendor: 'Торговец',
    hours: '24 ч.',
    kinds: { one: '{count} вариант', few: '{count} варианта', many: '{count} вариантов', other: '{count} варианта' },
    from: 'от',
    plainRow: '(без бонусов)',
    // {category} after a colon, so it stays in the nominative.
    nothing: {
      typed: 'По запросу "{typed}" ничего не продается.',
      typedIn: 'По запросу "{typed}" ничего не продается. Категория: {category}.',
      filters: 'Под эти фильтры ничего не подходит.',
      filtersIn: 'Под эти фильтры ничего не подходит. Категория: {category}.',
    },
    more: 'Показать еще {count} из {total}',
  },

  foot: {
    attribution: '{source}, через Battle.net API. Twinmap не связан с Blizzard и не одобрен компанией Blizzard.',
    source: 'Данные аукциона: Blizzard Entertainment',
    approximate: 'Количество указано приблизительно',
    hide: 'Скрыть эту строку',
  },

  chart: {
    label24h: 'Цены за последние 24 часа',
    label7d: 'Цены за последние 7 дней',
    emptyHours: 'за эти часы цены еще не собраны',
    emptyDays: 'за эти дни цены еще не собраны',
    // {count} after a colon, so "в продаже" needs no agreement with the number.
    pointHour: '{time}: обычная {typical}, мин. {lowest}, в продаже: {count}',
    pointDay: '{time}: обычная {typical}, мин. {lowest}, в продаже: {count} (среднее за часы дня)',
    today: 'сегодня',
    // The game's coin letters (GS GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL).
    coin: {
      gold: '{amount}з',
      silver: '{amount}с',
      copper: '{amount}м',
    },
    typical: 'Обычная цена (медиана)',
    lowest: 'Мин. цена',
    available: 'Доступно',
    range: 'Период графика',
    hours: '24 ч.',
    days: '7 дней',
    noteHours: 'На графике только действительно собранные цены: одна точка в час. Линии растут отсюда.',
    noteDays: 'На графике только действительно собранные цены: одна точка в день, минимум дня и среднее за его часы. Линии растут отсюда.',
  },
}
