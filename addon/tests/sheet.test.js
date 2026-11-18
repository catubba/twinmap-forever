const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const KEY = 'Catubbio Sucameli';

// A gnome warlock with some money, a backpack, one bag, the reagent bag, a keyring and two things worn.
const WORLD = `GAME.surname, GAME.level, GAME.race, GAME.class, GAME.money = "Sucameli", 24, "Gnome", "WARLOCK", 3440
  GAME.bags = { [0] = { size = 16, items = { [1] = { 6948, 1 }, [3] = { 159, 5 } } }, [1] = { size = 6, items = {} }, [5] = { size = 12, items = { [2] = { 2447, 7 } } }, [-1] = { size = 32, items = { [1] = { 5396, 1 } } } }
  GAME.worn = { [1] = { 4245, 30, 35 }, [5] = { 6097 } }`;

function enterWorld(before = WORLD) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
// Each send of the sheet, its parts put back together: a big one goes out in several blocks.
const sheets = (addon) => {
  const out = [], parts = new Map()
  for (const b of addon.strips().map(decodeStrip).filter((b) => b.section === 'sheet')) {
    const send = parts.get(b.version) ?? []
    send[b.part - 1] = b.text
    parts.set(b.version, send)
    if (send.filter((t) => t !== undefined).length === b.total) out.push(JSON.parse(send.join(''))), parts.delete(b.version)
  }
  return out
}
// The app says it holds this character's sheet up to rev, under code.
const appHolds = (addon, code, rev) => addon.lua(`local ns = ...; ns.receivers.sheet({ ["${KEY}"] = { code = "${code}", rev = ${rev} } })`);

test('the whole sheet goes out at first, with who, money, bags with the reagent bag and the keyring, and what is worn', () => {
  const addon = enterWorld();
  addon.run(10);
  const [sent] = sheets(addon);
  assert.equal(sent.key, KEY);
  assert.match(sent.code, /^[0-9a-f]{8}$/);
  assert.deepEqual(sent.p, {
    who: { name: KEY, race: 'Gnome', class: 'WARLOCK', level: 24 },
    money: 3440,
    bags: [{ b: 0, n: 16, s: [[1, 6948, 1], [3, 159, 5]] }, { b: 1, n: 6, s: [] }, { b: 5, n: 12, s: [[2, 2447, 7]] }, { b: -1, n: 32, s: [[1, 5396, 1]] }],
    gear: [[1, 4245, 30, 35], [5, 6097]],
    skills: [],
    spells: [],
    recipes: { known: [], seen: [] },
    trainers: [],
    tips: [],
  });
  assert.equal(sent.p.bank, undefined, 'the bank went out before it was ever open');
});

test('what the app holds is not sent again; a purchase sends money and bags only', () => {
  const addon = enterWorld();
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.run(40);
  assert.equal(sheets(addon).length, 1, 'the sheet went out again after the app had it');

  addon.lua('GAME.money = 3415; GAME.bags[0].items[3] = { 159, 10 }');
  addon.run(4);
  const bought = sheets(addon).at(-1);
  assert.deepEqual(Object.keys(bought.p).sort(), ['bags', 'money']);
  assert.equal(bought.money, undefined);
  assert.equal(bought.p.money, 3415);
  assert.ok(bought.rev > first.rev);
});

test('a change the app has not taken goes out again every half minute, until it has', () => {
  const addon = enterWorld();
  addon.run(10);
  const first = sheets(addon).at(-1);
  addon.run(65);
  assert.equal(sheets(addon).length, 3, 'not sent again while the app did not have it');
  appHolds(addon, first.code, first.rev);
  addon.run(65);
  assert.equal(sheets(addon).length, 3);
});

test('what changed while the app was closed reaches it when it opens, across a /reload', () => {
  const addon = enterWorld();
  addon.run(10);
  const first = sheets(addon).at(-1);
  // The app took it and closed: its word stays among the parts the addon keeps.
  addon.lua(`TwinmapForeverDB.inbox = { id = "test", seq = 1, parts = { sheet = { ["${KEY}"] = { code = "${first.code}", rev = ${first.rev} } } } }`);
  addon.lua('local ns = ...; ns.receivers.sheet(TwinmapForeverDB.inbox.parts.sheet)');
  addon.run(10);
  const before = sheets(addon).length;

  addon.lua('GAME.money = 9000');
  addon.run(4);
  addon.lua('GAME.level = 25');
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.lua('GAME.worn[5] = nil');
  addon.run(10);
  const after = sheets(addon).slice(before);
  const last = after.at(-1);
  assert.equal(last.code, first.code, 'a /reload started the sheet over');
  assert.deepEqual(Object.keys(last.p).sort(), ['gear', 'money', 'who']);
  assert.equal(last.p.money, 9000);
  assert.equal(last.p.who.level, 25);
});

test('the bank goes out once open, and stays as it was seen after it closes', () => {
  const addon = enterWorld(WORLD + `
    GAME.bags[6] = { size = 48, items = { [2] = { 2589, 20 } } }
    GAME.bags[7] = { size = 8, items = {} }`);
  addon.run(10);
  const first = sheets(addon).at(-1);
  assert.equal(first.p.bank, undefined);
  appHolds(addon, first.code, first.rev);

  addon.fire('BANKFRAME_OPENED');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { bank: [{ b: 6, n: 48, s: [[2, 2589, 20]] }, { b: 7, n: 8, s: [] }] });
  addon.fire('BANKFRAME_CLOSED');
  appHolds(addon, first.code, sheets(addon).at(-1).rev);
  const count = sheets(addon).length;
  addon.lua('GAME.bags[6].items[2] = nil');
  addon.run(10);
  assert.equal(sheets(addon).length, count, 'the bank was read while closed');
});

test('an app that holds another sheet gets this one whole; an app ahead of it gets it whole, past its revision', () => {
  const addon = enterWorld();
  addon.run(10);
  const first = sheets(addon).at(-1);

  appHolds(addon, 'deadbeef', 50);
  addon.lua('GAME.money = 1');
  addon.run(4);
  assert.deepEqual(Object.keys(sheets(addon).at(-1).p).sort(), ['bags', 'gear', 'money', 'recipes', 'skills', 'spells', 'tips', 'trainers', 'who']);

  appHolds(addon, first.code, 50);
  addon.run(4);
  const again = sheets(addon).at(-1);
  assert.equal(again.code, first.code);
  assert.ok(again.rev > 50, `revision ${again.rev}`);
  assert.deepEqual(Object.keys(again.p).sort(), ['bags', 'gear', 'money', 'recipes', 'skills', 'spells', 'tips', 'trainers', 'who']);
});

test('in a fight the sheet waits', () => {
  const addon = enterWorld();
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.lua('GAME.combat, GAME.money = true, 100');
  addon.run(10);
  assert.equal(sheets(addon).length, 1);
  addon.lua('GAME.combat = false');
  addon.run(4);
  assert.equal(sheets(addon).at(-1).p.money, 100);
});

// A warlock who knows two spells, has two skills, two talents, and Engineering: one recipe of two learned.
const MORE = WORLD + `
  GAME.skills = { { 202, 168, 225 }, { 0, 0, 0, true }, { 95, 140, 145 } }
  GAME.spells = { { 686 }, { 172 }, { 6229, true } }
  GAME.talents = { [105874] = { 1, 412758 }, [105875] = { 3, 30288 } }
  GAME.free = 2`;

test("skills, spells and talents go out with the sheet, by the game's numbers; a spell not learned yet does not", () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  const { p } = sheets(addon).at(-1);
  assert.deepEqual(p.skills, [[95, 140, 145], [202, 168, 225]]);
  assert.deepEqual(p.spells, [172, 686]);
  assert.deepEqual(p.talents, { free: 2, t: [[105874, 1, 412758], [105875, 3, 30288]] });
});

test('a spell learned sends the spells alone, and a skill gone up the skills alone', () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.lua('table.insert(GAME.spells, { 1454 })');
  addon.fire('SPELLS_CHANGED');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { spells: [172, 686, 1454] });
  appHolds(addon, first.code, sheets(addon).at(-1).rev);
  addon.lua('GAME.skills[1][2] = 169');
  addon.fire('CHAT_MSG_SKILL');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { skills: [[95, 140, 145], [202, 169, 225]] });
});

test('the recipes come from the window of a profession, and one learned since without it', () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);

  addon.lua('GAME.trade = { profession = 202, recipes = { [3930] = true, [3931] = false } }');
  addon.fire('TRADE_SKILL_SHOW');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { recipes: { known: [3930], seen: [202] } });
  appHolds(addon, first.code, sheets(addon).at(-1).rev);

  addon.lua('GAME.trade = nil; T_fire("NEW_RECIPE_LEARNED", 3931)');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { recipes: { known: [3930, 3931], seen: [202] } });

  // Kept across a /reload: the window needs no opening again.
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.lua(`local ns = ...; ns.receivers.sheet({ ["${KEY}"] = { code = "${first.code}", rev = 0 } })`);
  addon.run(10);
  assert.deepEqual(sheets(addon).at(-1).p.recipes, { known: [3930, 3931], seen: [202] });
});

test("a recipe the window has not loaded yet, or a window of someone else's recipes, changes nothing", () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.lua('GAME.trade = { profession = 202, recipes = { [3930] = true } }');
  addon.lua('local info = C_TradeSkillUI.GetRecipeInfo; C_TradeSkillUI.GetRecipeInfo = function(id) return {} end; LOADING = info');
  addon.fire('TRADE_SKILL_SHOW');
  addon.run(4);
  assert.equal(sheets(addon).length, 1, 'a window still loading was taken');
  addon.lua('C_TradeSkillUI.GetRecipeInfo = LOADING; GAME.trade.linked = true');
  addon.fire('TRADE_SKILL_SHOW');
  addon.run(4);
  assert.equal(sheets(addon).length, 1, 'a linked window was taken');
  addon.lua('GAME.trade.linked = false');
  addon.fire('TRADE_SKILL_LIST_UPDATE');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { recipes: { known: [3930], seen: [202] } });
});

// Springspindle Fizzlegear: a rank, two recipes learned already or not yet within reach (hidden by the window), a header.
const SPRINGSPINDLE = `GAME.trainer = { npc = 5174, trade = true, lines = {
  { "Engineering", "header" },
  { "Expert Engineer", "available", 4038, 4500, 20, 125, "available" },
  { "Iron Strut", "unavailable", 3958, 1800, 0, 160, "unavailable" },
  { "Rough Copper Bomb", "used", 3923, 130, 0, 30, "used" },
} }`;

test('a trainer seen goes out with all it teaches, learned or not, and the window keeps the filters it had', () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.lua(SPRINGSPINDLE);
  addon.fire('TRAINER_SHOW');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p, { trainers: [{ n: 5174, s: [[3923, 130, 0, 30], [3958, 1800, 0, 160], [4038, 4500, 20, 125]] }] });
  assert.equal(addon.lua('return tostring(GAME.filters.available) .. tostring(GAME.filters.unavailable) .. tostring(GAME.filters.used)'), 'truenilnil');
  appHolds(addon, first.code, sheets(addon).at(-1).rev);

  // Learning there changes the window, not what was read: the spells go out, the trainers do not.
  addon.lua('GAME.trainer.lines[2][7] = "used"; table.insert(GAME.spells, { 4038 })');
  addon.fire('SPELLS_CHANGED');
  addon.run(4);
  assert.deepEqual(Object.keys(sheets(addon).at(-1).p), ['spells']);
});

test('a class trainer goes out with the class, and is kept with the others across a /reload', () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  addon.lua(SPRINGSPINDLE);
  addon.fire('TRAINER_SHOW');
  addon.run(4);
  addon.fire('TRAINER_CLOSED');
  addon.lua('GAME.trainer = { npc = 5172, lines = { { "Shadow Bolt", "available", 1106, 1800, 28, nil, "available" } } }');
  addon.fire('TRAINER_SHOW');
  addon.run(4);
  const sent = sheets(addon).at(-1);
  assert.deepEqual(sent.p.trainers.map((t) => [t.n, t.c]), [[5172, 'WARLOCK'], [5174, undefined]]);
  assert.deepEqual(sent.p.trainers[0].s, [[1106, 1800, 28, 0]]);

  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.lua(`local ns = ...; ns.receivers.sheet({ ["${KEY}"] = { code = "${sent.code}", rev = 0 } })`);
  addon.run(10);
  assert.deepEqual(sheets(addon).at(-1).p.trainers.map((t) => t.n), [5172, 5174]);
});

test('a window still empty when it opens is read once it is not', () => {
  const addon = enterWorld(MORE);
  addon.run(10);
  addon.lua('GAME.trainer = { npc = 5174, trade = true, lines = {} }');
  addon.fire('TRAINER_SHOW');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p.trainers, []);
  addon.lua('GAME.trainer.lines = { { "Expert Engineer", "available", 4038, 4500, 20, 125, "available" } }');
  addon.run(4);
  assert.deepEqual(sheets(addon).at(-1).p.trainers, [{ n: 5174, s: [[4038, 4500, 20, 125]] }]);
});

// Tooltips: a staff of the Eagle worn, potions in the backpack, the game's lines of each.
const TIPS = `GAME.tips = {
    [159] = { { "Refreshing Spring Water" }, { "Use: Restores 151 mana over 18 sec.", "00ff00" } },
    [4245] = { { "Small Silk Pack", "1eff00" }, { "Bag", "", "8 Slot" } },
    [6948] = { { "Hearthstone" }, { "Soulbound" } },
    [1155] = { { "Rod of the Sleepwalker of the Eagle", "1eff00" }, { "Two-Hand", "", "Staff" }, { "Durability 90 / 100" } },
  }
  GAME.worn[16] = { 1155, 90, 100, "|cff1eff00|Hitem:1155::::::853:1234567:24:::::|h[Rod of the Sleepwalker of the Eagle]|h|r" }`;

test("the game's tooltip of each item goes out once, with its colours; an item with a suffix carries its key", () => {
  const addon = enterWorld(WORLD + String.fromCharCode(10) + TIPS);
  addon.run(10);
  const [sent] = sheets(addon);
  const key = 'item:1155::::::853:1234567';
  assert.deepEqual(sent.p.tips, {
    'item:159': [['Refreshing Spring Water', ''], ['Use: Restores 151 mana over 18 sec.', '00ff00']],
    'item:4245': [['Small Silk Pack', '1eff00'], ['Bag', '', '8 Slot', '']],
    'item:6948': [['Hearthstone', ''], ['Soulbound', '']],
    [key]: [['Rod of the Sleepwalker of the Eagle', '1eff00'], ['Two-Hand', '', 'Staff', ''], ['Durability 90 / 100', '']],
  });
  assert.deepEqual(sent.p.gear, [[1, 4245, 30, 35], [5, 6097], [16, 1155, 90, 100, key]]);
  assert.deepEqual(sent.p.bags[0].s, [[1, 6948, 1], [3, 159, 5]], 'a plain item carries no key');
});

test('once the app holds the tooltips they go no more, and are not read again; a new item sends its own alone', () => {
  const addon = enterWorld(WORLD + String.fromCharCode(10) + TIPS);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.run(4);
  const emptied = sheets(addon).at(-1);
  assert.deepEqual(emptied.p, { tips: [] }, 'the piece is emptied once, and that is all');
  appHolds(addon, emptied.code, emptied.rev);
  const reads = Number(addon.lua('return GAME.tipReads'));
  addon.lua('GAME.level = 25; GAME.tips[2449] = { { "Earthroot" } }; GAME.bags[0].items[5] = { 2449, 2 }');
  addon.run(40);
  assert.equal(Number(addon.lua('return GAME.tipReads')), reads + 1, 'a level up read the tooltips again, or the new item was not read');
  const news = sheets(addon).filter((b) => b.p.tips && Object.keys(b.p.tips).length).at(-1);
  assert.deepEqual(Object.keys(news.p.tips), ['item:2449']);
});

test('an app that holds another sheet gets every tooltip again', () => {
  const addon = enterWorld(WORLD + String.fromCharCode(10) + TIPS);
  addon.run(10);
  const first = sheets(addon).at(-1);
  appHolds(addon, first.code, first.rev);
  addon.run(4);
  appHolds(addon, 'deadbeef', 99);
  addon.run(4);
  assert.equal(Object.keys(sheets(addon).at(-1).p.tips).length, 4);
});

// The game's own list of statistics and the functions that write each line, as Forever has them (read in the game, 18 November 2026).
const PAPERDOLL = `
  local function Line(label, text, number) return { updateFunc = function(row, unit) row.Label:SetText(label .. ":"); row.Value:SetText(text); row.numericValue = number; row:Show() end } end
  PAPERDOLL_STATINFO = {
    HEALTH = Line("Health", "1,099", 1099),
    STAMINA = { updateFunc = function(row) row.Label:SetText("Stamina:"); row.Value:SetText("|cff19ff19" .. GAME.stamina .. "|r"); row.numericValue = GAME.stamina; wipe(row.lines); row.Bar:SetValue(3) end },
    OFFHAND_DAMAGE = { updateFunc = function(row) row:Hide() end },
    EXPERTISE = Line("Expertise", "0.0%", "0.0%"),
    HASTE = Line("Haste", "15.0%", "15.0%"),
    BLOCK = Line("Block", "12%", 12),
    BROKEN = { updateFunc = function() error("no") end },
  }
  PAPERDOLL_STATCATEGORIES = {
    { categoryName = "General", unit = "player", stats = { { stat = "HEALTH" }, { stat = "STAMINA" }, { stat = "BROKEN" } } },
    { categoryName = "Weapons", unit = "player", stats = { { stat = "OFFHAND_DAMAGE", hideAt = 0 } } },
    { categoryName = "Modifiers", unit = "player", stats = { { stat = "EXPERTISE", hideAt = 0 }, { stat = "HASTE", hideAt = 0 }, { stat = "BLOCK", hideAt = 0, showFunc = function() return false end } } },
    { categoryName = "General", unit = "pet", stats = { { stat = "HEALTH" } } },
  }
  function wipe(t) for k in pairs(t) do t[k] = nil end end
  function UnitResistance(unit, school) return 0, school == 2 and 7 or 0, 0, 0 end
  GAME.stamina = 60`;

test('the statistics are the game\'s own lines, in its order, without those it hides; changing them sends them again', () => {
  const addon = enterWorld(WORLD + PAPERDOLL);
  addon.run(10);
  const [sent] = sheets(addon);
  assert.deepEqual(sent.p.stats, [
    ['General', [['Health', '1,099'], ['Stamina', '60', '19ff19']]], // the colour of a value raised; the line that fails is left out
    ['Modifiers', [['Haste', '15.0%']]], // Expertise is at the value it hides at, Block's own check says no, the off hand writes nothing
    ['Resistances', [['Arcane', '0'], ['Fire', '7'], ['Frost', '0'], ['Nature', '0'], ['Shadow', '0']]],
  ]);
  appHolds(addon, sent.code, sent.rev);
  addon.run(5);
  addon.lua('GAME.stamina = 64');
  addon.fire('PLAYER_EQUIPMENT_CHANGED');
  addon.run(5);
  const news = sheets(addon).at(-1);
  assert.deepEqual(news.p.stats[0], ['General', [['Health', '1,099'], ['Stamina', '64', '19ff19']]]);
});
