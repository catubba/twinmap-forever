// The English of map: see en/index.ts for how a key is written and noted.
export default {
  // The Filters menu, under the Filters button at the top of the map (Map.svelte, layers.ts): what the map draws. Its words
  // are the same as the filters of the Auction House (auction.filters).
  layers: {
    // The button that opens the menu: short.
    button: 'Filters',
    // Its tooltip: L is the key that opens it too.
    buttonTip: 'Filters (L)',
    // The menu itself, read aloud only.
    menu: 'Map filters',
    // Tooltip on the name of a group, which turns all its layers off or on. {group}: one of map.layers.groups.
    hideAll: 'Hide all {group}',
    showAll: 'Show all {group}',
    // The arrow beside Ore and beside Herbs that opens the list of their kinds beside the menu. {layer}: map.layers.names.ore or .herbs.
    kinds: 'Kinds of {layer}',
    // The first row of that list: hides the kinds that give the character no more skill points, grey in the game. Short.
    hideGrey: 'Hide grey',
    // Its tooltip.
    hideGreyTip: 'Hide what no longer raises your skill',
    // Right of Hide grey: the character's skill in Mining or in Herbalism. {skill}: a number.
    skill: 'Skill {skill}',
    // In its place when the character has not learned the profession.
    notLearned: 'Not learned',
    // In its place before the addon has sent the character's skills.
    skillUnread: 'Skill not read yet',
    // The groups: a heading in the menu, over its layers. Short.
    groups: {
      you: 'You',
      quests: 'Quests',
      services: 'Services',
      resources: 'Resources',
      world: 'World',
      group: 'Group',
    },
    // The layers: a row of the menu beside a tick box, short. The names of the services, ore and herbs
    // are also written under the name of a pin, in its tooltip and on its label, joined by commas.
    names: {
      arrow: 'Arrow',
      route: 'Route',
      mypins: 'My pins',
      death: 'Corpse and graveyard',
      // Quests to take.
      available: 'Available',
      // Quests to hand in.
      turnin: 'Turn in',
      objectives: 'Objectives',
      // Quests to take that already give less XP (5 levels and more under the character): unticked, they are not on the map.
      lowlevel: 'Low-level',
      // Flight masters.
      flight: 'Flight',
      inn: 'Inn',
      vendors: 'Vendors',
      repair: 'Repair',
      trainers: 'Trainers',
      bank: 'Bank',
      auction: 'Auction',
      stable: 'Stable',
      ore: 'Ore',
      herbs: 'Herbs',
      // The names of towns, regions and areas written over the map.
      zones: 'Place names',
      // The shading of hills and valleys.
      relief: 'Relief',
      caves: 'Caves',
      // The doors of the dungeons on the world map.
      dungeons: 'Dungeons',
      routes: 'Flight routes',
      // The ships and zeppelins between two docks, and their docks.
      vessels: 'Ships and zeppelins',
      // The skulls of the bosses on the map of a dungeon.
      bosses: 'Bosses in a dungeon',
      // The other members of the character's group.
      companions: 'Companions',
    },
  },

  // The two continents: buttons at the top of the map, and what the map is called where no zone is.
  // The game's own names: write them as the game writes them in this language.
  continents: {
    easternKingdoms: 'Eastern Kingdoms',
    kalimdor: 'Kalimdor',
  },

  // The buttons in the corners of the map (Map.svelte).
  corner: {
    // A button, top of the map, after a dungeon was opened from outside it. {place}: the zone, continent or dungeon the map showed before.
    back: 'Back to {place}',
    // The switch between the flat map and the 3D view, read aloud only.
    view3d: '3D view',
    // Its tooltip: 3 is the key that does it too.
    view3dTip: '2D or 3D view (3)',
    // The compass in the 3D view, read aloud only.
    turn: 'Turn with your character',
    // Tooltips on the compass: N is the key that does it too.
    turnTip: 'Turn with your character (N)',
    northUpTip: 'North up (N)',
    // Inside a dungeon: a small tag before the buttons 1, 2, 3 that show the rooms up to that level. Short.
    levels: 'Levels',
    // The row of those buttons, read aloud only.
    levelsShown: 'Levels shown',
    // Tooltips on those buttons: the last shows every room; {level} is the number on the button.
    everyRoom: 'Every room',
    roomsUpTo: 'Rooms up to level {level}',
    // Buttons with a plus and a minus, read aloud only; then their tooltips, with the keys that do it too.
    zoomIn: 'Zoom in',
    zoomInTip: 'Zoom in (+)',
    zoomOut: 'Zoom out',
    zoomOutTip: 'Zoom out (-)',
    // A button, bottom of the map: the map follows the character again. Short.
    follow: 'Follow',
    // Its tooltip: F is the key that does it too.
    followTip: 'Follow your character (F)',
  },

  // A note over the map when the character is somewhere the map has no picture of.
  offMap: 'This place is not on the map.',
  // Frames a second of the 3D view, shown only in trials.
  fps: '{fps} fps',
  // Why Send to game did nothing: the point clicked is in no zone.
  nothingToSend: 'There is nothing to send.',

  // Tooltips on the pins of the map, and the line under a pin's name on its label (Map.svelte).
  pins: {
    // In the tooltip of a quest pin, under each quest: the XP it gives the character, before its money. {xp}: a number.
    rewardXp: '{xp} XP',
    // After a quest's XP in a pin's tooltip, in purple: the level from which the quest gives less XP (the next or the one after). {level}: a number.
    lessXpFrom: 'less from level {level}',
    // The same where the quest gives less XP already: the XP before it is already the lesser one.
    lessXp: 'reduced',
    // On the door of a dungeon, and on the entrance inside its map.
    entrance: 'Entrance',
    // On a dock, where a ship or a zeppelin goes from there. {place}: the game's name of each place, with commas.
    shipTo: 'Ship to {place}',
    zeppelinTo: 'Zeppelin to {place}',
    // On the entrance inside the map of a dungeon of several wings. {name}: the wing.
    entranceOf: 'Entrance: {name}',
    // The name of a boss under its skull, on the map of a dungeon, when it is not there in every run. {name}: the boss.
    rareBoss: '{name} (rare)',
    graveyard: 'Graveyard',
    corpse: 'Your corpse',
    // On one of My pins that the game's arrow is following. {name}: the name the player gave it.
    followed: '{name}, followed in the game',
    // On the end of the journey Shortest Path shows in the game. {name}: the place it goes to.
    journey: '{name}, the journey in the game',
    // Under the name on the label of a quest pin, by the kind of pin.
    quest: {
      available: 'Quest to take',
      turnin: 'Quest to hand in',
      objective: 'Quest objective',
    },
    // Under the name on the label of a quest objective, by what it asks for.
    objective: {
      slay: 'Objective: slay',
      loot: 'Objective: loot',
      object: 'Objective: use',
      talk: 'Objective: talk',
      event: 'Objective: go there',
    },
  },

  // Where a point is, as the game's own map gives coordinates: on a label, in the search, in the readout.
  place: {
    // {x} and {y}: the coordinates on the zone's map, from 0 to 100, as 42.3.
    coords: '{x}, {y}',
    // The same after the name of the zone.
    inZone: '{zone} {x}, {y}',
  },

  // How far a point is from the character and which way, on its label and on the band of the next stop.
  // {far}: a distance with its unit (units), as 1,335 yd.
  way: {
    north: '{far} north',
    northEast: '{far} north-east',
    east: '{far} east',
    southEast: '{far} south-east',
    south: '{far} south',
    southWest: '{far} south-west',
    west: '{far} west',
    northWest: '{far} north-west',
    // How long a run it is. {time}: minutes and seconds, as 3:11.
    onFoot: '{time} on foot',
    // The same on a mount: the time is at the mount's speed.
    mounted: '{time} mounted',
  },

  // The label that opens on a point of the map (PointLabel.svelte).
  label: {
    // The name of a saved pin, written over to rename it, read aloud only.
    pinName: 'Name of the pin',
    // A line of the label. {far}: one of map.way, as 260 yd north-east; {time}: map.way.onFoot.
    far: '{far}, {time}',
    // Buttons on the door of a dungeon or raid, opening its map. Short.
    dungeonMap: 'Dungeon Map',
    raidMap: 'Raid Map',
    // The first button: the game's arrow points to this point. It says Sending, then Sent; on the point the arrow already follows, Stop following. Short.
    send: 'Send to game',
    sending: 'Sending',
    sent: 'Sent',
    stopFollowing: 'Stop following',
    // The second button: In route when the point is already a stop. Short.
    addToRoute: 'Add to route',
    inRoute: 'In route',
    // The third button: Save keeps the point among My pins, Remove takes a saved one away. Short.
    save: 'Save',
    remove: 'Remove',
    // Under the buttons, when the game said nothing of the point sent.
    noAnswer: 'No answer from the game yet. It takes the pin once you are out of combat.',
  },

  // The band of the next stop of the route, at the top of the side panel, and the list of its stops (NextStop.svelte).
  nextStop: {
    // With no route: one line.
    none: 'No route. Click the map to add a stop.',
    // The heading of the band.
    title: 'Next stop',
    // At the right of the heading. {n}: the number of the stop, {of}: how many there are.
    count: '{n} of {of}',
    complete: 'Route complete',
    // Under the name of a stop on the other continent, or inside or outside a dungeon when the character is not.
    elsewhere: 'Not on the ground you are on',
    // At the right of the band, big, when the character is at the stop. Very short.
    here: 'Here',
    // Under a number of minutes, which shows above it in large type. Short.
    minutes: 'min on foot',
    // The same on a mount. Short.
    minutesMounted: 'min mounted',
    // Three buttons side by side. Short.
    skip: 'Skip',
    edit: 'Edit route',
    clear: 'Clear',
    // Before the button Send route to game, on the same line.
    unsent: 'Not in game yet',
    send: 'Send route to game',
    onItsWay: 'On its way to the game.',
    // On the buttons of a stop in the list, read aloud only. {name}: the stop.
    moveUp: 'Move {name} up',
    moveDown: 'Move {name} down',
    remove: 'Remove {name}',
  },

  // The search field of the top row and the results under it (Search.svelte).
  search: {
    // In the empty field.
    placeholder: 'Search NPCs, items, quests, zones',
    // The field, read aloud only.
    field: 'Search',
    // The list of results, read aloud only.
    results: 'Results',
    none: 'Nothing by that name.',
    // Beside the name of a result, small: what it is. {zone}: where it is.
    zone: 'Zone',
    myPin: 'My pin',
    myPinIn: 'My pin, {zone}',
    dungeon: 'Dungeon',
    dungeonIn: 'Dungeon, {zone}',
    raid: 'Raid',
    raidIn: 'Raid, {zone}',
    // {what}: what the player's QuestieDB says it is, as Innkeeper or Quest, level 12.
    foundIn: '{what}, {zone}',
  },
}
