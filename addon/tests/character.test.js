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
const blocks = (addon, section) => addon.strips().map(decodeStrip).filter((b) => b.section === section).map((b) => JSON.parse(b.text));

test('level and experience go out, and again when they change', () => {
  const addon = enterWorld('GAME.level, GAME.xp, GAME.xpMax, GAME.rested = 13, 8400, 13600, 2000');
  addon.run(10);
  assert.deepEqual(blocks(addon, 'char'), [{ level: 13, xp: 8400, max: 13600, rested: 2000 }]);
  addon.lua('GAME.xp, GAME.rested = 8950, nil');
  addon.run(4);
  assert.deepEqual(blocks(addon, 'char').at(-1), { level: 13, xp: 8950, max: 13600 });
});

test('the side of the character goes out as one letter', () => {
  const addon = enterWorld('GAME.level, GAME.faction = 13, "Horde"');
  addon.run(10);
  assert.deepEqual(blocks(addon, 'char'), [{ level: 13, side: 'H' }]);
  addon.lua('GAME.faction = "Neutral"');
  addon.run(4);
  assert.deepEqual(blocks(addon, 'char').at(-1), { level: 13 });
});

test('when the game tells nothing of the character, nothing is sent about it', () => {
  const addon = enterWorld();
  addon.run(10);
  assert.deepEqual(blocks(addon, 'char'), []);
});

test('in a fight the position says so, and experience waits for its end', () => {
  const addon = enterWorld('GAME.level, GAME.xp, GAME.xpMax = 13, 8400, 13600');
  addon.run(10);
  assert.equal(blocks(addon, 'pos').at(-1).combat, undefined);

  addon.lua('GAME.combat, GAME.xp = true, 8500');
  addon.run(4);
  assert.equal(blocks(addon, 'pos').at(-1).combat, true);
  assert.equal(blocks(addon, 'char').at(-1).xp, 8400, 'experience went out in combat');

  addon.lua('GAME.combat = false');
  addon.run(4);
  assert.equal(blocks(addon, 'pos').at(-1).combat, undefined);
  assert.equal(blocks(addon, 'char').at(-1).xp, 8500);
});
