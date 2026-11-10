const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const setting = (addon, key) => addon.lua(`local ns = ...; return ns.db.${key}`);
const label = (addon, i) => addon.lua(`return TwinmapForeverOption${i}.text`);

test('the settings page is registered with the game under the addon name', () => {
  const addon = loadAddon(DIR);
  assert.equal(addon.lua('return SETTINGS_CATEGORY.name'), 'Twinmap Forever');
});

test('a fresh install starts on, on the top edge, in steady mode', () => {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  assert.deepEqual(['paused', 'position', 'mode'].map((k) => setting(addon, k)), ['false', 'TOP', 'steady']);
});

test('each button cycles its setting and shows the current value', () => {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local panel = SETTINGS_CATEGORY.panel; rawget(panel, "OnShow")(panel)');
  assert.deepEqual([1, 2, 3].map((i) => label(addon, i)), ['Strip: On', 'Position: Top edge', 'Mode: Steady']);

  [1, 2, 3].forEach((i) => addon.click(`TwinmapForeverOption${i}`));
  assert.deepEqual(['paused', 'position', 'mode'].map((k) => setting(addon, k)), ['true', 'BOTTOM', 'fast']);
  assert.deepEqual([1, 2, 3].map((i) => label(addon, i)), ['Strip: Paused', 'Position: Bottom edge', 'Mode: Fast']);

  addon.click('TwinmapForeverOption1');
  assert.equal(setting(addon, 'paused'), 'false');
});
