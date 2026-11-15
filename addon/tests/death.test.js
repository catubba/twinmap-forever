const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');

function enterWorld(before) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
// What the section of the death said last.
const dead = (addon) => {
  const last = addon.strips().map(decodeStrip).filter((b) => b.section === 'dead').at(-1);
  return last && JSON.parse(last.text);
};
const ELWYNN = 'GAME.zone, GAME.map, GAME.x, GAME.y = "Elwynn Forest", 1429, 0.40, 0.60';

test('never dead, nothing is said', () => {
  const addon = enterWorld(ELWYNN);
  addon.run(12);
  assert.equal(dead(addon), undefined);
});

test('dead in the open: the corpse, then the graveyard the ghost stands at, and nothing once alive again', () => {
  const addon = enterWorld(ELWYNN);
  addon.run(12);
  addon.lua('GAME.dead, GAME.corpse = true, { map = 1429, x = 0.40, y = 0.60 }');
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: true, corpse: { map: 1429, x: 40, y: 60 } });
  // Released: the ghost is at the graveyard, and the map settles a moment later.
  addon.lua('GAME.dead, GAME.ghost, GAME.x, GAME.y = false, true, 0.395, 0.62');
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: true, ghost: true, corpse: { map: 1429, x: 40, y: 60 }, yard: { map: 1429, x: 39.5, y: 62 } });
  // The ghost walks: the graveyard stays where it came back. A reload keeps it.
  addon.lua('GAME.x, GAME.y = 0.398, 0.61');
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(12);
  assert.deepEqual(dead(addon).yard, { map: 1429, x: 39.5, y: 62 });
  addon.lua('GAME.ghost, GAME.corpse = false, nil');
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: false });
  // Said for a minute, then no more; a death after that starts afresh.
  addon.run(65);
  const told = addon.strips().length;
  addon.run(40);
  assert.equal(addon.strips().slice(told).map(decodeStrip).filter((b) => b.section === 'dead').length, 0);
  addon.lua('GAME.dead, GAME.corpse = true, { map = 1429, x = 0.5, y = 0.5 }');
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: true, corpse: { map: 1429, x: 50, y: 50 } });
});

test('a corpse in the next zone is found on the continent', () => {
  const addon = enterWorld(`${ELWYNN}; GAME.parents = { [1429] = 1415 }; GAME.continents = { [1415] = true }`);
  addon.lua('GAME.ghost, GAME.corpse = true, { map = 1415, x = 0.45, y = 0.80 }');
  addon.run(12);
  assert.deepEqual(dead(addon).corpse, { map: 1415, x: 45, y: 80 });
});

test('dead in a dungeon: the dungeon, not a corpse, and the graveyard outside', () => {
  const addon = enterWorld('GAME.instance = { name = "The Stockade", kind = "party", id = 34 }');
  addon.run(12);
  addon.lua('GAME.dead = true');
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: true, inst: 34 });
  addon.lua(`GAME.instance, GAME.dead, GAME.ghost = nil, false, true; ${ELWYNN}`);
  addon.run(3);
  assert.deepEqual(dead(addon), { dead: true, ghost: true, inst: 34, yard: { map: 1429, x: 40, y: 60 } });
});
