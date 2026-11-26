// The English of items: see en/index.ts for how a key is written and noted.
export default {
  // An item or a spell whose name the game's files do not give yet: in the item tables, the slots, a trainer's list.
  // {id}: the item's or the spell's number.
  unknownItem: 'Item {id}',
  unknownSpell: 'Spell {id}',

  // How long ago a character or a piece of its sheet was last seen: after "seen", "as of", "Taken", or alone in the character list.
  ago: {
    justNow: 'just now',
    minutes: { one: '{count} minute ago', other: '{count} minutes ago' },
    hours: { one: '{count} hour ago', other: '{count} hours ago' },
    days: { one: '{count} day ago', other: '{count} days ago' },
    weeks: { one: '{count} week ago', other: '{count} weeks ago' },
  },

  // Where an item is held: the chips over the item table (followed by how many) and its Where column. Short.
  places: {
    bags: 'Bags',
    bank: 'Bank',
    worn: 'Worn',
    keyring: 'Keyring',
  },

  // The kind of an item, as the game names its classes and subclasses: in the item tables, the item popup and the auction house.
  types: {
    // {kind}: one of types.weapons, "Weapon · Staff".
    weaponOf: 'Weapon · {kind}',
    // {kind}: one of types.armors, "Armor · Cloth".
    armorOf: 'Armor · {kind}',
    // An item of a class the game does not say.
    unknown: 'Other',
    classes: {
      consumable: 'Consumable',
      container: 'Container',
      weapon: 'Weapon',
      gem: 'Gem',
      armor: 'Armor',
      reagent: 'Reagent',
      projectile: 'Projectile',
      tradeGoods: 'Trade Goods',
      itemEnhancement: 'Item Enhancement',
      recipe: 'Recipe',
      money: 'Money',
      quiver: 'Quiver',
      quest: 'Quest',
      key: 'Key',
      permanent: 'Permanent',
      miscellaneous: 'Miscellaneous',
    },
    weapons: {
      axe: 'Axe',
      bow: 'Bow',
      gun: 'Gun',
      mace: 'Mace',
      polearm: 'Polearm',
      sword: 'Sword',
      warglaive: 'Warglaive',
      staff: 'Staff',
      exotic: 'Exotic',
      fistWeapon: 'Fist Weapon',
      miscellaneous: 'Miscellaneous',
      dagger: 'Dagger',
      thrown: 'Thrown',
      spear: 'Spear',
      crossbow: 'Crossbow',
      wand: 'Wand',
      fishingPole: 'Fishing Pole',
    },
    armors: {
      miscellaneous: 'Miscellaneous',
      cloth: 'Cloth',
      leather: 'Leather',
      mail: 'Mail',
      plate: 'Plate',
      cosmetic: 'Cosmetic',
      shield: 'Shield',
      libram: 'Libram',
      idol: 'Idol',
      totem: 'Totem',
      sigil: 'Sigil',
      relic: 'Relic',
    },
  },

  // The word inside an empty equipment slot of the panel Character, shown in capitals in a 44px square: very short.
  slots: {
    head: 'Head',
    neck: 'Neck',
    shoulder: 'Shoulder',
    back: 'Back',
    chest: 'Chest',
    shirt: 'Shirt',
    tabard: 'Tabard',
    wrist: 'Wrist',
    hands: 'Hands',
    waist: 'Waist',
    legs: 'Legs',
    feet: 'Feet',
    ring: 'Ring',
    trinket: 'Trinket',
    // The weapon in the main hand.
    mainHand: 'Main',
    // The weapon or shield in the off hand.
    offHand: 'Off',
    ranged: 'Ranged',
  },

  // Who a character is, under its name in the character list and on the panel Character.
  character: {
    // {level}: a number; {race}: one of races; {class}: one of classes. "Level 24 Gnome Warlock".
    line: 'Level {level} {race} {class}',
    // The same line when the level is not known yet.
    kind: '{race} {class}',
  },
  // The races, by the game's tokens: in character.line.
  races: {
    human: 'Human',
    orc: 'Orc',
    dwarf: 'Dwarf',
    nightElf: 'Night Elf',
    undead: 'Undead',
    tauren: 'Tauren',
    gnome: 'Gnome',
    troll: 'Troll',
  },
  // The classes, one of them: in character.line.
  classes: {
    warrior: 'Warrior',
    paladin: 'Paladin',
    hunter: 'Hunter',
    rogue: 'Rogue',
    priest: 'Priest',
    shaman: 'Shaman',
    mage: 'Mage',
    warlock: 'Warlock',
    druid: 'Druid',
  },
  // The classes, all of them: in npc.teaches.
  classesAll: {
    warrior: 'Warriors',
    paladin: 'Paladins',
    hunter: 'Hunters',
    rogue: 'Rogues',
    priest: 'Priests',
    shaman: 'Shamans',
    mage: 'Mages',
    warlock: 'Warlocks',
    druid: 'Druids',
  },

  // The Items page (Items.svelte): its row of tools, and what it says with no character.
  page: {
    noCharacter: 'No character yet. Play one with the Twinmap Forever addon on and its bags show here, also when the game is closed.',
    // In the filter box, 280px wide.
    filter: 'Filter by name or type',
    // Read aloud only.
    filterLabel: 'Filter items',
    whereLabel: 'Where',
    // The first chip over the table, followed by how many.
    all: 'All',
    // The sum at the end of the tools row, its parts after one another with " · ". {money}: gold, silver and copper with their coins.
    worth: 'Worth {money} at a vendor',
    auction: '{money} at the auction house',
    money: 'Money {money}',
  },

  // The panel Character: what the character wears around its picture, taken off the game's character window.
  doll: {
    // Read aloud only.
    label: 'Worn',
    // Over the picture while a new one is awaited: the first line, then on the next one keyHint.
    open: 'Open the character window in game',
    // {key}: the key that opens it, C, in a box.
    keyHint: '{key} unless you changed the key',
    waitNote: 'The picture is taken as soon as it is open and nothing covers the character.',
    // Buttons on the picture: short.
    cancel: 'Cancel',
    save: 'Save…',
    retake: 'Retake',
    // {ago}: one of ago.
    taken: 'Taken {ago}',
    // {name}: the character's first name.
    none: 'No picture of {name} yet',
    noneNote: 'Open the character window in game and it is taken by itself.',
  },

  // The panels Bags and Bank: their grids, each heading followed by a smaller line.
  held: {
    bags: 'Bags',
    bagsNow: 'as they are now',
    // {ago}: one of ago.
    bagsAsOf: 'as of {ago}',
    bank: 'Bank',
    bankSeen: 'seen {ago}',
    // Headings of the grids, in capitals.
    backpack: 'Backpack and bags',
    reagents: 'Reagent bag',
    keyring: 'Keyring',
    bankBags: 'Bank and its bags',
    // Beside a grid's heading. {used}, {count}: numbers of slots.
    used: '{used} of {count} used',
    // English has always said "slots" here, even for one.
    empty: { other: 'empty · {count} slots' },
  },

  // The panel Bank before the bank was ever seen: a title, what to do in the game, then where (smaller).
  bank: {
    none: 'No bank seen yet',
    open: 'Open your bank once in the game: what is in it shows here, also when the game is closed.',
    where: 'Talk to a banker in any capital.',
  },

  // The panel Professions: the character's professions with their level, and the recipes of the one chosen.
  professions: {
    // Headings of the two lists of the Professions panel: the main professions, then Cooking, First Aid, Fishing. As the game names them.
    primary: 'Professions',
    secondary: 'Secondary Skills',
    // Placeholder of the field that narrows the recipes by name. Short.
    filter: 'Filter recipes',
    // Heading over the recipes the character knows, followed by how many.
    known: 'Known',
    // Heading over the recipes the profession's window lists that the character has not learned, followed by how many.
    unknown: 'Not learned',
    unknownNote: 'The number: the skill at which each turns yellow.',
    // The key of the colours of the known recipes, as the game colours them: four short items on one line.
    optimal: 'Orange: sure skill-up',
    medium: 'Yellow: likely',
    easy: 'Green: seldom',
    trivial: 'Grey: none',
    // In place of the recipes when none matches what is typed in the filter.
    noMatch: 'No recipe matches.',
    // A character with no profession: the title, what to do in the game, a note.
    none: 'No professions yet',
    learn: 'Learn one at a profession trainer, in any city: its level and its recipes show here.',
    also: 'Cooking, First Aid and Fishing count too.',
    // A profession whose window the addon never saw open: the title, then what to do. {profession}: its name, as the game writes it.
    unseen: 'No recipes seen yet',
    open: 'Open {profession} once in the game: its recipes show here, also when the game is closed.',
    // A profession with no recipes in the game (Herbalism, Skinning). {profession}: its name.
    // A profession whose window was seen before the addon read its headings and the recipes it lists: what to do. {profession}: its name.
    again: 'Open {profession} once more in the game: its headings and the recipes not learned show here too.',
    gathers: '{profession} has no recipes: its level is all there is to show.',
  },

  // The panel Spellbook: the tabs of the game's spellbook and the spells of the one chosen. The tabs' and spells' names come from the game.
  spellbook: {
    // Placeholder of the field that narrows the spells of the tab by name. Short.
    filter: 'Filter spells',
    // Under a passive spell the game writes nothing under: as the game's book words it.
    passive: 'Passive',
    // In place of the spells when none matches what is typed in the filter.
    noMatch: 'No spell matches.',
    // A sheet without the book: the title, then what to do in the game.
    none: 'No spellbook yet',
    login: "Log in to the game with Twinmap's addon up to date: the spells of your book show here, also when the game is closed.",
  },

  // The panel Talents: the character's talent trees as the game's window draws them, and the points spent in each.
  talents: {
    // Beside the title of the panel. {count}: the points spent in all three trees.
    spent: { one: '{count} point spent', other: '{count} points spent' },
    // Beside it, in green, when the character has points not spent yet. As the game words it (UNSPENT_TALENT_POINTS).
    free: 'Unspent Talent Points: {count}',
    // In the tooltip of a talent, under its name, as the game words it (TOOLTIP_TALENT_RANK).
    rank: 'Rank {rank}/{most}',
    // In the popup of a talent, over the lines of the rank after the one it has, as the game words it (TOOLTIP_TALENT_NEXT_RANK).
    next: 'Next Rank:',
    // In red at the bottom of the popup of a talent whose row is not open yet, as Forever words it. {count}: the points still to
    // spend in its tree; {tree}: the tree's name, as the game writes it.
    need: { one: 'Spend {count} more point in {tree} Talents', other: 'Spend {count} more points in {tree} Talents' },
    // A character with no talent taken and no point to spend: the title, then what to do in the game.
    none: 'No talents yet',
    learn: "Talents come at level 10, then one point each level. Spend them in the game's talent window: they show here.",
  },

  // The panel Inventory: a row for each item.
  table: {
    // Column headings, in capitals: short.
    columns: {
      item: 'Item',
      character: 'Character',
      type: 'Type',
      where: 'Where',
      qty: 'Qty',
      value: 'Value',
      // What the items fetch at the auction house.
      auction: 'At the AH',
    },
    // {name}: the character's full name; {typed}: what is typed in the filter.
    nothingLike: '{name} has nothing like "{typed}".',
    nothing: 'Nothing here.',
    // Under the table, the two after one another with " · ". {ago}: one of ago.
    bagsNow: 'Bags as they are now',
    bagsAsOf: 'Bags as of {ago}',
    bankSeen: 'Bank {ago}, when it was last open',
    bankUnseen: 'Bank not seen yet: open it in game once',
  },

  // The table of the other characters that hold what is typed in the filter.
  others: {
    // A heading, followed by where.
    title: 'Other characters',
    where: 'kept on this PC',
    // On a row, as the pointer rests on it. {name}: a character's full name.
    show: 'Show {name}',
    // Under the table, one for each character, after one another with " · ". {ago}: one of ago.
    seen: '{name}: seen {ago}',
  },

  // The popup of the item under the pointer (ItemPopup.svelte), under the game's own lines.
  popup: {
    // {price}: gold, silver and copper with their coins.
    sellPrice: 'Sell Price: {price}',
    auction: 'Auction House: {price}',
    // After auction, for a stack: the price of one.
    each: '({price} each)',
    notOnSale: 'Auction House: not on sale',
    // After a character's first name, after one another with ", ": "Catubbio wears it, 3 in the bags".
    wears: 'wears it',
    inBags: '{count} in the bags',
    inBank: '{count} in the bank',
    noneHeld: 'None of your characters has it',
    // {npc}: a vendor's name, in its colour; {zone}: where it stands. Followed by its price.
    soldBy: 'Sold by {npc}',
    soldByIn: 'Sold by {npc}, {zone}',
    // A vendor's price for a pack of {count}. The space after the price does not break.
    perPack: '{price} for {count}',
    // English has always said "vendors" here, even for one.
    moreVendors: { other: 'and {count} more vendors' },
    // {npc}: a creature's name; {zone}: where it is.
    dropsFrom: 'Drops from {npc}',
    dropsFromIn: 'Drops from {npc}, {zone}',
    moreDrops: { other: 'and {count} more' },
    // {object}: an object of the world, a chest or a plant; {zone}: where it is.
    foundIn: 'Found in {object}',
    foundInIn: 'Found in {object}, {zone}',
  },

  // The panel of a vendor or a trainer, at the top of the side panel (NpcPanel.svelte).
  npc: {
    // Under the name of the NPC. {count}: how many items it sells; {sub}: what the game writes under its name.
    sells: 'Sells {count}',
    subSells: '{sub} · Sells {count}',
    // {profession}: the profession's name.
    notLearned: '{profession} not learned yet',
    // {classes}: one of classesAll.
    teaches: 'Teaches {classes} only.',
    teachesPick: 'Teaches {classes} only: pick a character to see what it can learn.',
    // Headings of the groups of a trainer's list, in capitals, a price at their end. {count}: how many lines.
    learnNow: 'Learn now · {count}',
    atLevel: 'Level {level}',
    atSkill: 'Skill {skill}',
    nextRank: 'Next rank',
    sellsHeading: 'Sells · {count}',
    // Small, after a spell's name.
    rank: 'Rank {rank}',
    // After the next rank's name: what it asks.
    nextNeeds: 'skill {skill}, level {level}',
    // At the end of a line, in place of a price: short.
    talent: 'Talent',
    quest: 'Quest',
    // As the pointer rests on quest. {quest}: the quest's name.
    questTaught: 'Taught by the quest {quest}',
    classQuest: 'Taught by a class quest',
    // Headings over a vendor's items, small; the last three over 30px to 66px columns.
    columns: {
      item: 'Item',
      price: 'Price',
      // The auction house, after price.
      ah: 'AH',
      bags: 'Bags',
      bank: 'Bank',
    },
    // As the pointer rests on ah and ahPrice.
    ahNote: 'The lowest price at the auction house, for as many',
    // Under a vendor's price. {price}: gold, silver and copper with their coins, or "-".
    ahPrice: 'AH {price}',
    // The fold at the foot with the spells known. {count}: how many; then show or hide on the right.
    known: 'Known · {count}',
    show: 'Show',
    hide: 'Hide',
    // The line at the foot. {name}: the character's first name; {ago}: one of ago; {level}: a number, or "?".
    noCharacter: 'No character yet: play one with the Twinmap Forever addon on.',
    recipesRead: '{name} · recipes as of when the {profession} window was last open',
    recipesUnread: '{name} · open the {profession} window once in game for the recipes known',
    spellsNow: '{name}, level {level} · spells as they are now',
    spellsAsOf: '{name}, level {level} · spells as of {ago}',
    bankSeen: 'Bank seen {ago} · {name}',
    bankUnseen: 'Bank not seen yet: open it in game once · {name}',
  },

  // The shopping list in the side panel, above Now (ShoppingList.svelte, M10-F4), and the + that puts things on it.
  shopping: {
    // On the band at its top.
    title: 'Shopping list',
    // Alone in a panel, or in Edit layout, while the list is empty.
    empty: 'Nothing on it yet. Add a recipe with the + at a profession trainer, or an item with the + of the search.',
    // Under the band, at the left, the money at the right. {name}: the character's first name.
    forWho: 'For {name}',
    // Headings of the groups, in capitals (written normally here: the page raises them). {count}: how many lines.
    making: 'Making · {count}',
    makeFirst: 'Make first · {count}',
    missing: 'Missing · {count}',
    ready: 'Ready · {count}',
    // At the right of the missing heading, small. {price}: gold, silver and copper with their coins.
    toBuy: 'to buy {price}',
    // Small, under a recipe on the list. {profession}: the profession as the game names it; {skill}, {have}: numbers. needs is red.
    youKnow: '{profession} · you know it',
    needs: '{profession} {skill} needed, you have {have}',
    notKnown: '{profession} · not learned',
    unread: '{profession} · open its window once in game',
    // Small, under a part to make or an item a recipe makes: what one go takes. {items}: amounts, one after another with ", ".
    takes: '{items} each',
    // The same for a recipe that makes more than one at a go. {count}: how many it makes.
    takesFor: '{items} for {count}',
    // One amount of takes. {count}: a number; {item}: an item's name as the game writes it.
    amount: '{count} {item}',
    // Before takes, then " · ", for a recipe not learned yet: the skill it asks at the trainer.
    toLearn: '{profession} {skill} to learn',
    // At the right of a part to make, small. {count}: how many to make, bold.
    make: 'make {count}',
    // At the right of a missing line, small. {missing}: how many are missing, bold and red; {count}: how many in all.
    of: '{missing} of {count}',
    // On the band when the list is folded, small; then " · " and toBuy when there is something to buy.
    folded: { other: '{count} missing' },
    foldedNone: 'Everything at hand',
    // Read aloud and as the pointer rests on the band.
    fold: 'Fold the shopping list',
    unfold: 'Unfold the shopping list',
    // The two small buttons around a goal's count: read aloud and as the pointer rests.
    fewer: 'One fewer',
    more: 'One more',
    // The + on a recipe of a trainer's panel and on an item the search finds: read aloud and as the pointer rests. {item}: its name.
    add: 'Add {item} to the shopping list',
    // Two buttons under the list, for the vendors of what is missing (the nearest of each). onMap shows their pins on the map
    // whatever its filters, pressed while on; toRoute puts them at the end of the route, in the order to walk them.
    onMap: 'Vendors on the map',
    toRoute: 'Add to route',
  },

  // The character picker at the start of the top row (Picker.svelte).
  picker: {
    // On the green light, and in the list in place of when it was seen: short.
    inGame: 'In game',
    // After the name. {ago}: one of ago.
    seen: 'seen {ago}',
    // Read aloud only.
    list: 'Characters',
    // A button in place of when it was seen: short.
    forget: 'Forget',
    note: 'Kept on this computer, from what the addon told while you played. Right click a character to forget it.',
  },

  // As the pointer rests on the edge of a column heading that can be dragged.
  resize: 'Drag to resize',
}
