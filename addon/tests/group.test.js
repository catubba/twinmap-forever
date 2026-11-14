const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const MAGE = 'GAME.party = { party1 = { name = "Staliot", second = "Falsaperla", class = "MAGE", map = 1434, x = 0.4847, y = 0.0957 } }';

function enterWorld(before) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
// The companions sent so far, oldest first.
const groups = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'group').map((b) => JSON.parse(b.text).list);
const sent = (addon) => (addon.lua('return table.concat(SENT, ";")') || '').split(';').filter(Boolean);

test('alone, nothing of the group is sent, to the app or to anyone', () => {
  const addon = enterWorld();
  addon.run(10);
  assert.deepEqual(groups(addon), []);
  assert.deepEqual(sent(addon), []);
});

test('a companion is sent with name, class and the place the game gives, on the map they are on', () => {
  const addon = enterWorld(MAGE);
  addon.run(10);
  assert.deepEqual(groups(addon), [[{ n: 'Staliot Falsaperla', c: 'MAGE', m: 1434, x: 48.47, y: 9.57 }]]);
});

test('a companion inside a dungeon is sent without a place, and with the role the group gave', () => {
  const addon = enterWorld('GAME.party = { party1 = { name = "Staliot", second = "Falsaperla", class = "MAGE", role = "DAMAGER" }, party2 = { name = "Bruna", class = "PRIEST", role = "HEALER" }, party3 = { name = "Carlo", class = "WARRIOR", role = "TANK" } }');
  addon.run(10);
  assert.deepEqual(groups(addon), [[{ n: 'Bruna', c: 'PRIEST', r: 'H' }, { n: 'Carlo', c: 'WARRIOR', r: 'T' }, { n: 'Staliot Falsaperla', c: 'MAGE', r: 'D' }]]);
});

test('the character tells the group its own place, when it changes and no more often than every 3 seconds', () => {
  const addon = enterWorld(MAGE);
  addon.run(10);
  assert.equal(addon.lua('return PREFIX_KNOWN'), 'TwinmapF');
  assert.deepEqual(sent(addon), ['TwinmapF|1 1429 42.34 65.71|PARTY']);
  addon.lua('GAME.x = 0.43');
  addon.run(1);
  addon.lua('GAME.x = 0.44');
  addon.run(4);
  assert.deepEqual(sent(addon).slice(1), ['TwinmapF|1 1429 43.00 65.71|PARTY', 'TwinmapF|1 1429 44.00 65.71|PARTY']);
});

test('a place told by the companion\'s Twinmap is believed while fresh, then the game\'s again', () => {
  const addon = enterWorld(MAGE);
  addon.run(10);
  addon.fire('CHAT_MSG_ADDON', 'TwinmapF', '1 1434 50.00 12.50', 'PARTY', 'Staliot Falsaperla');
  addon.run(1);
  assert.deepEqual(groups(addon).at(-1), [{ n: 'Staliot Falsaperla', c: 'MAGE', m: 1434, x: 50, y: 12.5 }]);
  addon.run(10);
  assert.deepEqual(groups(addon).at(-1), [{ n: 'Staliot Falsaperla', c: 'MAGE', m: 1434, x: 48.47, y: 9.57 }]);
});

test('a message of another addon, or one that is not a place, changes nothing', () => {
  const addon = enterWorld(MAGE);
  addon.run(10);
  addon.fire('CHAT_MSG_ADDON', 'Other', '1 1434 50.00 12.50', 'PARTY', 'Staliot Falsaperla');
  addon.fire('CHAT_MSG_ADDON', 'TwinmapF', '1 1434 500 12', 'PARTY', 'Staliot Falsaperla');
  addon.fire('CHAT_MSG_ADDON', 'TwinmapF', 'hello', 'PARTY', 'Staliot Falsaperla');
  addon.run(2);
  assert.equal(groups(addon).length, 1);
});

test('leaving the group, the app is told once that no one is left', () => {
  const addon = enterWorld(MAGE);
  addon.run(10);
  addon.lua('GAME.party = nil');
  addon.run(5);
  assert.deepEqual(groups(addon).at(-1), []);
  assert.equal(groups(addon).length, 2);
});
