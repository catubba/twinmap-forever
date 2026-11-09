const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');

const DIR = path.join(__dirname, '..', 'TwinmapForever');

test('the addon loads and becomes ready at login', () => {
  const addon = loadAddon(DIR);
  assert.equal(addon.ns('ready'), 'nil');
  addon.fire('PLAYER_LOGIN');
  assert.equal(addon.ns('ready'), 'true');
});

test('/twinmap prints the version of the .toc and the protocol', () => {
  const addon = loadAddon(DIR);
  addon.slash('/twinmap');
  assert.equal(addon.printed(), `Twinmap Forever ${addon.meta.Version}, protocol 1`);
});
