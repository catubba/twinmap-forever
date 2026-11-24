// Русский Twinmap: the notes on every key are in en/app.ts.
export default {
  top: {
    sections: 'Разделы',
    now: 'Сейчас',
    items: 'Предметы',
    // The game's short form of Аукционный дом: a tab has no room for the long one.
    auctionHouse: 'Аукцион',
    // As Russian players write it.
    auctionHouseShort: 'Аук',
    pause: 'Приостановить Twinmap',
    resume: 'Возобновить Twinmap',
    sendsLeft: {
      one: 'Осталась {count} отправка',
      few: 'Осталось {count} отправки',
      many: 'Осталось {count} отправок',
      other: 'Осталось {count} отправки',
    },
    // Our choice: the game has no "Feedback" button. Named again in tiles.failedHelp.
    feedback: 'Отзыв',
    feedbackHint: 'Сообщить об ошибке или предложить идею',
    settings: 'Параметры',
  },

  link: {
    paused: 'Пауза',
    closed: 'Игра не запущена',
    closedLine: 'Игра не запущена. Карта все равно работает; ваше местоположение появится, когда вы войдете в игру.',
    minimized: 'Игра свернута',
    minimizedLine: 'Игра свернута. Ваше местоположение появится, когда ее окно вернется на экран.',
    updateApp: 'Обновить приложение',
    updateAddon: 'Обновить аддон',
    // "приложение" as the subject of the last clause: Twinmap has no gender to agree with.
    newerAddon: 'Аддон Twinmap Forever новее этого приложения (протокол {addon}, это приложение использует {app}). Закройте Twinmap и откройте снова: при запуске приложение обновится само.',
    newerAddonMac: 'Аддон Twinmap Forever новее этого приложения (протокол {addon}, это приложение использует {app}). Скачайте последнюю версию Twinmap для macOS. Если macOS его не открывает, нажмите "Все равно открыть" в разделе "Системные настройки > Конфиденциальность и безопасность".',
    olderAddon: 'Аддон Twinmap Forever устарел для этого приложения (протокол {addon}, это приложение использует {app}). Обновите аддон через CurseForge, затем перезапустите игру.',
    connecting: 'Подключение',
    lost: 'Связь потеряна',
    lostLine: 'Нет сигнала от игры. Войдите в игру и проверьте, что аддон Twinmap Forever включен, а его полоса не на паузе.',
    screenRecording: 'Twinmap пока не может читать окно игры. В разделе "Системные настройки > Конфиденциальность и безопасность > Запись экрана и системного звука" включите Twinmap (добавьте его кнопкой +, если его нет в списке), затем откройте Twinmap снова.',
    // "позиция": short, beside a dot in the top row.
    combat: 'В бою, только позиция',
    connected: 'Подключено',
    // "Поворот мини-карты", as the game's setting (GS ROTATE_MINIMAP).
    minimapTurns: 'В подземелье ваше местоположение определяется по мини-карте, а пока она вращается, это невозможно: отключите "Поворот мини-карты" в игре.',
    noRooms: 'В Twinmap нет изображений этого подземелья: здесь ваше местоположение не показывается.',
    noMinimap: 'В подземелье ваше местоположение определяется по мини-карте, но игра не передает ее данных: обновите аддон Twinmap Forever и держите мини-карту на экране.',
    looking: 'Поиск вашего местоположения. Оно определяется по мини-карте игры: держите ее на экране, ничем не закрывая.',
  },

  map: {
    addonMissing: 'Аддона Twinmap Forever нет в вашей игре, поэтому местоположение не может поступать. Скачайте его на CurseForge, затем перезапустите игру.',
    getAddon: 'Скачать на CurseForge',
    paused: 'Twinmap на паузе: карта остается там, где вы были, и не следует за вашим персонажем.',
    resume: 'Продолжить',
    unknownZone: 'Неизвестная зона',
  },

  tiles: {
    builtOnce: 'Это происходит только в первый раз и снова после обновления игры.',
    // "игра" before the name, so "установлена" agrees with a word of ours.
    noGameHelp: 'Выберите папку, где установлена игра World of Warcraft: Forever (в ней есть _forever_).',
    // "лаунчер", as players say it; the Forever launcher has no official Russian name.
    failedHelp: 'Twinmap не удалось прочитать файлы игры. Закройте лаунчер игры, если он обновляет или восстанавливает игру, затем попробуйте снова. Если ошибка повторится, восстановите игру через лаунчер и сообщите нам кнопкой "Отзыв".',
    looking: 'Поиск игры.',
    noGame: 'Папка игры не найдена.',
    converting: 'Создание карты из файлов вашей игры, {percent} %.',
    // The numbers after a colon, so no noun has to agree with them.
    ready: 'Карта готова, фрагментов: {tiles}, игра {version}, комнат: {rooms}',
    readyReading: 'Карта готова, фрагментов: {tiles}, игра {version}, чтение комнат',
    readyNoRooms: 'Карта готова, фрагментов: {tiles}, игра {version}, комнаты не прочитаны ({problem})',
    failed: 'Не удалось создать карту: {message}',
    chooseFolder: 'Выбрать папку игры',
    retry: 'Повторить',
  },

  elsewhere: {
    title: 'Завершите настройку на компьютере',
    text: 'Twinmap на компьютере еще настраивается: там видно, что осталось сделать. Карта откроется здесь сама, когда все будет готово.',
  },

  panel: {
    close: 'Закрыть',
    open: 'Задания и окрестности',
    mapLeft: 'Карта слева (M)',
    mapRight: 'Карта справа (M)',
    // The name after a colon, in the nominative.
    showing: 'Просмотр: {name}',
    backTo: 'Назад: {name}',
    // As the game (GS UNIT_LEVEL_TEMPLATE).
    level: '{level}-й уровень',
    levelPercent: '{level}-й уровень, {percent} %',
    xp: '{xp} из {max} опыта',
    experience: 'Опыт',
    width: 'Ширина панели',
    widthHint: 'Перетащите, чтобы изменить размер. Дважды щелкните, чтобы сбросить.',
  },

  now: {
    attention: 'Внимание',
    inGame: 'В игре',
    pins: 'Мои точки',
    quests: 'Задания',
    nearby: 'Рядом',
    handIn: 'Сдать',
    objective: 'Задача',
    quest: 'Задание',
    entrance: 'Вход',
    corpse: 'Тело',
    // The service, not the NPC: "Распорядитель полетов" and "Хозяин стойл" would take the room of the name beside them.
    flight: 'Полеты',
    inn: 'Таверна',
    bank: 'Банк',
    auction: 'Аукцион',
    stable: 'Стойла',
    trainer: 'Учитель',
    repair: 'Ремонт',
    vendor: 'Торговец',
    onSale: 'В продаже',
    cheaper: 'Дешевле',
    dearer: 'Дороже',
    otherContinent: 'На другом континенте',
    yards: '{yards} м',
    finding: 'Поиск пути',
    updateHint: 'Обновите Shortest Path и аддон Twinmap Forever, чтобы видеть здесь весь путь',
  },

  journey: {
    // "Путь", not "Маршрут": Маршрут is Twinmap's own Route.
    name: 'Путь',
    // The game's short forms (GS SECONDS_ABBR, MINUTES_ABBR, HOURS_ABBR).
    seconds: '{seconds} с.',
    minutes: '{minutes} мин.',
    hours: '{hours} ч. {minutes} мин.',
  },

  death: {
    corpse: 'Ваше тело',
  },

  send: {
    pointNoZone: 'Эта точка не находится ни в одной зоне, которую игра может отметить.',
    stopNoZone: 'Одна из остановок не находится ни в одной зоне, которую игра может отметить.',
    notConnected: 'Игра не подключена.',
    notListening: 'Игра пока не принимает данные. Если так и останется, обновите аддон и перезапустите игру.',
    reload: 'Введите /reload в игре, чтобы отправить снова.',
    restart: 'Перезапустите игру один раз: связь из Twinmap в игру заработает при следующем запуске.',
    pin: 'Точка',
    stop: 'Остановка',
  },

  firstRun: {
    steps: 'Шаги',
    building: 'Создание карты',
    // "примерно", not "около": около takes the genitive and would break the plural forms.
    secondsLeft: {
      one: 'осталась примерно {count} секунда',
      few: 'осталось примерно {count} секунды',
      many: 'осталось примерно {count} секунд',
      other: 'осталось примерно {count} секунды',
    },
    minutesLeft: {
      one: 'осталась примерно {count} мин.',
      few: 'осталось примерно {count} мин.',
      many: 'осталось примерно {count} мин.',
      other: 'осталось примерно {count} мин.',
    },
    skip: 'Пропустить, открыть карту',
    back: 'Назад',
    next: 'Далее',
    toMap: 'Перейти к карте',
    chooseFolder: 'Выбрать папку игры',
    chooseAnother: 'Выбрать другую папку',
    getAddon: 'Скачать Twinmap Forever на CurseForge',
    getOptional: 'Скачать {name} на CurseForge',
    retry: 'Повторить',
    photosensitivity: 'Предупреждение о светочувствительности: аддон передает данные, много раз в секунду меняя цвета линии толщиной в один пиксель у края окна игры. В его параметрах в игре передачу можно замедлить или поставить на паузу.',
    game: {
      title: 'Найти игру',
      intro: 'Twinmap нужно знать, где установлена игра World of Warcraft: Forever. Приложение только читает эту папку и никогда ничего в ней не меняет.',
      found: 'Найдено.',
      notFound: 'Игра не найдена на этом компьютере.',
      choose: 'Выберите папку, в которую она установлена: ту, в которой есть _forever_.',
    },
    map: {
      title: 'Создать карту',
      intro: 'Twinmap рисует карту по файлам вашей собственной игры, поэтому она всегда соответствует вашей версии игры. Это делается один раз и повторяется только после обновления игры. Ничего не скачивается.',
      waiting: 'Ожидание папки игры.',
      opening: 'Открытие файлов игры.',
      reading: 'Чтение изображений мира из самой игры.',
      failed: 'Не удалось создать карту.',
      ready: 'Карта готова.',
      // The count after a colon: not a plural key.
      tiles: 'Фрагментов: {count}, версия игры: {version}.',
    },
    addon: {
      title: 'Скачать аддон',
      intro: 'Аддон Twinmap Forever сообщает этому приложению, где находится ваш персонаж. Он устанавливается, как любой другой аддон, через CurseForge.',
      installed: 'Установлен.',
      inFolder: 'Twinmap Forever {version} находится в папке AddOns игры.',
      notYet: 'Еще не установлен.',
      howTo: 'Установите его через приложение CurseForge. Без этого приложения скачайте файл с той же страницы и распакуйте его в _forever_\\Interface\\AddOns.',
      howToMac: 'Установите его через приложение CurseForge. Без этого приложения скачайте файл с той же страницы и распакуйте его в _forever_/Interface/AddOns.',
      notices: 'Эта страница сама заметит, когда аддон появится.',
    },
    extras: {
      title: 'Дополнительные аддоны',
      intro: 'Ни один из них не обязателен. Если какой-то установлен, Twinmap показывает больше.',
      questie: 'QuestieDB: установлен. Карта показывает NPC с услугами, руду, травы и задания из вашего журнала. Если запущен и Questie, на ней те же задания, что показывает Questie, включая те, которые можно взять.',
      noQuestie: 'QuestieDB: не установлен. Он устанавливается вместе с Twinmap Forever из приложения CurseForge. Без него на карте нет NPC, услуг и заданий.',
      shortestPath: 'Shortest Path: установлен. Карта будет показывать его путь, а к точкам, которые вы отправляете в игру, путь будет проложен по дорогам.',
      noShortestPath: 'Shortest Path: не установлен. С ним карта показывает путь, который он прокладывает, а к точкам, которые вы отправляете в игру, путь прокладывается по дорогам.',
    },
    play: {
      title: 'Запустить игру',
      // "войдите в игровой мир", as the game's button (GS ENTER_WORLD "Войти в игровой мир").
      intro: 'Запустите World of Warcraft: Forever и войдите в игровой мир одним из персонажей. Ваше местоположение появится здесь само.',
      connected: 'Подключено. Ваше местоположение поступает.',
      silent: 'Игра открыта, но от аддона пока ничего не приходит.',
      minimized: 'Игра свернута. Верните ее окно на экран.',
      waiting: 'Ожидание игры.',
      // "Модификации", as the ruRU character list button (GS ADDONS).
      tick: 'На экране выбора персонажа откройте "Модификации" и убедитесь, что Twinmap Forever отмечен.',
    },
  },

  update: {
    updating: 'Обновление',
    updatingTo: 'Обновление до версии {version}',
    installing: 'Установка версии {version}',
    reopen: 'Twinmap откроется снова через несколько секунд',
    downloading: 'Загрузка новой версии',
  },

  web: {
    // Rewritten so no past tense has to agree with Twinmap.
    noAnswer: 'Нет ответа от Twinmap на компьютере.',
    chooseOnComputer: 'Выберите папку игры в Twinmap на компьютере.',
  },

  main: {
    pickFolder: 'Где установлена игра World of Warcraft: Forever?',
    notGame: 'В этой папке нет World of Warcraft: Forever. Выберите ту, в которой есть _forever_.',
    savePicture: 'Сохранить изображение: {name}',
    noNetwork: 'Этот компьютер не подключен к домашней сети.',
    portTaken: 'Порт {port} занят другой программой.',
    scanAgain: 'Откройте параметры Twinmap на компьютере и снова отсканируйте код.',
    nothingToSend: 'Нечего отправлять.',
    cannotWrite: 'Twinmap не удалось записать файл рядом с аддоном в папке игры.',
  },

  found: {
    npc: 'NPC',
    // The giver after a colon, in the nominative; the level as the game writes it.
    quest: 'Задание, выдает: {giver}',
    questLevel: 'Задание, {level}-й уровень, выдает: {giver}',
    // A noun before the name, so nothing has to agree with it.
    soldBy: 'Торговец: {name}',
    // As the game's "Добыча с босса: %s".
    droppedBy: 'Добыча: {name}',
    // "Источник": the name can be an object (a chest, a plant), where "в" or "на" would also need a case.
    foundIn: 'Источник: {name}',
    questNumber: 'Задание {id}',
    // Under an NPC: the game's names of the NPCs themselves (minimap tracking), lower case.
    services: {
      flight: 'распорядитель полетов',
      inn: 'хозяин таверны',
      vendor: 'торговец',
      repair: 'ремонт',
      trainer: 'учитель',
      bank: 'банкир',
      auction: 'аукционер',
      stable: 'хозяин стойл',
    },
  },
}
