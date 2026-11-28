const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
// The Stockade, where the game tells no place; the character somewhere in it, in yards of the instance.
const STOCKADE = 'GAME.instance = { name = "The Stockade", kind = "party", id = 34 }; GAME.zone, GAME.sub, GAME.map, GAME.x, GAME.north = "The Stockade", "", nil, nil, nil; GAME.far = { x = 104.37, y = 22.81, z = -31.62 }';

// A character in the world, with the participation programme on or off, the quest 123 super-tracked.
function world(on) {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  addon.lua(`TwinmapForeverDB.inbox = { id = "test", seq = 1, parts = { log = ${on} } }; local ns = ...; ns.db.mode = "fast"; FLIGHT_MASTERS = ns.FLIGHT_MASTERS; QUEST = 123`);
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(2);
  return addon;
}
const enter = (addon) => (addon.lua(STOCKADE), addon.fire('PLAYER_ENTERING_WORLD'));
const positions = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'pos').map((b) => JSON.parse(b.text));
const lastFar = (addon) => positions(addon).filter((p) => p.inst).at(-1)?.inst.far;
const off = (far, addon) => Math.hypot(...['x', 'y', 'z'].map((k) => far[k] - Number(addon.lua(`return GAME.far.${k}`))));

test('with the programme on, inside a dungeon the place found from the flight masters goes with the position', () => {
  const addon = world(true);
  enter(addon);
  addon.run(12);
  const far = lastFar(addon);
  assert.ok(far, 'a place is told');
  assert.ok(off(far, addon) < 0.2, `within the rounding: ${JSON.stringify(far)}`);
  assert.ok(far.r < 0.1);
  assert.equal(addon.lua('return SuperTrackedFrame.alpha'), '0', 'the game\'s arrow is hidden meanwhile');
  assert.equal(addon.lua('return PINNED[1]'), '2', 'a flight master is pinned');

  // Running: the distances are read one after the other, each moved by the run since.
  for (let i = 0; i < 80; i++) {
    addon.lua('GAME.far.x, GAME.far.y = GAME.far.x + 0.5, GAME.far.y + 0.3');
    addon.run(0.1);
  }
  // The place itself, not the last one sent: the strip goes out at its own pace, a few tenths of a second behind.
  const running = JSON.parse(addon.lua('local ns = ...; local x, y, z = ns.Far(); return x and ("{\\"x\\":" .. x .. ",\\"y\\":" .. y .. ",\\"z\\":" .. z .. "}") or "null"'));
  assert.ok(running && off(running, addon) < 1, `running, within a yard: ${JSON.stringify(running)}`);
  assert.ok(off(lastFar(addon), addon) < 5, 'and the one sent not far behind');

  // Out of the dungeon: the pin goes, the quest tracked before comes back, the arrow shows again.
  addon.lua('GAME.instance, GAME.north, GAME.west = nil, -8913, 554; GAME.zone, GAME.sub, GAME.map, GAME.x, GAME.y = "Stormwind City", "", 1453, 0.5, 0.5');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(2);
  assert.equal(addon.lua('return PINNED == nil and QUEST == 123 and SuperTrackedFrame.alpha == 1'), 'true');
});

test('with the programme off, nothing is pinned and no place is told', () => {
  const addon = world(false);
  enter(addon);
  addon.run(12);
  assert.equal(lastFar(addon), undefined);
  assert.equal(addon.lua('return PINNED == nil and SuperTrackedFrame.alpha == 1'), 'true');
});

test('where the game tells the place itself, the flight masters are not asked', () => {
  const addon = world(true);
  enter(addon);
  addon.lua('GAME.north, GAME.west = 104, 23');
  addon.run(12);
  assert.equal(lastFar(addon), undefined);
  assert.equal(addon.lua('return PINNED == nil'), 'true');
});

test('the player tracking something else stops it for the rest of the dungeon', () => {
  const addon = world(true);
  enter(addon);
  addon.run(12);
  assert.ok(lastFar(addon));
  addon.lua('QUEST = 456');
  addon.run(5);
  assert.equal(addon.lua('return SuperTrackedFrame.alpha == 1 and QUEST == 456'), 'true', 'the quest chosen stays');
  const after = positions(addon).length;
  addon.lua('GAME.far.x = GAME.far.x + 30');
  addon.run(10);
  assert.ok(positions(addon).slice(after).every((p) => !p.inst?.far), 'no place told after');
  assert.equal(addon.lua('return QUEST'), '456');
});

test('a distance the game hides stops it, with the pin given back', () => {
  const addon = world(true);
  enter(addon);
  addon.run(12);
  addon.lua('GAME.secret = true');
  addon.run(3);
  addon.lua('GAME.far.x = GAME.far.x + 30');
  addon.run(3);
  assert.equal(lastFar(addon), undefined);
  assert.equal(addon.lua('return PINNED == nil and QUEST == 123 and SuperTrackedFrame.alpha == 1'), 'true');
});
