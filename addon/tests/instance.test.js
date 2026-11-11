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
  assert.deepEqual(positions(addon), [{ zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.34, y: 65.71, facing: 90 }]);
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

test('in a dungeon the position says where the minimap is on the window, and nowhere else', () => {
  // A minimap of 198 units at a scale of 0.64 on a window 1440 pixels high, as measured in the game.
  const MINIMAP = `
    GAME.width, GAME.height = 2560, 1440
    Minimap = {
      GetCenter = function() return 2006.5, 1043.75 end, GetWidth = function() return 198 end,
      GetEffectiveScale = function() return 0.64 end, GetZoom = function() return MINIZOOM or 0 end,
    }
    function GetCVar(name) return name == "rotateMinimap" and ROTATES or "0" end`;
  const addon = enterWorld(MINIMAP);
  addon.run(10);
  assert.equal(positions(addon).at(-1).inst, undefined);
  assert.equal(JSON.stringify(positions(addon)).includes('mini'), false);

  addon.lua(DEADMINES);
  addon.run(2);
  assert.deepEqual(positions(addon).at(-1).inst, { id: 36, name: 'Deadmines', kind: 'party', mini: { x: 2408, y: 188, size: 238, zoom: 0 } });

  // The zoom changed, then the minimap set to turn with the character: both are said.
  addon.lua('MINIZOOM = 2');
  addon.run(2);
  assert.equal(positions(addon).at(-1).inst.mini.zoom, 2);
  addon.lua('ROTATES = "1"');
  addon.run(2);
  assert.equal(positions(addon).at(-1).inst.mini.turns, true);

  // A battleground is an instance too, but the game tells the place there: no minimap is asked for.
  addon.lua('GAME.instance = { name = "Warsong Gulch", kind = "pvp", id = 489 }');
  addon.run(2);
  assert.equal(positions(addon).at(-1).inst.mini, undefined);

  // Out again: nothing of the minimap goes out.
  addon.lua('GAME.instance = nil; GAME.zone, GAME.sub, GAME.map, GAME.x = "Westfall", "Moonbrook", 1436, 0.42');
  addon.run(2);
  assert.equal(positions(addon).at(-1).inst, undefined);
});
