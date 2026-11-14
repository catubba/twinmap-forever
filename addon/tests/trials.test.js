// The camouflage trials: temporary settings that change how the strip is shown, never what it says.
// Remove with the sliders of Options.lua once values are chosen.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const SLIDERS = ['on', 'neg', 'gap', 'cycles', 'base', 'amp'];

function enterWorld() {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
const slide = (addon, key, value) => addon.slide(`TwinmapForeverTune${SLIDERS.indexOf(key) + 1}`, value);
const setting = (addon, key) => addon.lua(`local ns = ...; return ns.db.${key}`);
const negatives = (addon) => addon.strips().map((s) => decodeStrip(s).negative);

test('each slider changes its setting, and one button puts every choice back to the defaults', () => {
  const addon = enterWorld();
  const all = [...SLIDERS, 'idle', 'paused', 'position', 'mode'];
  SLIDERS.forEach((key, i) => slide(addon, key, 7 + i));
  for (const i of [1, 2, 3, 4]) addon.click(`TwinmapForeverOption${i}`);
  assert.deepEqual(all.map((k) => setting(addon, k)), ['7', '8', '9', '10', '11', '12', 'flat', 'true', 'BOTTOM', 'fast']);

  addon.click('TwinmapForeverTuneReset');
  assert.deepEqual(all.map((k) => setting(addon, k)), ['30', '30', '0', '1', '0', '50', 'flat', 'false', 'TOP', 'steady']);
});

test('the contrast of before becomes the new one for who never moved it, and stays for who chose another', () => {
  const contrast = (saved) => {
    const addon = loadAddon(DIR);
    addon.lua(`TwinmapForeverDB = ${saved}`);
    addon.fire('PLAYER_LOGIN');
    return setting(addon, 'amp');
  };
  assert.equal(contrast('{}'), '50'); // a new install
  assert.equal(contrast('{ amp = 100 }'), '50'); // the default of before
  assert.equal(contrast('{ amp = 180 }'), '180'); // the player's own
  assert.equal(contrast('{ amp = 100, defaults = 2 }'), '100'); // chosen after the change
});

test('a block is shown as many times as asked, each time followed by its negative', () => {
  const addon = enterWorld();
  slide(addon, 'cycles', 3);
  addon.run(10);
  assert.deepEqual(negatives(addon), [false, true, false, true, false, true]);
  assert.equal(new Set(addon.strips().map((s) => decodeStrip(s).id)).size, 1);
});

test('at low contrast the same block is drawn, with two close levels and the even one between', () => {
  const usual = enterWorld();
  usual.run(10);

  const addon = enterWorld();
  slide(addon, 'base', 10);
  slide(addon, 'amp', 20);
  addon.lua('GAME.threshold = 20 / 255; LEVELS = {}');
  addon.run(10);
  assert.deepEqual(addon.strips(), usual.strips());
  assert.equal(addon.lua('local n = {} for v in pairs(LEVELS) do n[#n + 1] = math.floor(v * 255 + 0.5) end table.sort(n) return table.concat(n, " ")'), '10 20 30'); // 20: the even cell past the end of the block, halfway between the two
});

test('when the contrast changes while playing, no cell keeps the levels of before', () => {
  // A long block at the usual levels, short ones at the new levels, then the long one again: its
  // cells past the end of the short ones are the ones that could be left as they were.
  const long = 'Stormwind City is here '.repeat(4);
  const addon = enterWorld();
  addon.lua(`GAME.zone = "${long}"`);
  addon.run(10);
  addon.lua('GAME.zone = "Elwynn"');
  addon.run(10);
  const before = addon.strips().length;
  slide(addon, 'base', 10);
  slide(addon, 'amp', 20);
  addon.run(10);
  addon.lua(`GAME.zone = "${long}"`);
  addon.run(10);
  const after = addon.strips().slice(before);
  assert.ok(after.length > 4);
  for (const strip of after) assert.ok(decodeStrip(strip).section, 'a strip the app cannot read');
});

test('repeating the last block with no hold swaps it and its negative every frame', () => {
  const addon = enterWorld();
  slide(addon, 'on', 0);
  slide(addon, 'neg', 0);
  addon.click('TwinmapForeverOption4'); // flat
  addon.click('TwinmapForeverOption4'); // repeat
  addon.run(10);
  const before = addon.strips().length;
  addon.run(1);
  const shown = negatives(addon).slice(before);
  assert.equal(shown.length, 60, 'one showing a frame');
  assert.deepEqual(shown.slice(0, 4), [shown[0], !shown[0], shown[0], !shown[0]]);
});

test('with an even line between blocks, the line follows the block and its negative', () => {
  const addon = enterWorld();
  addon.click('TwinmapForeverOption4'); // flat
  addon.run(10);
  const strips = addon.strips();
  assert.equal(strips.length, 3);
  assert.equal(strips[2].length, 1, 'one even cell, not a row of them');
});
