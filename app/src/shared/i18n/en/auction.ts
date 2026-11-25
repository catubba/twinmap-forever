// The English of auction: see en/index.ts for how a key is written and noted.
export default {
  // An item the game has no row of, named by its number. {id}: the item's number.
  unknownItem: 'Item {id}',

  // The house the prices are of (shared/ah.ts), on the button at the top right and in the chooser.
  house: {
    // On the button that opens the chooser. {number}: the house's number; {side}: auction.side; {ruleset}: auction.ruleset.
    line: 'House {number} · {side} · {ruleset}',
    // A ruleset the app has no name for. {id}: its number.
    unknownRuleset: 'Ruleset {id}',
  },
  // The sides of a house, as the game names its factions.
  side: {
    alliance: 'Alliance',
    horde: 'Horde',
    neutral: 'Neutral',
  },
  // The rulesets of the realms, as the game names them.
  ruleset: {
    normal: 'Normal',
    pvp: 'PvP',
    roleplay: 'Roleplay',
    roleplayPvp: 'Roleplay PvP',
  },
  // The categories on the left the game has no name for, and where armour is worn (shared/ah.ts).
  category: {
    // Items the game gives no class.
    noClass: 'Other',
    // {id}: the number of the class.
    unknownClass: 'Class {id}',
    // {id}: the number of the subclass.
    unknownSub: 'Subclass {id}',
  },
  // Where armour is worn: the third level of the categories, under a kind of armour. Short.
  slot: {
    head: 'Head',
    neck: 'Neck',
    shoulder: 'Shoulder',
    shirt: 'Shirt',
    chest: 'Chest',
    waist: 'Waist',
    legs: 'Legs',
    feet: 'Feet',
    wrist: 'Wrist',
    hands: 'Hands',
    finger: 'Finger',
    trinket: 'Trinket',
    offHand: 'Off Hand',
    back: 'Back',
    tabard: 'Tabard',
    heldInOffHand: 'Held In Off-hand',
    relic: 'Relic',
  },

  // The bar at the top of the Auction House tab (Auction.svelte).
  tools: {
    searchPlaceholder: 'Search the auction house: a name, or "an exact name"',
    // Read aloud only.
    searchLabel: 'Search the auction house',
    // A button: short.
    filters: 'Filters',
    // The same button while some filters are set. {count}: how many.
    filtersOn: 'Filters · {count}',
    // The two buttons side by side that show prices for one item or for a full stack: short. The group is read aloud as "Prices".
    prices: 'Prices',
    perUnit: 'Per unit',
    perStack: 'Per stack',
    // Bold, above the age of the prices. {time}: an hour, 14:05.
    pricesOf: 'Prices of {time}',
    // Below auction.tools.pricesOf, when the last download failed. {age}: auction.age.
    notUpdated: '{age}, not updated',
    // Below auction.tools.pricesOf. {time}: an hour, 15:05.
    nextAround: 'next around {time}',
  },
  // How old the prices are, below auction.tools.pricesOf. {count}: a number of minutes, hours or days.
  age: {
    minutes: { other: '{count} minutes old' },
    hours: { other: '{count} hours old' },
    days: { other: '{count} days old' },
  },
  // The row of filters below the bar, open with the Filters button.
  filters: {
    // Two fields for the level: {from} and {to} are the fields, in this order.
    level: 'Level {from} to {to}',
    // Inside the empty fields: short.
    from: 'from',
    to: 'to',
    quality: 'Quality',
    // In the list of qualities: no bound.
    any: 'Any',
    // In the list of qualities: that quality and every one above it.
    atLeast: {
      poor: 'Poor and better',
      common: 'Common and better',
      uncommon: 'Uncommon and better',
      rare: 'Rare and better',
      epic: 'Epic and better',
      legendary: 'Legendary and better',
    },
    // Two fields for the lowest price: {from} and {to} are the fields, in this order.
    lowestPrice: 'Lowest price {from} to {to}',
    // Inside the second price field: how a price is typed (g, s, c: gold, silver, copper).
    priceExample: 'e.g. 1g 50s',
    clear: 'Clear',
  },

  // The chooser of the house, shown when the house is not known or the house button is pressed.
  choose: {
    title: 'Which auction house?',
    intro: 'Twinmap shows the prices of the house your character sells at.',
    // After auction.choose.intro. {who}: a character's name; {ruleset}: auction.ruleset, in bold.
    told: 'The game says {who} plays on {ruleset}.',
    // The same with the side. {side}: auction.side.
    toldSide: 'The game says {who} plays on {ruleset}, {side}.',
    // A field label, before the list of regions (EU, US...).
    region: 'Region',
    // After the name of a ruleset, dimmed.
    readFromGame: '(read from the game)',
    // A checkbox: the house of the goblin towns, open to both sides.
    neutral: 'The neutral house (Booty Bay, Gadgetzan, Everlook)',
    note: 'Prices come once an hour from Blizzard. Twinmap downloads about 350 KB for your house; nothing about you is sent.',
    // A button.
    show: 'Show prices',
    // Links beside auction.choose.show.
    follow: 'Follow my character',
    cancel: 'Cancel',
  },
  // What shows while there are no prices of the house.
  // Why the prices could not be had (main/prices.ts), shown in the place of the list and on hover over "not updated".
  errors: {
    noHouse: 'This house has no prices.',
    // {status}: the number of the answer of the server, as 503.
    answered: 'prices.twinmap.app answered {status}.',
    notPrices: 'prices.twinmap.app sent something else than prices.',
    unreachable: 'Twinmap could not reach prices.twinmap.app.',
  },

  wait: {
    noPrices: 'No prices yet',
    // After the error (auction.errors), on the same line.
    noEarlier: 'Twinmap has no earlier prices of this house to show.',
    worksAsBefore: 'Everything else in Twinmap works as before.',
    // A button.
    again: 'Try again',
    getting: 'Getting the prices',
    // {house}: auction.house.line.
    of: 'Of {house}, from prices.twinmap.app.',
  },

  // The list on the left: short lines.
  nav: {
    // A heading, shown in capitals.
    yours: 'Yours',
    mine: 'My items',
    alerts: 'Alerts',
    // A heading, shown in capitals; also read aloud as the name of the list.
    categories: 'Categories',
    all: 'All items',
  },

  // The page of an item.
  page: {
    // On top of the list of kinds, in capitals, after an arrow. {place}: auction.nav.mine, auction.nav.alerts, auction.page.theSearch or a category.
    back: 'Back to {place}',
    theSearch: 'the search',
    // On the page of an item that is not on sale now, under its name.
    notOnSale: 'Not on sale at this auction house now.',
    // Below the name, after its kind and a dot. {level}: a level.
    requiresLevel: 'requires level {level}',
    itemLevel: 'item level {level}',
    // Four small headings in capitals over the prices: short.
    lowest: 'Lowest',
    typical: 'Typical',
    available: 'Available',
    vendorGives: 'Vendor gives',
    // A heading in capitals over the list of what is on sale.
    onSale: 'On sale now, cheapest first',
    // The columns of that list, in capitals: short.
    priceEach: 'Price each',
    howMany: 'How many',
    upToHere: 'Up to here',
    costUpToHere: 'Cost up to here',
    // Below the list. {time}: an hour, 14:05.
    asAt: 'As the house was at {time}. Prices are per unit; what is on sale now may differ.',
    // A heading in capitals on the right.
    youHave: 'You have',
    // A line under auction.page.youHave. {count}: how many; {who}: a character's name, in its colour; {place}: auction.held.
    have: '{count} · {who}, {place}',
    // After auction.page.have or in auction.page.kindOnly, for an item with no bonuses: the kind of the item alone.
    plain: 'plain',
    // After auction.page.have, dimmed, when it is another kind of the item. {kind}: its bonuses ("of the Eagle") or auction.page.plain.
    otherKind: '({kind})',
    none: 'None, on any character of this house',
    // A heading in capitals.
    disenchant: 'If you disenchant it',
    // Two small headings in capitals: short.
    expected: 'Expected',
    best: 'Best',
    // Under auction.page.expected, when some of what it gives is not on sale.
    notAllOnSale: 'not all on sale',
    // Under auction.page.best: short.
    disenchantIt: 'disenchant it',
    sellIt: 'sell it',
    vendorIt: 'vendor it',
    // What disenchanting gives: {draws} is a list of auction.page.draw, joined by commas; {time}: an hour.
    draws: '{draws}, at the lowest prices of {time}.',
    // {item}: an item's name; {count}: how many, "1" or "1-3"; {chance}: a percentage.
    draw: '{item} {count} ({chance}%)',
    // A heading in capitals over the alert form.
    alert: 'Alert',
    // {when}: a list of auction.when.
    whenLowest: 'When the lowest {when}',
    // {field}: a field where the price is typed.
    silver: '{field} silver',
    // Read aloud only, for that field.
    priceLabel: 'Price in silver',
    // Dimmed after the price field. {price}: the lowest price now, in coins.
    now: 'now {price}',
    // In place of the price field when auction.when.appears is chosen.
    appearsNote: 'When it is on sale again, after an hour with none.',
    // A checkbox. {kind}: its bonuses ("of the Eagle") or auction.page.plain.
    kindOnly: 'This kind only ({kind})',
    // A checkbox.
    inGame: 'Tell me in the game too',
    // After an alert is set. {see}: the link auction.page.seeAlerts.
    alertSet: 'Alert set. {see}',
    seeAlerts: 'See alerts',
    // A button.
    setAlert: 'Set alert',
    checked: 'Checked every hour while Twinmap is open.',
    playFirst: 'Play a character with the addon on to set alerts for it.',
    // A heading in capitals.
    findInGame: 'Find it in the game',
    // The item's name, to type in the game's search. {name}: the name.
    quoted: '"{name}"',
    // A link that copies the name, then says it is done: short.
    copy: 'Copy',
    copied: 'Copied',
  },
  // What an alert waits for, in the list after auction.page.whenLowest.
  when: {
    below: 'goes below',
    above: 'goes above',
    appears: 'appears at all',
  },

  // The list of alerts (Alerts on the left).
  alerts: {
    // The columns, in capitals: short.
    item: 'Item',
    whenLowest: 'When the lowest',
    now: 'Now',
    state: 'State',
    inGame: 'In game',
    // After an item's name, dimmed: the alert is for every kind of the item.
    anyKind: 'any kind',
    // In the column auction.alerts.whenLowest. {price}: a price in coins.
    below: 'goes below {price}',
    above: 'goes above {price}',
    // In the column auction.alerts.now.
    notOnSale: 'not on sale',
    // In the column auction.alerts.state, after a dot. {time}: an hour.
    met: 'Met at {time}',
    // The same with the lowest price then. {price}: a price in coins.
    metAt: 'Met at {time}, {price}',
    waiting: 'waiting',
    // In the column auction.alerts.inGame: short.
    sent: 'sent',
    on: 'on',
    off: 'off',
    // A small button.
    remove: 'Remove',
    none: 'No alerts at this house yet. Open an item and set one on the right of its page.',
    // "Now" and "Attention" are the tab Now and its part Attention.
    note: 'Alerts are checked each hour when new prices arrive, only while Twinmap is open. A met alert shows here, in Now under Attention, and in the game if you choose so.',
  },

  // The list of My items: what the characters of the house hold.
  mine: {
    // Three small headings in capitals over the totals: short.
    worthAh: 'Worth at the auction house',
    atVendor: 'At a vendor',
    notOnSale: 'Not on sale now',
    // Under auction.mine.notOnSale. {count}: how many.
    items: { other: '{count} items' },
    // Read aloud only: the buttons that choose where the items are.
    where: 'Where',
    // Buttons side by side: short.
    everything: 'Everything',
    // The columns, in capitals: short.
    colItem: 'Item',
    colWhere: 'Where',
    colHowMany: 'How many',
    colLowestEach: 'Lowest each',
    colAh: 'At the AH',
    colVendor: 'At a vendor',
    colBetter: 'Better',
    // In the column auction.mine.colBetter, in capitals: very short. AH is the auction house.
    better: {
      ah: 'AH',
      vendor: 'Vendor',
    },
    // In the column auction.mine.colLowestEach.
    notOnSaleRow: 'not on sale',
    none: 'No character of this house yet. Play one with the Twinmap Forever addon on, and its bags show here.',
    // "Better" is the column auction.mine.colBetter.
    betterNote: '"Better" counts the 5% the auction house keeps; the deposit is not counted.',
    // After auction.mine.betterNote. {count}: how many characters; {names}: their names, joined by commas; {region}: EU, US...; {ruleset}: auction.ruleset.
    guessed: {
      one: '{names}: counted as playing {region} {ruleset}, which the game has not told yet for this character.',
      other: '{names}: counted as playing {region} {ruleset}, which the game has not told yet for them.',
    },
  },
  // Where a character keeps an item: on the buttons and in the column of My items. Short.
  place: {
    bags: 'Bags',
    bank: 'Bank',
    worn: 'Worn',
  },
  // The same inside the line auction.page.have, after a comma.
  held: {
    bags: 'bags',
    bank: 'bank',
    worn: 'worn',
  },

  // The list of every item on sale.
  browse: {
    // The columns, in capitals: short.
    name: 'Name',
    lowest: 'Lowest',
    typical: 'Typical',
    available: 'Available',
    vendor: 'Vendor',
    hours: '24 hours',
    // After the name of an item sold in several kinds, after an arrow. {count}: how many.
    kinds: { one: '{count} kind', other: '{count} kinds' },
    // Before the lowest price of an item sold in several kinds, dimmed.
    from: 'from',
    // The kind of an item with no bonuses, in the list of its kinds.
    plainRow: '(plain)',
    // When nothing is found. {typed}: what was searched; {category}: a category, its levels joined by dots.
    nothing: {
      typed: 'Nothing on sale answers "{typed}".',
      typedIn: 'Nothing on sale answers "{typed}" in {category}.',
      filters: 'Nothing on sale answers these filters.',
      filtersIn: 'Nothing on sale answers these filters in {category}.',
    },
    // A button at the end of a long list. {count}: how many more rows; {total}: how many in all.
    more: 'Show {count} more of {total}',
  },

  // The line at the bottom of the tab, that Blizzard's terms ask for.
  foot: {
    // {source} is auction.foot.source, in bold.
    attribution: '{source}, through the Battle.net API. Twinmap is not affiliated with or endorsed by Blizzard.',
    source: 'Auction data: Blizzard Entertainment',
    // At the right of the same line.
    approximate: 'Quantities are approximate',
    // A small cross at the end of the line, read aloud and on hover: hides it for good (M20-F9).
    hide: 'Hide this line',
  },

  // The chart of prices on the page of an item (Chart.svelte).
  chart: {
    // Read aloud only.
    label24h: 'Prices over the last 24 hours',
    label7d: 'Prices over the last 7 days',
    // Inside the chart where nothing was collected yet.
    emptyHours: 'no prices collected yet for these hours',
    emptyDays: 'no prices collected yet for these days',
    // On a point, on hover. {time}: an hour; {typical} and {lowest}: prices; {count}: how many on sale.
    pointHour: '{time}: typical {typical}, lowest {lowest}, {count} on sale',
    // The same for a day, its numbers the mean of its hours. {time}: a day.
    pointDay: '{time}: typical {typical}, lowest {lowest}, {count} on sale (mean of its hours)',
    // Under the last day on the axis: very short.
    today: 'today',
    // A price on the axis and on hover, one letter for each coin. {amount}: a number.
    coin: {
      gold: '{amount}g',
      silver: '{amount}s',
      copper: '{amount}c',
    },
    // The legend under the chart.
    typical: 'Typical price (median)',
    lowest: 'Lowest',
    available: 'Available',
    // Read aloud only: the two buttons beside the legend.
    range: 'Chart range',
    // Buttons: short.
    hours: '24 hours',
    days: '7 days',
    noteHours: 'Only prices really collected are drawn: one point an hour. The lines grow from there.',
    noteDays: 'Only prices really collected are drawn: one point a day, the lowest of the day and the mean of its hours. The lines grow from there.',
  },
}
