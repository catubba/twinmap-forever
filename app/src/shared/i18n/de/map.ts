// Das Deutsch der Karte: the notes on every key are in en/map.ts.
export default {
  layers: {
    button: 'Filter',
    buttonTip: 'Filter (L)',
    menu: 'Kartenfilter',
    // Group after a colon: "alle {group}" would need the plural and case of each group name (die Quests, die Welt).
    hideAll: 'Alle ausblenden: {group}',
    showAll: 'Alle anzeigen: {group}',
    kinds: 'Arten: {layer}',
    hideGrey: 'Graue ausblenden',
    hideGreyTip: 'Ausblenden, was Eure Fertigkeit nicht mehr erhöht',
    skill: 'Fertigkeit {skill}',
    notLearned: 'Nicht erlernt',
    skillUnread: 'Fertigkeit noch nicht gelesen',
    groups: {
      you: 'Ihr',
      quests: 'Quests',
      services: 'Dienste',
      // Ore and herbs: "Rohstoffe" is the everyday word, shorter than "Ressourcen".
      resources: 'Rohstoffe',
      world: 'Welt',
      group: 'Gruppe',
    },
    // Service layers follow the game's minimap tracking menu (glossary), so the NPC, not the place.
    names: {
      arrow: 'Pfeil',
      route: 'Route',
      mypins: 'Meine Markierungen',
      death: 'Leichnam und Friedhof',
      available: 'Verfügbar',
      turnin: 'Abgeben',
      objectives: 'Questziele',
      flight: 'Flugmeister',
      inn: 'Gastwirt',
      vendors: 'Händler',
      repair: 'Reparieren',
      trainers: 'Lehrer',
      bank: 'Bankier',
      auction: 'Auktionator',
      stable: 'Stallmeister',
      ore: 'Erze',
      herbs: 'Kräuter',
      zones: 'Ortsnamen',
      relief: 'Relief',
      caves: 'Höhlen',
      dungeons: 'Dungeons',
      routes: 'Flugrouten',
      bosses: 'Dungeonbosse',
      companions: 'Gruppe',
    },
  },

  continents: {
    easternKingdoms: 'Östliche Königreiche',
    kalimdor: 'Kalimdor',
  },

  corner: {
    // Place after a colon: "Zurück zu {place}" would need the case and article of each name (zum Schlingendorntal).
    back: 'Zurück: {place}',
    view3d: '3D-Ansicht',
    view3dTip: '2D- oder 3D-Ansicht (3)',
    turn: 'Mit Eurem Charakter drehen',
    turnTip: 'Mit Eurem Charakter drehen (N)',
    northUpTip: 'Norden oben (N)',
    // Floors of a dungeon: "Etagen", since "Stufe" is the character's level and "Ebenen" are the layers.
    levels: 'Etagen',
    levelsShown: 'Angezeigte Etagen',
    everyRoom: 'Alle Räume',
    roomsUpTo: 'Räume bis Etage {level}',
    zoomIn: 'Vergrößern',
    zoomInTip: 'Vergrößern (+)',
    zoomOut: 'Verkleinern',
    zoomOutTip: 'Verkleinern (-)',
    follow: 'Folgen',
    followTip: 'Eurem Charakter folgen (F)',
  },

  offMap: 'Dieser Ort ist nicht auf der Karte.',
  fps: '{fps} FPS',
  nothingToSend: 'Es gibt nichts zu senden.',

  pins: {
    rewardXp: '{xp} EP',
    entrance: 'Eingang',
    entranceOf: 'Eingang: {name}',
    // Rare as the game's map legend says it for creatures (glossary).
    rareBoss: '{name} (selten)',
    graveyard: 'Friedhof',
    corpse: 'Euer Leichnam',
    followed: '{name}, im Spiel verfolgt',
    journey: '{name}, Ziel der Reise im Spiel',
    quest: {
      available: 'Verfügbare Quest',
      turnin: 'Quest zum Abgeben',
      objective: 'Questziel',
    },
    objective: {
      slay: 'Questziel: töten',
      loot: 'Questziel: plündern',
      object: 'Questziel: benutzen',
      talk: 'Questziel: sprechen',
      event: 'Questziel: hingehen',
    },
  },

  // x and y come from toFixed (a dot, as 42.3), so the comma between them stays unambiguous.
  place: {
    coords: '{x}, {y}',
    inZone: '{zone} {x}, {y}',
  },

  way: {
    north: '{far} nördlich',
    northEast: '{far} nordöstlich',
    east: '{far} östlich',
    southEast: '{far} südöstlich',
    south: '{far} südlich',
    southWest: '{far} südwestlich',
    west: '{far} westlich',
    northWest: '{far} nordwestlich',
    onFoot: '{time} zu Fuß',
  },

  label: {
    pinName: 'Name der Markierung',
    far: '{far}, {time}',
    dungeonMap: 'Dungeonkarte',
    raidMap: 'Schlachtzugskarte',
    send: 'Ins Spiel senden',
    sending: 'Wird gesendet',
    sent: 'Gesendet',
    stopFollowing: 'Nicht mehr folgen',
    // A stop of the route is a "Wegpunkt" (glossary): shorter than "Zur Route hinzufügen" on a small button.
    addToRoute: 'Wegpunkt setzen',
    inRoute: 'Bereits Wegpunkt',
    save: 'Speichern',
    remove: 'Entfernen',
    noAnswer: 'Noch keine Antwort vom Spiel. Es übernimmt die Markierung, sobald Ihr nicht mehr im Kampf seid.',
  },

  nextStop: {
    none: 'Keine Route. Klickt auf die Karte, um einen Wegpunkt hinzuzufügen.',
    title: 'Nächster Wegpunkt',
    count: '{n} von {of}',
    complete: 'Route abgeschlossen',
    // Other continent, or inside or outside a dungeon: "Eure Karte" says it more plainly than "ground".
    elsewhere: 'Nicht auf Eurer aktuellen Karte',
    here: 'Hier',
    minutes: 'Min. zu Fuß',
    // Three buttons side by side: "Auslassen" is shorter than "Überspringen"; the band is about the route already, so the verb alone.
    skip: 'Auslassen',
    edit: 'Bearbeiten',
    clear: 'Leeren',
    unsent: 'Noch nicht im Spiel',
    // Same reason: "Route ins Spiel senden" is too long beside the note on the same line.
    send: 'Ins Spiel senden',
    onItsWay: 'Wird ans Spiel gesendet.',
    moveUp: 'Nach oben: {name}',
    moveDown: 'Nach unten: {name}',
    remove: 'Entfernen: {name}',
  },

  search: {
    // Without the verb, beside the magnifier, as in French.
    placeholder: 'NSC, Gegenstände, Quests, Zonen',
    field: 'Suche',
    results: 'Ergebnisse',
    none: 'Nichts mit diesem Namen.',
    zone: 'Zone',
    myPin: 'Meine Markierung',
    myPinIn: 'Meine Markierung, {zone}',
    dungeon: 'Dungeon',
    dungeonIn: 'Dungeon, {zone}',
    raid: 'Schlachtzug',
    raidIn: 'Schlachtzug, {zone}',
    foundIn: '{what}, {zone}',
  },
}
