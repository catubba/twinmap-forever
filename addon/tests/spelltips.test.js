// The tooltips of the spells of the book and of the talents (M20-F16): read in the game, sent with the sheet a batch at a
// time, again when they change.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const KEY = 'Catubbio Sucameli';

// A warlock with two spells and two talents: Fel Concentration at 2 of 3, Wrack not taken. The lines as the game wrote them.
const WORLD = `GAME.surname, GAME.level, GAME.race, GAME.class, GAME.money = "Sucameli", 33, "Gnome", "WARLOCK", 3440
  GAME.bags = { [0] = { size = 16, items = {} } }
  GAME.worn = {}
  GAME.spells = { { 709 }, { 710 } }
  GAME.spellTips = {
    [709] = { { "Drain Life", "", "Rank 3" }, { "135 Mana", "", "20 yd range" }, { "Channeled" }, { "Transfers 36 health every 1 second from the target to the caster. Lasts 5 sec." } },
    [710] = { { "Banish" }, { "100 Mana", "", "30 yd range" }, { "1.3 sec cast" }, { "Banishes the enemy target." } },
  }
  GAME.talents = { [105918] = { 2, 17783, 3 }, [105909] = { 0, 1316697, 1 } }
  GAME.talentTips = {
    [105918] = { { { "Passive" }, { "23% chance" } }, { { "Passive" }, { "47% chance" } }, { { "Passive" }, { "70% chance" } } },
    [105909] = { { { "200 Mana", "", "30 yd range" }, { "Channeled" }, { "Tears the target apart." } } },
  }`;

function enterWorld(before = WORLD) {
  const addon = loadAddon(DIR);
  addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
const sheets = (addon) => {
  const out = [], parts = new Map();
  for (const b of addon.strips().map(decodeStrip).filter((b) => b.section === 'sheet')) {
    const send = parts.get(b.version) ?? [];
    send[b.part - 1] = b.text;
    parts.set(b.version, send);
    if (send.filter((t) => t !== undefined).length === b.total) out.push(JSON.parse(send.join(''))), parts.delete(b.version);
  }
  return out;
};
const appHolds = (addon, code, rev) => addon.lua(`local ns = ...; ns.receivers.sheet({ ["${KEY}"] = { code = "${code}", rev = ${rev} } })`);
// Every tooltip that went out, the last lines of each.
const sentTips = (addon) => Object.assign({}, ...sheets(addon).map((s) => (Array.isArray(s.p.tips) ? {} : s.p.tips ?? {})));

test('each spell of the book goes with its tooltip, each talent at its rank and at the next', () => {
  const addon = enterWorld();
  addon.run(10);
  const tips = sentTips(addon);
  assert.deepEqual(Object.keys(tips).sort(), ['spell:709', 'spell:710', 'talent:105909:1', 'talent:105918:2', 'talent:105918:3']);
  assert.deepEqual(tips['spell:709'], [['Drain Life', '', 'Rank 3', ''], ['135 Mana', '', '20 yd range', ''], ['Channeled', ''], ['Transfers 36 health every 1 second from the target to the caster. Lasts 5 sec.', '']]);
  assert.deepEqual(tips['talent:105918:3'], [['Passive', ''], ['70% chance', '']]);
});

test('a spell the game has not loaded yet is asked for, and goes with its description', () => {
  const addon = enterWorld(WORLD + '\nGAME.unloaded = { [1316697] = true, [710] = true }');
  addon.run(10);
  const tips = sentTips(addon);
  assert.deepEqual(tips['talent:105909:1'].at(-1), ['Tears the target apart.', '']);
  assert.deepEqual(tips['spell:710'].at(-1), ['Banishes the enemy target.', '']);
});

test('no more than a batch at a time: the next once the app holds it', () => {
  const many = Array.from({ length: 60 }, (_, i) => `{ ${1000 + i} }`).join(', ');
  const addon = enterWorld(WORLD + `\nGAME.spells = { ${many} }
    for i = 1000, 1059 do GAME.spellTips[i] = { { "Spell " .. i }, { string.rep("A long description. ", 12) } } end`);
  addon.run(10);
  const size = (s) => JSON.stringify(s.p.tips).length;
  const first = sheets(addon).at(-1);
  assert.ok(size(first) <= 6400, `a batch of ${size(first)} bytes`);
  assert.ok(Object.keys(first.p.tips).length < 63);
  const got = new Set(Object.keys(first.p.tips));
  for (let k = 0; k < 10 && got.size < 63; k++) {
    const last = sheets(addon).at(-1);
    appHolds(addon, last.code, last.rev);
    addon.run(4);
    for (const key of Object.keys(sheets(addon).at(-1).p.tips ?? {})) got.add(key);
  }
  assert.equal(got.size, 63, 'every tooltip went, a batch after another');
});

test('a level up sends again only the tooltips that changed, a talent taken those of its ranks', () => {
  const addon = enterWorld();
  addon.run(10);
  let last = sheets(addon).at(-1);
  appHolds(addon, last.code, last.rev);
  addon.run(4);
  last = sheets(addon).at(-1);
  appHolds(addon, last.code, last.rev);
  addon.lua('GAME.level = 34; GAME.spellTips[709][2] = { "140 Mana", "", "20 yd range" }');
  addon.fire('PLAYER_LEVEL_UP');
  addon.run(10);
  const news = sheets(addon).filter((s) => s.p.tips && !Array.isArray(s.p.tips)).at(-1);
  assert.deepEqual(Object.keys(news.p.tips), ['spell:709']);
  assert.deepEqual(news.p.tips['spell:709'][1], ['140 Mana', '', '20 yd range', '']);
  appHolds(addon, news.code, news.rev);
  addon.lua('GAME.talents[105909][1] = 1; GAME.talentTips[105909][1][3] = { "Tears the target apart, now." }');
  addon.fire('TRAIT_CONFIG_UPDATED');
  addon.run(10);
  const taken = sheets(addon).filter((s) => s.p.tips && !Array.isArray(s.p.tips)).at(-1);
  assert.deepEqual(Object.keys(taken.p.tips), ['talent:105909:1']);
});

test('nothing is read in a fight: the tooltips wait for its end', () => {
  const addon = loadAddon(DIR);
  addon.lua(WORLD + '\nGAME.combat = true');
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(10);
  assert.equal(Number(addon.lua('return GAME.spellReads or 0')), 0);
  addon.lua('GAME.combat = false');
  addon.run(10);
  assert.ok(Number(addon.lua('return GAME.spellReads or 0')) >= 5);
});
