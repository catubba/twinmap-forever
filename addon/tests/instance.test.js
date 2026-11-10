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
// The positions sent so far, oldest first.
const positions = (addon) => addon.strips().map(decodeStrip).map((b) => JSON.parse(b.text));
const DEADMINES = 'GAME.instance = { name = "Deadmines", kind = "party", id = 36 }; GAME.zone, GAME.sub, GAME.map, GAME.x = "The Deadmines", "", nil, nil';

test('in the open world the position names no instance', () => {
  const addon = enterWorld('GAME.north, GAME.west = -9465, 74');
  addon.run(10);
  assert.deepEqual(positions(addon), [{ zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.3, y: 65.7, facing: 90 }]);
});

test('entering a dungeon the position says which one and where in it, to the yard', () => {
  const addon = enterWorld();
  addon.run(10);
  addon.lua(DEADMINES + '; GAME.north, GAME.west = -16.4, -383.6');
  addon.run(2);
  assert.deepEqual(positions(addon)[1], { zone: 'The Deadmines', sub: '', facing: 90, inst: { id: 36, name: 'Deadmines', kind: 'party', x: -16, y: -384 } });

  // A step under a yard sends nothing; a longer one does.
  addon.lua('GAME.north = -16.2');
  addon.run(2);
  assert.equal(positions(addon).length, 2);
  addon.lua('GAME.north = -20');
  addon.run(2);
  assert.deepEqual(positions(addon)[2].inst, { id: 36, name: 'Deadmines', kind: 'party', x: -20, y: -384 });
});

test('where the game does not tell the place, the instance is sent without it', () => {
  const addon = enterWorld(DEADMINES);
  addon.run(10);
  assert.deepEqual(positions(addon), [{ zone: 'The Deadmines', sub: '', facing: 90, inst: { id: 36, name: 'Deadmines', kind: 'party' } }]);
});

test('leaving the dungeon the next position has no instance', () => {
  const addon = enterWorld(DEADMINES + '; GAME.north, GAME.west = -16.4, -383.6');
  addon.run(10);
  addon.lua('GAME.instance, GAME.north, GAME.west = nil, -11208, 1673; GAME.zone, GAME.sub, GAME.map, GAME.x = "Westfall", "Moonbrook", 1436, 0.423');
  addon.run(2);
  const all = positions(addon);
  assert.equal(all.length, 2);
  assert.ok(all[0].inst && !('inst' in all[1]));
  assert.equal(all[1].zone, 'Westfall');
});

test('under a roof the position says so, and stops saying it outside', () => {
  const addon = enterWorld('GAME.indoors = true');
  addon.run(10);
  addon.lua('GAME.indoors = false');
  addon.run(2);
  assert.deepEqual(positions(addon).map((p) => p.indoors), [true, undefined]);
});

test('the instance goes out during a fight too', () => {
  const addon = enterWorld();
  addon.run(10);
  addon.lua('GAME.combat = true; ' + DEADMINES);
  addon.run(2);
  assert.equal(positions(addon)[1].inst.id, 36);
});

test('a value the game hides during a fight is never sent', () => {
  // The game marks such values: here the instance's name and the place are hidden, its number is not.
  const addon = enterWorld(DEADMINES + '; GAME.north, GAME.west = -16.4, -383.6; function issecretvalue(v) return v == "Deadmines" or v == -16.4 end');
  addon.run(10);
  assert.deepEqual(positions(addon)[0].inst, { id: 36, kind: 'party' });
});
