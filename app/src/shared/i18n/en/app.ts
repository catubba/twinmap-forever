// The English of app: see en/index.ts for how a key is written and noted.
export default {
  // The top row of the main screen (App.svelte): the tabs of the sections, the state of the link, Feedback and Settings.
  top: {
    // The list of the tabs, read aloud only.
    sections: 'Sections',
    // The name of the side panel beside the map, read aloud.
    now: 'Now',
    // The tabs: short, under or beside a small icon. Map: the map with the panel Now beside it. Character: the character's
    // gear, bags, bank and stats, and what the other characters hold.
    map: 'Map',
    character: 'Character',
    // A panel of the Character workspace: a row for each item the character holds, and what the others hold.
    inventory: 'Inventory',
    // A panel of the Character workspace: the character's professions, their level and their recipes.
    professions: 'Professions',
    auctionHouse: 'Auction House',
    // Shown in place of auctionHouse when the window is narrow: two or three letters.
    auctionHouseShort: 'AH',
    // The button on the state of the link, read aloud and on hover: pauses or resumes the reading of the game.
    pause: 'Pause Twinmap',
    resume: 'Resume Twinmap',
    // Small, beside the state of the link: how many sends the game can still take before a /reload. {count}: a number.
    sendsLeft: { other: '{count} sends left' },
    // A button: short, beside a bug icon. feedbackHint shows on hover.
    feedback: 'Feedback',
    feedbackHint: 'Report a bug or an idea',
    // A button: short, beside a cog icon.
    settings: 'Settings',
  },

  // Edit layout (App.svelte, frame.svelte.ts): each tab at the top is a layout of panels (the map, Now, Character,
  // Auction House), locked until Edit layout unlocks it.
  layout: {
    // A button beside the tabs at the top, an icon alone: read aloud and on hover. {ctrl}: the name of the key Control
    // (settings.keys.ctrl); {ctrl}+E is its key.
    edit: 'Edit layout ({ctrl}+E)',
    // In Settings > Shortcuts, beside the keys Ctrl and E.
    editKey: 'Edit layout',
    // The bar under the top row while the layout is unlocked, first a hint.
    hint: 'Drag a tab to the edge of a panel to put it beside, or to its middle to group them.',
    // The buttons of the bar: short. addPanel opens the list of the panels the tab open has not.
    addPanel: 'Add panel',
    // On each block of Now while the layout is unlocked, a button with an icon: read aloud and on hover (M20-F7).
    pull: 'Drag onto a panel to take it out, or click to put it under Now',
    reset: 'Reset this workspace',
    restore: 'Restore default workspaces',
    // In place of the bar's buttons after restore, before anything is changed: a question, then two buttons.
    restoreSure: 'Put every workspace back as it was at first?',
    restoreYes: 'Restore',
    restoreNo: 'Cancel',
    // Locks the layout again: short.
    done: 'Done',
    // At the end of the hint, what is done with the tabs at the top, the workspaces.
    hintSpaces: 'At the top: drag a workspace to move it, double-click it to rename it.',
    // A button after the tabs at the top while the layout is unlocked, a + alone: read aloud and on hover.
    newSpace: 'New workspace',
    // The same button once there are as many workspaces as there can be. {most}: that number.
    spacesMost: 'At most {most} workspaces',
    // The name of a workspace the player made, until they give it one.
    unnamed: 'Workspace',
    // The field a tab at the top becomes on a double click, to rename its workspace: read aloud.
    rename: 'Name of the workspace',
    // A cross on each tab at the top while the layout is unlocked: read aloud and on hover.
    deleteSpace: 'Delete workspace',
    // In place of the bar's buttons after that cross, before anything is deleted: a question, then two buttons. {name}: the name of the workspace.
    deleteSure: 'Delete the workspace "{name}"? Its layout is lost; the panels stay in the other workspaces.',
    deleteYes: 'Delete',
    deleteNo: 'Keep',
  },

  // The state of the link with the game, in the top row (word: short, beside a coloured dot), and the line
  // it puts at the foot of the map when the player has something to do (shared/link.ts).
  link: {
    paused: 'Paused',
    closed: 'Game not running',
    closedLine: 'Game not running. The map still works; your position appears when you log in.',
    minimized: 'Game minimized',
    minimizedLine: 'Game minimized. Your position appears when its window is back on screen.',
    updateApp: 'Update the app',
    updateAddon: 'Update the addon',
    // The line under "Update the app" or "Update the addon" (shared/game.ts): {addon} and {app} are the numbers of the
    // protocol the addon and the app speak.
    newerAddon: 'The Twinmap Forever addon is newer than this app (protocol {addon}, this app speaks {app}). Close Twinmap and open it again: it updates itself when it starts.',
    // macOS only: download the update by hand instead of restarting for an automatic update, then allow its first launch.
    // {addon} and {app}: protocol numbers. Use the names of System Settings and Open Anyway as macOS shows them in this language.
    newerAddonMac: 'The Twinmap Forever addon is newer than this app (protocol {addon}, this app speaks {app}). Download the newest Twinmap for macOS. If macOS does not open it, choose Open Anyway under System Settings > Privacy & Security.',
    olderAddon: 'The Twinmap Forever addon is older than this app (protocol {addon}, this app speaks {app}). Update the addon from CurseForge, then restart the game.',
    connecting: 'Connecting',
    lost: 'Link lost',
    lostLine: 'No signal from the game. Log in, and check that the Twinmap Forever addon is on and its strip is not paused.',
    // macOS only: shown on the map and in setup while Screen Recording permission is missing; Windows needs no such permission.
    // Use the names of System Settings and its panes as macOS shows them in this language; + is the button under the list.
    screenRecording: 'Twinmap cannot read the game window yet. Under System Settings > Privacy & Security > Screen & System Audio Recording, turn on Twinmap (add it with + if it is not listed), then reopen Twinmap.',
    combat: 'In combat, position only',
    connected: 'Connected',
    // Inside a dungeon, when the arrow is not there. "Rotate Minimap" is the name of the game's own setting.
    minimapTurns: 'Your place in a dungeon is read from the minimap, and it cannot be while the minimap turns: turn off Rotate Minimap in the game.',
    noRooms: 'Twinmap has no pictures of this dungeon: your place is not shown in here.',
    noMinimap: 'Your place in a dungeon is read from the minimap, and the game tells none: update the Twinmap Forever addon and keep the minimap on screen.',
    looking: 'Looking for your place. It is read from the minimap of the game: keep it on screen, with nothing over it.',
  },

  // Lines at the foot of the map (App.svelte), each followed on the same line by a button.
  map: {
    addonMissing: 'The Twinmap Forever addon is not in your game, so no position can come. Get it on CurseForge, then restart the game.',
    // A button after addonMissing: short.
    getAddon: 'Get it on CurseForge',
    paused: 'Twinmap is paused: the map stays where you were and your character is not followed.',
    // A button after paused: short.
    resume: 'Resume',
    // In the corner of the map, in place of the name of the zone, when the game told none.
    unknownZone: 'Unknown zone',
  },

  // In place of the map while it is made from the game's files, or cannot be (App.svelte, shared/tiles-status.ts).
  tiles: {
    // Under the line that says the map is being built.
    builtOnce: 'This happens only the first time, and again after a game update.',
    noGameHelp: 'Choose the folder where World of Warcraft: Forever is installed, the one that holds _forever_.',
    failedHelp: "Twinmap could not read the game's files. Close the game's launcher if it is updating or repairing the game, then try again. If it fails again, repair the game from the launcher and tell us with Feedback.",
    looking: 'Looking for the game.',
    noGame: 'The game folder was not found.',
    // {percent}: a whole number, 0 to 100.
    converting: "Building the map from your game's files, {percent}%.",
    // {tiles}: how many pictures of the map. {version}: the game's version, as 1.14.2.42597. {rooms}: how many pictures of rooms.
    ready: 'Map: {tiles} tiles ready, game {version}, {rooms} rooms',
    readyReading: 'Map: {tiles} tiles ready, game {version}, reading the rooms',
    // {problem}: why, as the system said it, often in English.
    readyNoRooms: 'Map: {tiles} tiles ready, game {version}, rooms not read ({problem})',
    // {message}: why, as the system said it, often in English.
    failed: 'The map could not be built: {message}',
    // Buttons: short.
    chooseFolder: 'Choose the game folder',
    retry: 'Try again',
  },

  // In a phone's browser, while the app on the computer is still being set up (App.svelte).
  elsewhere: {
    title: 'Finish the setup on your computer',
    text: 'Twinmap on the computer is still being set up: it shows what is left to do. The map opens here by itself when it is done.',
  },

  // The side panel beside the map (App.svelte): its head, its foot with the level, and its edge.
  panel: {
    // The button that opens and closes the panel: close while open, open while closed.
    close: 'Close',
    open: 'Quests and nearby',
    // A button with an icon, read aloud and on hover: moves the map to the other side of the panel. (M) is its key.
    mapLeft: 'Map on the left (M)',
    mapRight: 'Map on the right (M)',
    // Another character than the one in game is on show. {name}: its name, in its class colour.
    showing: 'Showing {name}',
    // A button after showing: short. {name}: the first name of the character in game.
    backTo: 'Back to {name}',
    // At the foot of the panel. {level}: a number. {percent}: a whole number, of the level done.
    level: 'Level {level}',
    levelPercent: 'Level {level}, {percent}%',
    // Under level, dim. {xp} and {max}: numbers of experience points.
    xp: '{xp} of {max} xp',
    // The experience bar, read aloud only; the title of its panel too, once taken out of Now (M20-F7).
    experience: 'Experience',
    // The panel Experience with no character known yet: what to do in the game.
    emptyExperience: 'Your level shows here once you play with the Twinmap Forever addon on.',
    widthHint: 'Drag to resize. Double-click to reset.',
  },

  // The Now panel (Now.svelte, shared/now.ts): bands with a title, and rows of a name, a word and how far.
  now: {
    // The titles of the bands: short, followed by a count on the same line.
    attention: 'Attention',
    inGame: 'In game',
    pins: 'My pins',
    quests: 'Quests',
    nearby: 'Nearby',
    // The word of a row, in its second cell: short.
    handIn: 'Hand in',
    objective: 'Objective',
    quest: 'Quest',
    // Dead: the way back to life, to the door of a dungeon or to the corpse.
    entrance: 'Entrance',
    corpse: 'Corpse',
    // Someone who offers a service: the word of the row, short.
    flight: 'Flight',
    inn: 'Inn',
    bank: 'Bank',
    auction: 'Auction',
    stable: 'Stable',
    trainer: 'Trainer',
    repair: 'Repair',
    vendor: 'Vendor',
    // An alert on an auction price that was met: the word of the row, short.
    onSale: 'On sale',
    cheaper: 'Cheaper',
    dearer: 'Dearer',
    // On hover over a row of a place on the other continent, which has no distance.
    otherContinent: 'On the other continent',
    // The journey Shortest Path guides, while its first plan is still searched.
    finding: 'Finding the way',
    updateHint: 'Update Shortest Path and the Twinmap Forever addon to see the whole way here',
    // A block of Now taken out into a panel of its own (M20-F7), with nothing to show: what to do in the game.
    emptyAttention: 'Nothing needs you now. A death, or an auction alert that is met, shows here.',
    emptyPins: 'No pin saved yet. Click a place on the map and Save it to keep it here.',
    emptyQuests: 'No quest in your log. Accept one in the game and it shows here.',
    emptyNearby: 'Nobody near. Walk on: the vendors, trainers and flight masters around you show here.',
    // In the Now column once every block of it is in a panel of its own.
    allOut: 'Every block of Now is in a panel of its own. Close a panel to bring its block back here.',
  },

  // Times of the journey of Shortest Path, at the right of its rows (shared/journey.ts): short.
  journey: {
    // The name of a journey the game told none for.
    name: 'Journey',
    seconds: '{seconds} s',
    minutes: '{minutes} min',
    hours: '{hours} h {minutes} min',
  },

  // Dead: the name of the place to walk back to, on the map and in the panel (shared/death.ts).
  death: {
    corpse: 'Your corpse',
  },

  // Why a point or a stop cannot be sent to the game now, under the button that sends it (shared/send.ts).
  send: {
    pointNoZone: 'This point is in no zone the game can mark.',
    stopNoZone: 'A stop is in no zone the game can mark.',
    notConnected: 'The game is not connected.',
    notListening: 'The game is not listening yet. If this stays, update the addon and restart the game.',
    reload: 'Type /reload in the game to send again.',
    restart: 'Restart the game once: its way back from Twinmap opens at the next start.',
    // The names given in the game to a pin and to a stop of the route that have none: one word.
    pin: 'Pin',
    stop: 'Stop',
  },

  // The first run (FirstRun.svelte, shared/setup.ts): five pages, one thing each, with a row of their titles on top.
  firstRun: {
    // The row of the titles of the pages, read aloud only.
    steps: 'Steps',
    // The progress bar of the map, read aloud only.
    building: 'Building the map',
    // How long the map still takes, beside its percent. {count}: a number.
    secondsLeft: { other: 'about {count} seconds left' },
    minutesLeft: { other: 'about {count} min left' },
    // Under the pages: short buttons. skip is plain text, at the left.
    skip: 'Skip, look at the map',
    back: 'Back',
    next: 'Next',
    toMap: 'Go to the map',
    // Buttons on the pages: short.
    chooseFolder: 'Choose the game folder',
    chooseAnother: 'Choose another folder',
    getAddon: 'Get Twinmap Forever on CurseForge',
    // {name}: the name of an optional addon, as QuestieDB.
    getOptional: 'Get {name} on CurseForge',
    retry: 'Try again',
    // Shown on the page of the addon and on the page of the game, in a box of its own.
    photosensitivity: 'Photosensitivity warning: the addon sends data by changing the colors of a one pixel line at the edge of the game window, many times per second. Its settings in the game can slow it down or pause it.',
    // Each page: a title (short, also in the row on top), why it is there, then what is true now.
    game: {
      title: 'Find the game',
      intro: 'Twinmap needs to know where World of Warcraft: Forever is installed. It only reads from that folder; it never changes anything in it.',
      // Followed by the folder found, on a line of its own.
      found: 'Found.',
      notFound: 'The game was not found on this PC.',
      choose: 'Choose the folder it is installed in: the one that holds _forever_.',
    },
    map: {
      title: 'Build the map',
      intro: "Twinmap draws its map from your own game's files, so it always matches your version of the game. This is done once, and again only after the game updates. Nothing is downloaded.",
      waiting: 'Waiting for the game folder.',
      opening: "Opening the game's files.",
      reading: "Reading the game's own pictures of the world.",
      // Followed by why, as the system said it, and what to do.
      failed: 'The map could not be built.',
      ready: 'The map is ready.',
      // {count}: a number of pictures. {version}: the game's version, as 1.14.2.42597.
      tiles: '{count} tiles from game version {version}.',
    },
    addon: {
      title: 'Get the addon',
      intro: 'The Twinmap Forever addon tells this app where your character is. It installs like any other addon, from CurseForge.',
      installed: 'Installed.',
      // {version}: the version of the addon, as 1.4.0.
      inFolder: "Twinmap Forever {version} is in the game's AddOns folder.",
      notYet: 'Not installed yet.',
      // _forever_\Interface\AddOns is a folder of the game: as it is.
      howTo: 'Install it with the CurseForge app. Without that app, download the file from the same page and unpack it into _forever_\\Interface\\AddOns.',
      // macOS only: the same game folder as howTo, with forward slashes instead of Windows backslashes. Keep the path as it is.
      howToMac: 'Install it with the CurseForge app. Without that app, download the file from the same page and unpack it into _forever_/Interface/AddOns.',
      notices: 'This page notices by itself when the addon is there.',
    },
    extras: {
      title: 'Optional addons',
      intro: 'None of these is needed. When one is installed, Twinmap shows more.',
      questie: 'QuestieDB: installed. The map shows who offers a service, ore, herbs and the quests of your log. With Questie running too, it shows the same quests Questie shows, the ones to take as well.',
      noQuestie: 'QuestieDB: not installed. It comes with Twinmap Forever from the CurseForge app. Without it the map has no NPCs, no services and no quests.',
      shortestPath: 'Shortest Path: installed. The map will show its journey, and what you send to the game is reached along the roads.',
      noShortestPath: 'Shortest Path: not installed. With it, the map shows the journey it plans, and what you send to the game is reached along the roads.',
    },
    play: {
      title: 'Start the game',
      intro: 'Start World of Warcraft: Forever and log in with a character. Your position appears here on its own.',
      connected: 'Connected. Your position is coming through.',
      silent: 'The game is open, but nothing comes from the addon yet.',
      minimized: 'The game is minimized. Bring its window back on screen.',
      waiting: 'Waiting for the game.',
      // "AddOns" is the name of the button at the game's character list.
      tick: 'At the character list, open AddOns and make sure Twinmap Forever is ticked.',
    },
  },

  // The small window shown while a newer version of the app comes down (Update.svelte). {version}: as 1.4.0.
  update: {
    updating: 'Updating',
    updatingTo: 'Updating to version {version}',
    // installing and reopen show on two lines, one under the other.
    installing: 'Installing version {version}',
    reopen: 'Twinmap will open again in a few seconds',
    // The progress bar, read aloud only.
    downloading: 'Downloading the new version',
  },

  // Said in a phone's browser when the app on the computer is needed (renderer/src/web.ts).
  web: {
    noAnswer: 'Twinmap on the computer did not answer.',
    chooseOnComputer: 'Choose the game folder in Twinmap on the computer.',
  },

  // Messages of the app on the computer (main process), shown in its window or on the phone.
  main: {
    // The title of the window that picks a folder.
    pickFolder: 'Where World of Warcraft: Forever is installed',
    notGame: 'World of Warcraft: Forever is not in that folder. Choose the one that holds _forever_.',
    // The title of the window that saves a picture. {name}: the character, as Name-Realm.
    savePicture: 'Save the picture of {name}',
    // Instead of the address a phone opens.
    noNetwork: 'This computer is on no home network.',
    // {port}: a number.
    portTaken: 'Port {port} is taken by another program.',
    // A whole page in a phone's browser, alone.
    scanAgain: "Open Twinmap's settings on the computer and scan the code again.",
    // When something sent to the game cannot go.
    nothingToSend: 'There is nothing to send.',
    cannotWrite: 'Twinmap could not write next to the addon in the game folder.',
  },

  // Under a name found by the search, in small (main/questie.ts).
  found: {
    // An NPC that has no title of its own.
    npc: 'NPC',
    // {giver}: the name of who gives the quest. {level}: a number.
    quest: 'Quest, from {giver}',
    questLevel: 'Quest, level {level}, from {giver}',
    // {name}: the name of an NPC or of an object.
    soldBy: 'Sold by {name}',
    droppedBy: 'Dropped by {name}',
    foundIn: 'Found in {name}',
    // The name of a quest QuestieDB has none for. {id}: its number.
    questNumber: 'Quest {id}',
    // Under an NPC with no title of its own: what it offers, one word each, in small letters, several joined by commas.
    services: {
      flight: 'flight',
      inn: 'inn',
      vendor: 'vendor',
      repair: 'repair',
      trainer: 'trainer',
      bank: 'bank',
      auction: 'auction',
      stable: 'stable',
    },
  },
}
