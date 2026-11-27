// Das Deutsch der Optionen: the notes on every key are in en/settings.ts.
export default {
  // The game's menu entry is "Optionen" (GS GAMEMENU_OPTIONS), not "Einstellungen".
  title: 'Optionen',
  categories: {
    label: 'Kategorien',
    general: 'Allgemein',
    appearance: 'Darstellung',
    game: 'Spiel und Addons',
    privacy: 'Datenschutz',
    about: 'Über Twinmap',
  },

  gameFolder: {
    title: 'Spielordner',
    notFound: 'Nicht gefunden',
    change: 'Ordner ändern',
    choose: 'Spielordner wählen',
  },

  distances: {
    label: 'Entfernungen',
    yards: 'Yards',
    metres: 'Meter',
  },

  layout: {
    label: 'Karte',
    left: 'Links',
    right: 'Rechts',
    hint: 'Mit M wechselt sie jederzeit die Seite.',
    custom: 'Eure Anordnung legt die Karte fest: Verschiebt sie mit {edit}.',
  },

  mapLook: {
    label: '2D-Karte',
    tiles: 'Minikarte',
    parchment: 'Weltkarte',
    hint: 'Als Weltkarte wird sie wie die Karte des Spiels gezeichnet, jede Zone wie erkundet, ohne die Ortsnamen von Twinmap. Die 3D-Ansicht bleibt bei der Minikarte.',
  },

  arrow: {
    title: 'Pfeil',
    colour: 'Farbe',
    size: 'Größe',
    default: 'Standard',
  },

  icons: {
    label: 'Kartensymbole',
    game: 'Spiel',
    hint: 'Für verfügbare Quests, Quests zum Abgeben und Questziele. Wo die gewählten Symbole keines haben, erscheint das von Twinmap.',
  },

  objectives: {
    label: 'Questziele',
    icons: 'Symbole',
    areas: 'Bereiche',
    hint: 'Die Bereiche werden wie auf der Spielkarte um die Orte gezeichnet, an denen Questie jedes Questziel zeigt.',
  },

  window: {
    // "Immer im Vordergrund" is how Windows and German apps name it.
    onTop: 'Twinmap immer im Vordergrund',
    // The game's "Schriftgröße" (GS FONT_SIZE).
    textSize: 'Schriftgröße',
    gpu: 'Hardwarebeschleunigung verwenden',
    gpuHint: 'Deaktiviert sie, wenn die Karte flimmert oder schwarz bleibt. Ohne sie ist die 3D-Ansicht langsamer.',
    // As the game's CLIENT_RESTART_ALERT.
    restartNeeded: 'Wird erst nach dem Neustart von Twinmap wirksam.',
    // The game's "Neu starten" (GS RESTART): "Jetzt neu starten" is long beside restartNeeded.
    restartNow: 'Neu starten',
  },

  phone: {
    // "Handy" is what German players say for a phone.
    title: 'Handy und Tablet',
    share: 'Karte auf anderen Geräten anzeigen',
    codeLabel: 'Die Adresse daneben als Code für die Kamera eines Handys',
    scan: 'Scannt den Code oder öffnet',
    homeOnly: 'Nur für Geräte in Eurem Heimnetz. Windows bittet eventuell einmal um Erlaubnis.',
  },

  participate: {
    share: 'Anonyme Daten über die Welt von Forever teilen',
    // Worded as participate.what in de/index.ts. Account as the game says it (GS MANAGE_ACCOUNT "Mein Account").
    what: 'Aus, solange Ihr es nicht einschaltet. Twinmap sendet, was ihm hilft, Euch in Dungeons besser zu finden und zu ergänzen, was der Karte fehlt: die Minikarte in Dungeons, wo Bosse und seltene Gegner sterben, die Eingänge der Dungeons, was Lehrer beibringen, die Kreaturen, Objekte und Quests, die Questie nicht kennt, und die Fehler von Twinmap selbst. Nie einen Namen, einen Charakter, einen Account, den Chat oder den Rest Eures Bildschirms. Schaltet Ihr es aus, wird nichts mehr gesendet.',
  },

  found: {
    inFolder: 'Darin gefunden',
    addon: 'Twinmap-Forever-Addon',
    // "Dienste" as the services layer (de/map.ts).
    questie: 'NSC, Dienste und Quests',
    optional: 'optional',
    installed: 'Installiert',
    get: 'Von CurseForge laden',
    map: 'Karte',
    mapLooking: 'Wird gesucht',
    mapNoGame: 'Wartet auf den Spielordner',
    // A no-break space before %, as Intl de-DE writes it.
    mapBuilding: 'Wird erstellt, {percent} %',
    mapFailed: 'Nicht erstellt: {message}',
    mapReady: 'Bereit, Spiel {version}',
  },

  version: {
    updates: 'Aktualisiert sich beim Start. Das Addon wird über CurseForge aktualisiert.',
    report: 'Fehler oder Idee melden',
    firstRun: 'Erste Schritte wiederholen',
  },

  keys: {
    // Key Bindings in the game (GS KEY_BINDINGS).
    title: 'Tastaturbelegung',
    layers: 'Filter',
    // The game's "ein/aus" (GS BINDING_NAME_TOGGLEWORLDMAP "Weltkarte ein/aus").
    follow: 'Folgen ein/aus',
    // "genordet" is the German word for a map with north up.
    north: 'Karte dreht sich mit Eurem Charakter oder ist genordet',
    side: 'Karte auf die andere Seite',
    spaces: 'Die Bereiche oben, von links nach rechts',
    fullScreen: 'Vollbild',
    // German keyboards say Strg, as the game (GS CTRL_KEY_TEXT).
    ctrl: 'Strg',
    zoom: 'Schriftgröße, auch Strg und Mausrad außerhalb der Karte',
    // Our word for the label of a point: "Infofeld". "diese Optionen": the page is called Optionen.
    close: 'Schließt ein Infofeld, die Filter, diese Optionen',
    // Not "Pfeile": the Arrow of the route is "Pfeil".
    arrows: 'Pfeiltasten',
    move: 'Karte verschieben und zoomen',
    // The game's name of the button (GS KEY_BUTTON2): the drag goes in turn.
    rightDrag: 'Rechte Maustaste',
    turn: 'Halten und ziehen: Karte drehen',
    // The game's name of the key (GS KEY_SPACE).
    space: 'Leertaste',
    label: 'Infofeld in der Kartenmitte',
  },

  about: {
    // Product and licence names stay as they are.
    what: 'Eine Live-Karte von World of Warcraft: Forever für Euren zweiten Bildschirm. Freie Software unter der GNU General Public License, Version 3. Ohne jegliche Gewährleistung.',
    notAffiliated: 'Steht in keiner Verbindung zu Blizzard Entertainment und wird nicht von Blizzard Entertainment unterstützt. World of Warcraft ist eine Marke von Blizzard Entertainment, Inc.',
    built: {
      one: 'Erstellt mit {count} Projekt: seine Lizenz',
      other: 'Erstellt mit {count} Projekten: ihre Lizenzen',
    },
    seeText: 'Text anzeigen',
  },

  feedback: {
    title: 'Feedback',
    // A GitHub issue is "Issue", as German developers call it.
    intro: 'Einen Fehler gefunden oder eine Idee? Sagt es uns. Schreibt hier und klickt auf Senden, eröffnet ein Issue auf GitHub oder schreibt eine E-Mail. Ihr seht jedes Wort, bevor es gesendet wird.',
    placeholder: 'Was passiert ist oder was Ihr Euch wünscht',
    message: 'Eure Nachricht',
    email: 'Eure E-Mail, falls Ihr eine Antwort möchtet',
    withLog: 'Protokoll anhängen',
    send: 'Senden',
    sending: 'Wird gesendet',
    github: 'Issue auf GitHub eröffnen',
    letter: 'E-Mail schreiben',
    sent: 'Gesendet. Vielen Dank.',
    carries: 'Mit Senden geht Eure Nachricht an den Entwickler von Twinmap: der Text, den Ihr geschrieben habt, die hier gezeigten Details sowie Eure E-Mail und das Protokoll nur, wenn Ihr sie hinzufügt. Nichts wird gesendet, bevor Ihr auf Senden klickt.',
    privacy: 'Datenschutz',
    // The address goes after a colon, not after "an".
    noGithub: 'Kein GitHub-Account? Schreibt uns auf Englisch oder Italienisch: {email}',
    details: 'Was Twinmap Eurer Nachricht hinzufügt',
    logCopy: 'Bei einem Fehler hilft das Protokoll: Darin hält Twinmap fest, was mit ihm passiert ist (Start, Spiel gefunden, Karte, Verbindung). Hängt es an Eure Nachricht an, oder kopiert es und fügt es in ein Issue oder eine E-Mail ein.',
    log: 'Bei einem Fehler hilft das Protokoll: Darin hält Twinmap fest, was mit ihm passiert ist (Start, Spiel gefunden, Karte, Verbindung). Hängt es an Eure Nachricht an.',
    copyDetails: 'Details kopieren',
    copyLog: 'Protokoll kopieren',
    copied: 'Kopiert',
    close: 'Schließen',
    letterTop: 'Was passiert ist oder was Ihr Euch wünscht:',
    fails: {
      empty: 'Schreibt zuerst Eure Nachricht.',
      tooLong: 'Eure Nachricht ist zu lang: höchstens {most} Zeichen.',
      tooMany: 'Zu viele Nachrichten in kurzer Zeit. Wartet eine Minute und sendet erneut.',
      badEmail: 'Die E-Mail-Adresse scheint nicht zu stimmen.',
      notDelivered: 'Die Nachricht konnte nicht zugestellt werden. Versucht es später erneut oder nutzt GitHub oder E-Mail.',
      noAnswer: 'Keine Antwort vom Server. Prüft Eure Verbindung und sendet erneut.',
    },
  },
}
