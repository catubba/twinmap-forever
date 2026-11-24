// Русский параметров: the notes on every key are in en/settings.ts.
export default {
  // The game's menu entry is "Параметры" (GS GAMEMENU_OPTIONS), not "Настройки".
  title: 'Параметры',
  categories: {
    label: 'Разделы',
    general: 'Общие',
    game: 'Игра и аддоны',
    privacy: 'Конфиденциальность',
    about: 'О Twinmap',
  },

  gameFolder: {
    title: 'Папка игры',
    // Feminine: it stands for "папка".
    notFound: 'Не найдена',
    change: 'Сменить папку',
    choose: 'Выбрать папку игры',
  },

  layout: {
    title: 'Расположение',
    mapLeft: 'Карта слева',
    mapRight: 'Карта справа',
  },

  window: {
    title: 'Окно',
    onTop: 'Показывать Twinmap поверх других окон',
    textSize: 'Размер текста',
    gpu: 'Использовать аппаратное ускорение',
    gpuHint: 'Отключите его, если карта мерцает или остается черной. Без него 3D-вид работает медленнее.',
    restartNeeded: 'Вступит в силу после перезапуска Twinmap.',
    // "Перезапустить сейчас" is long beside restartNeeded: the verb alone says it.
    restartNow: 'Перезапустить',
  },

  phone: {
    title: 'Телефон и планшет',
    share: 'Показывать карту на других моих устройствах',
    codeLabel: 'Адрес рядом в виде кода для камеры телефона',
    scan: 'Отсканируйте код или откройте',
    homeOnly: 'Только для устройств в вашей домашней сети. Windows может один раз запросить разрешение.',
  },

  participate: {
    share: 'Делиться анонимными данными о мире Forever',
    // Worded as participate.what in ru/index.ts. Chat is "чат", as in the game.
    what: 'Выключено, пока вы сами не включите. Twinmap отправляет то, что помогает точнее определять ваше место в подземельях и дополнять то, чего не хватает карте: мини-карту в подземельях, места гибели боссов и редких существ, входы в подземелья, то, чему учат учителя, существ, объекты и задания, которых не знает Questie, и свои ошибки. Никогда не отправляются имя, персонаж, учетная запись, чат и остальное содержимое вашего экрана. Выключите, и больше ничего отправляться не будет.',
  },

  found: {
    title: 'Что нашел Twinmap',
    addon: 'Аддон Twinmap Forever',
    // "Услуги" as the services layer (ru/map.ts).
    questie: 'NPC, услуги и задания',
    optional: 'необязательно',
    // Masculine: it stands for "аддон".
    installed: 'Установлен',
    get: 'Скачать с CurseForge',
    map: 'Карта',
    mapLooking: 'Поиск',
    mapNoGame: 'Ожидание папки игры',
    // A no-break space before %, as Intl ru-RU writes it. Feminine forms below: they stand for "карта".
    mapBuilding: 'Создается, {percent} %',
    mapFailed: 'Не создана: {message}',
    mapReady: 'Готова, версия игры {version}',
  },

  version: {
    // No "itself": "сама" or "сам" would give Twinmap a gender.
    updates: 'Обновляется автоматически при запуске. Аддон обновляется через CurseForge.',
    report: 'Сообщить об ошибке или идее',
    firstRun: 'Пройти первые шаги заново',
  },

  keys: {
    // Key Bindings in the game (GS KEY_BINDINGS).
    title: 'Назначение клавиш',
    layers: 'Слои',
    follow: 'Следовать: вкл./выкл.',
    north: 'Карта поворачивается вместе с вашим персонажем или север вверху',
    side: 'Карта на другую сторону панели',
    fullScreen: 'Полноэкранный режим',
    // Russian keyboards print Ctrl (GS CTRL_KEY "CTRL").
    ctrl: 'Ctrl',
    zoom: 'Размер текста, а также Ctrl и колесо мыши вне карты',
    // "карточка": the label that opens on a point. "Слои" capitalized: the name of the menu.
    close: 'Закрывает карточку, Слои, эти параметры',
    // Not "Стрелки": the Arrow of the route is "Стрелка".
    arrows: 'Клавиши-стрелки',
    move: 'Перемещение и масштаб карты',
    // The game's name of the button (GS KEY_BUTTON2): the drag goes in turn, as in German.
    rightDrag: 'Правая кнопка мыши',
    turn: 'Удерживать и тянуть: поворот карты',
    // The game's name of the key (GS KEY_SPACE).
    space: 'Пробел',
    label: 'Карточка точки в центре карты',
  },

  about: {
    // Product and licence names stay as they are. "Приложение" as the subject, so the participles are neuter.
    what: 'Карта World of Warcraft: Forever в реальном времени для вашего второго экрана. Свободное программное обеспечение под лицензией GNU General Public License, версия 3. Предоставляется без каких-либо гарантий.',
    notAffiliated: 'Приложение не связано с Blizzard Entertainment и не одобрено ею. World of Warcraft является товарным знаком Blizzard Entertainment, Inc.',
    // "с помощью" takes the genitive: проекта after 1 and 21, проектов after 2-4 and 5-20. The count is dozens,
    // so "их лицензии" in every form.
    built: {
      one: 'Создано с помощью {count} проекта: их лицензии',
      few: 'Создано с помощью {count} проектов: их лицензии',
      many: 'Создано с помощью {count} проектов: их лицензии',
      other: 'Создано с помощью {count} проекта: их лицензии',
    },
    seeText: 'Показать текст',
  },

  feedback: {
    // Feedback is "Отзыв" (glossary).
    title: 'Отзыв',
    // A GitHub issue is "тикет", as Russian players call a support request.
    intro: 'Нашли ошибку или есть идея? Расскажите нам. Напишите здесь и нажмите "Отправить", или откройте тикет на GitHub, или напишите письмо. Вы увидите каждое слово до отправки.',
    placeholder: 'Что случилось или чего бы вам хотелось',
    message: 'Ваше сообщение',
    email: 'Ваш адрес эл. почты, если нужен ответ',
    withLog: 'Приложить журнал',
    send: 'Отправить',
    sending: 'Отправка',
    github: 'Открыть тикет на GitHub',
    letter: 'Написать письмо',
    sent: 'Отправлено. Спасибо.',
    carries: 'Кнопка "Отправить" передает ваше сообщение разработчику Twinmap: написанный вами текст, показанные здесь сведения, а ваш адрес эл. почты и журнал, только если вы их добавите. Ничего не отправляется, пока вы не нажмете "Отправить".',
    privacy: 'Конфиденциальность',
    // The address goes after a colon, not after "на".
    noGithub: 'Нет учетной записи GitHub? Пишите на английском или итальянском: {email}',
    details: 'Что Twinmap добавляет к вашему сообщению',
    logCopy: 'При ошибке поможет журнал: это собственная запись Twinmap о том, что происходило (запуск, игра найдена, карта, связь). Добавьте его к сообщению или скопируйте и вставьте в тикет или письмо.',
    log: 'При ошибке поможет журнал: это собственная запись Twinmap о том, что происходило (запуск, игра найдена, карта, связь). Добавьте его к сообщению.',
    copyDetails: 'Копировать сведения',
    copyLog: 'Копировать журнал',
    copied: 'Скопировано',
    close: 'Закрыть',
    letterTop: 'Что случилось или чего бы вам хотелось:',
    fails: {
      empty: 'Сначала напишите сообщение.',
      // {most} is 5000: "символов" fits it.
      tooLong: 'Сообщение слишком длинное: не более {most} символов.',
      tooMany: 'Слишком много сообщений за короткое время. Подождите минуту и отправьте снова.',
      badEmail: 'Похоже, адрес эл. почты указан неверно.',
      notDelivered: 'Не удалось доставить сообщение. Повторите попытку позже или воспользуйтесь GitHub или почтой.',
      noAnswer: 'Сервер не отвечает. Проверьте подключение и отправьте снова.',
    },
  },
}
