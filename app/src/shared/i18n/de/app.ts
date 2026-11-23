// Das Deutsch von app: the notes on every key are in en/app.ts.
export default {
  top: {
    sections: 'Bereiche',
    now: 'Jetzt',
    // "Inventar": Gegenstände is too long for a tab in a narrow window, where the character's name would vanish.
    items: 'Inventar',
    auctionHouse: 'Auktionshaus',
    // As German players write it.
    auctionHouseShort: 'AH',
    pause: 'Twinmap pausieren',
    resume: 'Twinmap fortsetzen',
    sendsLeft: { one: 'Noch {count} Übertragung', other: 'Noch {count} Übertragungen' },
    // Our choice: the game has no "Feedback" button. Named again in tiles.failedHelp.
    feedback: 'Feedback',
    feedbackHint: 'Fehler oder Idee melden',
    settings: 'Optionen',
  },

  link: {
    paused: 'Pausiert',
    closed: 'Spiel geschlossen',
    closedLine: 'Das Spiel läuft nicht. Die Karte funktioniert trotzdem; Eure Position erscheint, sobald Ihr Euch einloggt.',
    minimized: 'Spiel minimiert',
    minimizedLine: 'Spiel minimiert. Eure Position erscheint, sobald sein Fenster wieder auf dem Bildschirm ist.',
    updateApp: 'App aktualisieren',
    updateAddon: 'Addon aktualisieren',
    newerAddon: 'Das Twinmap-Forever-Addon ist neuer als diese App (Protokoll {addon}, diese App nutzt {app}). Schließt Twinmap und öffnet es erneut: Beim Start aktualisiert es sich selbst.',
    newerAddonMac: 'Das Twinmap-Forever-Addon ist neuer als diese App (Protokoll {addon}, diese App nutzt {app}). Ladet das neueste Twinmap für macOS herunter.',
    olderAddon: 'Das Twinmap-Forever-Addon ist älter als diese App (Protokoll {addon}, diese App nutzt {app}). Aktualisiert das Addon über CurseForge und startet dann das Spiel neu.',
    connecting: 'Verbinde',
    // "Disconnected": short, the line under it says why.
    lost: 'Getrennt',
    lostLine: 'Kein Signal vom Spiel. Loggt Euch ein und prüft, ob das Twinmap-Forever-Addon aktiv ist und sein Streifen nicht pausiert ist.',
    combat: 'Im Kampf, nur Position',
    connected: 'Verbunden',
    minimapTurns: 'In einem Dungeon wird Eure Position von der Minikarte gelesen, und das geht nicht, solange sie sich dreht: Schaltet "Minikarte drehen" im Spiel aus.',
    noRooms: 'Twinmap hat keine Bilder von diesem Dungeon: Eure Position wird hier drin nicht angezeigt.',
    noMinimap: 'In einem Dungeon wird Eure Position von der Minikarte gelesen, doch das Spiel liefert keine: Aktualisiert das Twinmap-Forever-Addon und lasst die Minikarte auf dem Bildschirm.',
    looking: 'Eure Position wird gesucht. Sie wird von der Minikarte des Spiels gelesen: Lasst sie auf dem Bildschirm, ohne etwas darüber.',
  },

  map: {
    addonMissing: 'Das Twinmap-Forever-Addon ist nicht in Eurem Spiel, daher kann keine Position ankommen. Holt es Euch auf CurseForge und startet dann das Spiel neu.',
    getAddon: 'Auf CurseForge holen',
    paused: 'Twinmap ist pausiert: Die Karte bleibt, wo Ihr wart, und Euer Charakter wird nicht verfolgt.',
    resume: 'Fortsetzen',
    unknownZone: 'Unbekannte Zone',
  },

  tiles: {
    builtOnce: 'Das passiert nur beim ersten Mal und erneut nach jedem Update des Spiels.',
    noGameHelp: 'Wählt den Ordner, in dem World of Warcraft: Forever installiert ist: den, der _forever_ enthält.',
    failedHelp: 'Twinmap konnte die Spieldateien nicht lesen. Schließt den Launcher des Spiels, falls er das Spiel gerade aktualisiert oder repariert, und versucht es dann erneut. Schlägt es wieder fehl, repariert das Spiel über den Launcher und gebt uns über Feedback Bescheid.',
    looking: 'Spiel wird gesucht.',
    noGame: 'Der Spielordner wurde nicht gefunden.',
    converting: 'Karte wird aus Euren Spieldateien erstellt, {percent} %.',
    ready: 'Karte: {tiles} Kacheln bereit, Spiel {version}, {rooms} Räume',
    readyReading: 'Karte: {tiles} Kacheln bereit, Spiel {version}, Räume werden gelesen',
    readyNoRooms: 'Karte: {tiles} Kacheln bereit, Spiel {version}, Räume nicht gelesen ({problem})',
    failed: 'Die Karte konnte nicht erstellt werden: {message}',
    chooseFolder: 'Spielordner wählen',
    retry: 'Erneut versuchen',
  },

  elsewhere: {
    title: 'Schließt die Einrichtung am Computer ab',
    text: 'Twinmap wird auf dem Computer noch eingerichtet: Dort steht, was noch zu tun ist. Die Karte öffnet sich hier von selbst, sobald alles fertig ist.',
  },

  panel: {
    close: 'Schließen',
    open: 'Quests und Umgebung',
    mapLeft: 'Karte links (M)',
    mapRight: 'Karte rechts (M)',
    showing: 'Angezeigt: {name}',
    backTo: 'Zurück zu {name}',
    level: 'Stufe {level}',
    levelPercent: 'Stufe {level}, {percent} %',
    xp: '{xp} von {max} EP',
    experience: 'Erfahrung',
    width: 'Breite der Seitenleiste',
    widthHint: 'Ziehen, um die Größe zu ändern. Doppelklick zum Zurücksetzen.',
  },

  now: {
    attention: 'Achtung',
    inGame: 'Im Spiel',
    pins: 'Meine Markierungen',
    quests: 'Quests',
    nearby: 'In der Nähe',
    handIn: 'Abgeben',
    objective: 'Questziel',
    quest: 'Quest',
    entrance: 'Eingang',
    corpse: 'Leichnam',
    flight: 'Flugmeister',
    inn: 'Gastwirt',
    bank: 'Bank',
    auction: 'Auktionator',
    stable: 'Stallmeister',
    trainer: 'Lehrer',
    repair: 'Reparieren',
    vendor: 'Händler',
    onSale: 'Im Angebot',
    cheaper: 'Günstiger',
    dearer: 'Teurer',
    otherContinent: 'Auf dem anderen Kontinent',
    yards: '{yards} m',
    finding: 'Weg wird gesucht',
    updateHint: 'Aktualisiert Shortest Path und das Twinmap-Forever-Addon, um hier den ganzen Weg zu sehen',
  },

  journey: {
    // "Reise", not "Route": Route is Twinmap's own Route.
    name: 'Reise',
    // The game's short forms (GS SECONDS_ABBR, MINUTES_ABBR, HOURS_ABBR).
    seconds: '{seconds} Sek.',
    minutes: '{minutes} Min.',
    hours: '{hours} Std. {minutes} Min.',
  },

  death: {
    corpse: 'Euer Leichnam',
  },

  send: {
    pointNoZone: 'Dieser Punkt liegt in keiner Zone, die das Spiel markieren kann.',
    stopNoZone: 'Ein Wegpunkt liegt in keiner Zone, die das Spiel markieren kann.',
    notConnected: 'Das Spiel ist nicht verbunden.',
    notListening: 'Das Spiel hört noch nicht zu. Bleibt das so, aktualisiert das Addon und startet das Spiel neu.',
    reload: 'Gebt /reload im Spiel ein, um erneut zu senden.',
    restart: 'Startet das Spiel einmal neu: Die Verbindung von Twinmap öffnet sich beim nächsten Start.',
    pin: 'Markierung',
    stop: 'Wegpunkt',
  },

  firstRun: {
    steps: 'Schritte',
    building: 'Karte wird erstellt',
    secondsLeft: { one: 'noch etwa {count} Sekunde', other: 'noch etwa {count} Sekunden' },
    minutesLeft: { one: 'noch etwa {count} Min.', other: 'noch etwa {count} Min.' },
    skip: 'Überspringen, zur Karte',
    back: 'Zurück',
    next: 'Weiter',
    toMap: 'Zur Karte',
    chooseFolder: 'Spielordner wählen',
    chooseAnother: 'Anderen Ordner wählen',
    getAddon: 'Twinmap Forever auf CurseForge holen',
    getOptional: '{name} auf CurseForge holen',
    retry: 'Erneut versuchen',
    photosensitivity: 'Warnung bei Lichtempfindlichkeit: Das Addon sendet Daten, indem es viele Male pro Sekunde die Farben einer ein Pixel breiten Linie am Rand des Spielfensters ändert. In seinen Optionen im Spiel lässt es sich verlangsamen oder pausieren.',
    game: {
      title: 'Spiel finden',
      intro: 'Twinmap muss wissen, wo World of Warcraft: Forever installiert ist. Es liest diesen Ordner nur und ändert darin nie etwas.',
      found: 'Gefunden.',
      notFound: 'Das Spiel wurde auf diesem PC nicht gefunden.',
      choose: 'Wählt den Ordner, in dem es installiert ist: den, der _forever_ enthält.',
    },
    map: {
      title: 'Karte erstellen',
      intro: 'Twinmap zeichnet seine Karte aus den Dateien Eures eigenen Spiels, daher passt sie immer zu Eurer Spielversion. Das geschieht einmal und danach nur nach einem Update des Spiels. Es wird nichts heruntergeladen.',
      waiting: 'Warte auf den Spielordner.',
      opening: 'Spieldateien werden geöffnet.',
      reading: 'Die Bilder der Welt aus dem Spiel werden gelesen.',
      failed: 'Die Karte konnte nicht erstellt werden.',
      ready: 'Die Karte ist fertig.',
      tiles: '{count} Kacheln aus Spielversion {version}.',
    },
    addon: {
      title: 'Addon holen',
      intro: 'Das Twinmap-Forever-Addon teilt dieser App mit, wo Euer Charakter ist. Es wird wie jedes andere Addon über CurseForge installiert.',
      installed: 'Installiert.',
      inFolder: 'Twinmap Forever {version} ist im AddOns-Ordner des Spiels.',
      notYet: 'Noch nicht installiert.',
      howTo: 'Installiert es mit der CurseForge-App. Ohne diese App ladet die Datei von derselben Seite herunter und entpackt sie nach _forever_\\Interface\\AddOns.',
      howToMac: 'Installiert es mit der CurseForge-App. Ohne diese App ladet die Datei von derselben Seite herunter und entpackt sie nach _forever_/Interface/AddOns.',
      notices: 'Diese Seite bemerkt von selbst, wenn das Addon da ist.',
    },
    extras: {
      title: 'Optionale Addons',
      intro: 'Keines davon ist nötig. Ist eines installiert, zeigt Twinmap mehr.',
      questie: 'QuestieDB: installiert. Die Karte zeigt, wer einen Dienst anbietet, Erze, Kräuter und die Quests Eures Questlogs. Läuft auch Questie, zeigt sie dieselben Quests wie Questie, auch die, die Ihr annehmen könnt.',
      noQuestie: 'QuestieDB: nicht installiert. Es kommt mit Twinmap Forever aus der CurseForge-App. Ohne es zeigt die Karte keine NSC, keine Dienste und keine Quests.',
      shortestPath: 'Shortest Path: installiert. Die Karte zeigt seine Reise, und was Ihr an das Spiel sendet, wird entlang der Wege erreicht.',
      noShortestPath: 'Shortest Path: nicht installiert. Damit zeigt die Karte die Reise, die es plant, und was Ihr an das Spiel sendet, wird entlang der Wege erreicht.',
    },
    play: {
      title: 'Spiel starten',
      // "betretet die Welt", as the game's button (GS ENTER_WORLD "Welt betreten").
      intro: 'Startet World of Warcraft: Forever und betretet mit einem Charakter die Welt. Eure Position erscheint hier von selbst.',
      connected: 'Verbunden. Eure Position kommt an.',
      silent: 'Das Spiel ist offen, aber vom Addon kommt noch nichts.',
      minimized: 'Das Spiel ist minimiert. Holt sein Fenster zurück auf den Bildschirm.',
      waiting: 'Warte auf das Spiel.',
      // "Addons", as the deDE character list button (GS ADDONS).
      tick: 'Öffnet in der Charakterauswahl Addons und prüft, ob Twinmap Forever angehakt ist.',
    },
  },

  update: {
    updating: 'Aktualisierung',
    updatingTo: 'Aktualisierung auf Version {version}',
    installing: 'Version {version} wird installiert',
    reopen: 'Twinmap öffnet sich in wenigen Sekunden erneut',
    downloading: 'Neue Version wird heruntergeladen',
  },

  web: {
    noAnswer: 'Twinmap auf dem Computer hat nicht geantwortet.',
    chooseOnComputer: 'Wählt den Spielordner in Twinmap auf dem Computer.',
  },

  main: {
    pickFolder: 'Wo ist World of Warcraft: Forever installiert?',
    notGame: 'World of Warcraft: Forever ist nicht in diesem Ordner. Wählt den, der _forever_ enthält.',
    savePicture: 'Bild speichern: {name}',
    noNetwork: 'Dieser Computer ist mit keinem Heimnetzwerk verbunden.',
    portTaken: 'Port {port} wird von einem anderen Programm belegt.',
    scanAgain: 'Öffnet die Optionen von Twinmap auf dem Computer und scannt den Code erneut.',
    nothingToSend: 'Es gibt nichts zu senden.',
    screenRecording: 'Erlaubt Twinmap unter Systemeinstellungen > Datenschutz & Sicherheit > Bildschirmaufnahme',
    cannotWrite: 'Twinmap konnte im Spielordner nicht neben das Addon schreiben.',
  },

  found: {
    npc: 'NSC',
    quest: 'Quest von {giver}',
    questLevel: 'Quest, Stufe {level}, von {giver}',
    // A noun before the name, so nothing has to agree with it.
    soldBy: 'Händler: {name}',
    // As the game's "Bossbeute: %s".
    droppedBy: 'Beute: {name}',
    foundIn: 'Fundort: {name}',
    questNumber: 'Quest {id}',
    // Under an NPC: the game's names of the NPCs themselves (minimap tracking), capitalized as German nouns are.
    services: {
      flight: 'Flugmeister',
      inn: 'Gastwirt',
      vendor: 'Händler',
      repair: 'Reparieren',
      trainer: 'Lehrer',
      bank: 'Bankier',
      auction: 'Auktionator',
      stable: 'Stallmeister',
    },
  },
}
