const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');

// Logs in and enters the world. before: Lua run first, to set the world up. after: Lua run once
// logged in, to change the saved settings.
function enterWorld(before, after) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  if (after) addon.lua(after);
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
const FAST = 'local ns = ...; ns.db.mode = "fast"';
// Every strip decoded, and the blocks they carry: a block and its negative count once.
const decoded = (addon) => addon.strips().map(decodeStrip);
const blocks = (addon) => decoded(addon).filter((b) => !b.negative);
const data = (block) => JSON.parse(block.text);

test('the drawn strip decodes to the position the game reports, with the protocol number', () => {
  const addon = enterWorld();
  addon.run(10);
  const strips = addon.strips();
  assert.equal(strips.length, 2, 'an unchanged position is sent once: the block and its negative');
  assert.equal(strips[0].length, 1920, 'the strip is exactly as wide as the window');

  const block = decodeStrip(strips[0]);
  assert.equal(block.protocol, Number(addon.ns('PROTOCOL')));
  assert.deepEqual({ ...block, text: data(block) }, {
    negative: false, protocol: 1, id: 1, section: 'pos', version: 1, part: 1, total: 1,
    text: { zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.3, y: 65.7, facing: 90 },
  });
});

test('every block is followed by its negative, cell by cell', () => {
  const addon = enterWorld();
  addon.run(10);
  addon.lua('GAME.x = 0.5');
  addon.run(3);
  const strips = addon.strips();
  assert.equal(strips.length, 4);
  for (let i = 0; i < strips.length; i += 2) {
    const negative = [...strips[i]].map((c) => 7 - Number(c)).join('');
    assert.equal(strips[i + 1], negative);
    assert.deepEqual(decodeStrip(strips[i + 1]), { ...decodeStrip(strips[i]), negative: true });
  }
});

test('in fast mode a block is drawn once, with no negative', () => {
  const addon = enterWorld(null, FAST);
  addon.run(10);
  assert.deepEqual(decoded(addon).map((b) => b.negative), [false]);
});

test('nothing is drawn before the world is entered', () => {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  addon.run(10);
  assert.equal(addon.strips().length, 0);
});

test('a move sends a new block, and an unchanged position is sent again after ten minutes', () => {
  const addon = enterWorld();
  addon.run(10);
  addon.lua('GAME.x, GAME.sub, GAME.facing = 0.5, "", 6.27');
  addon.run(2);
  let all = blocks(addon);
  assert.equal(all.length, 2);
  assert.deepEqual([all[1].id, all[1].version], [2, 2]);
  assert.deepEqual(data(all[1]), { zone: 'Elwynn Forest', sub: '', map: 1429, x: 50, y: 65.7, facing: 0 });

  addon.run(590);
  assert.equal(blocks(addon).length, 2, 'not yet');
  addon.run(20);
  all = blocks(addon);
  assert.equal(all.length, 3);
  assert.equal(all[2].text, all[1].text);
});

test('a place with no map sends zone and facing only', () => {
  const addon = enterWorld('GAME.map, GAME.zone, GAME.sub = nil, "The Deadmines", ""');
  addon.run(10);
  assert.deepEqual(data(blocks(addon)[0]), { zone: 'The Deadmines', sub: '', facing: 90 });
});

test('in a narrow window the data is split into blocks that join back, never cutting a character', () => {
  const zone = 'Città di Roccavento è qui '.repeat(4);
  const addon = enterWorld(`GAME.width, GAME.zone = 320, ${JSON.stringify(zone)}`, FAST);
  addon.run(10);
  const strips = addon.strips();
  assert.ok(strips.every((s) => s.length === 320));
  const all = strips.map(decodeStrip);
  assert.ok(all.length > 1 && all.every(Boolean), 'every block is intact');
  assert.deepEqual(all.map((b) => b.part), all.map((_, i) => i + 1));
  assert.ok(all.every((b) => b.total === all.length && !b.text.includes('�')));
  assert.equal(JSON.parse(all.map((b) => b.text).join('')).zone, zone);
});

test('a strip with one wrong cell is refused', () => {
  const addon = enterWorld();
  addon.run(10);
  const [strip] = addon.strips();
  const broken = strip.slice(0, 40) + ((Number(strip[40]) + 1) % 8) + strip.slice(41);
  assert.equal(decodeStrip(broken), null);
});

test('paused, nothing is drawn; back on, the position is sent again even if unchanged', () => {
  const addon = enterWorld();
  addon.run(10);
  assert.equal(blocks(addon).length, 1);

  addon.slash('/twinmap pause');
  addon.lua('GAME.x = 0.5');
  addon.run(30);
  assert.equal(blocks(addon).length, 1, 'drew while paused');
  addon.lua('GAME.x = 0.4234');

  addon.slash('/twinmap pause');
  addon.run(3);
  const all = blocks(addon);
  assert.equal(all.length, 2);
  assert.equal(all[1].text, all[0].text);
  assert.equal(addon.printed(), 'Twinmap Forever: strip paused.\nTwinmap Forever: strip on.');
});

test('the pause survives a login: a paused addon stays silent', () => {
  const addon = enterWorld('TwinmapForeverDB = { paused = true }');
  addon.run(30);
  assert.equal(addon.strips().length, 0);
});

test('in combat only the position goes out; the rest follows when the fight ends', () => {
  const addon = enterWorld(null, `
    local ns = ...
    ns.db.mode = "fast"
    table.insert(ns.sections, { name = "bags", period = 1, build = function() return { n = GAME.n } end })
    GAME.n = 1`);
  addon.run(10);
  assert.deepEqual(blocks(addon).map((b) => b.section).sort(), ['bags', 'pos']);

  addon.lua('GAME.combat, GAME.n, GAME.x = true, 2, 0.5');
  addon.run(10);
  addon.lua('GAME.x = 0.6');
  addon.run(10);
  assert.deepEqual(blocks(addon).slice(2).map((b) => [b.section, data(b).x]), [['pos', 50], ['pos', 60]]);

  addon.lua('GAME.combat = false');
  addon.run(3);
  const last = blocks(addon).at(-1);
  assert.deepEqual([last.section, data(last)], ['bags', { n: 2 }]);
});

test('a block queued before the fight waits for its end', () => {
  const addon = enterWorld(null, `
    local ns = ...
    ns.db.mode = "fast"
    table.insert(ns.sections, { name = "bags", period = 1, build = function() return { n = GAME.n } end })
    GAME.n, GAME.width = string.rep("x", 600), 320`);
  addon.run(6.2); // the first blocks are out, more parts of bags are still queued
  const before = blocks(addon).length;
  addon.lua('GAME.combat = true');
  addon.run(10);
  assert.ok(blocks(addon).slice(before).every((b) => b.section === 'pos'), 'a bags block went out in combat');
  addon.lua('GAME.combat = false');
  addon.run(5);
  const bags = blocks(addon).filter((b) => b.section === 'bags');
  assert.equal(bags.length, bags[0].total, 'every part of bags arrived');
});

test('the strip sits on the edge the player chose, and moves when the choice changes', () => {
  const addon = enterWorld();
  addon.run(10);
  assert.equal(addon.lua('return TwinmapForeverStrip.point'), 'TOPLEFT');
  addon.lua('local ns = ...; ns.db.position = "BOTTOM"; GAME.x = 0.5');
  addon.run(2);
  assert.equal(addon.lua('return TwinmapForeverStrip.point'), 'BOTTOMLEFT');
});
