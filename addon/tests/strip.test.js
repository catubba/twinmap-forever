const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');

function enterWorld() {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
const blocks = (addon) => addon.strips().map(decodeStrip);

test('the drawn strip decodes to the position the game reports, with the protocol number', () => {
  const addon = enterWorld();
  addon.run(10);
  const strips = addon.strips();
  assert.equal(strips.length, 1, 'an unchanged position is sent once');
  assert.equal(strips[0].length, 1920, 'the strip is exactly as wide as the window');

  const block = decodeStrip(strips[0]);
  assert.equal(block.protocol, Number(addon.ns('PROTOCOL')));
  assert.deepEqual({ ...block, text: JSON.parse(block.text) }, {
    protocol: 1, id: 1, section: 'pos', version: 1, part: 1, total: 1,
    text: { zone: 'Elwynn Forest', sub: 'Goldshire', map: 1429, x: 42.3, y: 65.7, facing: 90 },
  });
});

test('nothing is drawn before the world is entered', () => {
  const addon = loadAddon(DIR);
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
  assert.deepEqual(JSON.parse(all[1].text), { zone: 'Elwynn Forest', sub: '', map: 1429, x: 50, y: 65.7, facing: 0 });

  addon.run(590);
  assert.equal(addon.strips().length, 2, 'not yet');
  addon.run(20);
  all = blocks(addon);
  assert.equal(all.length, 3);
  assert.equal(all[2].text, all[1].text);
});

test('a place with no map sends zone and facing only', () => {
  const addon = loadAddon(DIR);
  addon.lua('GAME.map, GAME.zone, GAME.sub = nil, "The Deadmines", ""');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(10);
  assert.deepEqual(JSON.parse(blocks(addon)[0].text), { zone: 'The Deadmines', sub: '', facing: 90 });
});

test('in a narrow window the data is split into blocks that join back, never cutting a character', () => {
  const addon = loadAddon(DIR);
  const zone = 'Città di Roccavento è qui '.repeat(4);
  addon.lua(`GAME.width, GAME.zone = 320, ${JSON.stringify(zone)}`);
  addon.fire('PLAYER_ENTERING_WORLD');
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
