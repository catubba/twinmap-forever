// The journey of Shortest Path Forever on the strip: with the addon, without it, and while it is loading.
// The answers of the stand-in API are the ones read in the real game on 12 November 2026.
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
const told = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'journey').map((b) => JSON.parse(b.text));

// JOURNEY: what Journey() answers now. A table is the journey; a word is why there is none to read.
const SHORTEST_PATH = `
  ShortestPathForever = { API = { version = 1, minor = 3, Journey = function()
    if type(JOURNEY) == "table" then return JOURNEY end
    return nil, JOURNEY or "none"
  end } }`;
const TO_IRONFORGE = `JOURNEY = { owner = "AdventureGuideForever", index = 1, guided = true, secondsLeft = 263.4,
  goal = { map = 1415, x = 0.4355, y = 0.687, title = "Three Corners" },
  legs = { { mode = "walk", text = "Walk to Deeprun Tram", seconds = 68 }, { mode = "tram", text = "Ride the tram to Ironforge", seconds = 202 } } }`;

test('without Shortest Path nothing is told of a journey', () => {
  const addon = enterWorld();
  addon.run(12);
  assert.deepEqual(told(addon), []);
});

test('with Shortest Path and no journey ever, nothing is told either', () => {
  const addon = enterWorld(SHORTEST_PATH);
  addon.run(12);
  assert.deepEqual(told(addon), []);
});

test('a journey goes out with its goal and its legs, whoever started it; then that it ended', () => {
  const addon = enterWorld(SHORTEST_PATH);
  addon.run(8);
  addon.lua(TO_IRONFORGE);
  addon.run(6);
  assert.deepEqual(told(addon).at(-1), {
    owner: 'AdventureGuideForever', name: 'Three Corners', m: 1415, x: 43.55, y: 68.7, left: 265,
    legs: [{ mode: 'walk', text: 'Walk to Deeprun Tram', s: 68 }, { mode: 'tram', text: 'Ride the tram to Ironforge', s: 202 }],
  });
  // A few seconds less are not news; a leg done is.
  const before = told(addon).length;
  addon.lua('JOURNEY.secondsLeft = 263');
  addon.run(6);
  assert.equal(told(addon).length, before);
  addon.lua('JOURNEY.secondsLeft = 200; table.remove(JOURNEY.legs, 1)');
  addon.run(6);
  assert.deepEqual(told(addon).at(-1).legs, [{ mode: 'tram', text: 'Ride the tram to Ironforge', s: 202 }]);
  assert.equal(told(addon).at(-1).left, 200);

  addon.lua('JOURNEY = nil');
  addon.run(6);
  assert.deepEqual(told(addon).at(-1), [], 'told that there is none');
});

test('a journey whose plan is still searched is told as loading, then whole', () => {
  const addon = enterWorld(SHORTEST_PATH + ' JOURNEY = "loading"');
  addon.run(10);
  assert.deepEqual(told(addon).at(-1), { loading: true });
  addon.lua(TO_IRONFORGE);
  addon.run(6);
  assert.equal(told(addon).at(-1).name, 'Three Corners');
});

test('a Shortest Path that breaks, or answers what is no journey, sends nothing and breaks nothing', () => {
  const addon = enterWorld('ShortestPathForever = { API = { Journey = function() error("broken") end } }');
  addon.run(10);
  assert.deepEqual(told(addon), []);
  const odd = enterWorld(SHORTEST_PATH + ' JOURNEY = { goal = "nowhere", legs = 7 }');
  odd.run(10);
  assert.deepEqual(told(odd), []);
});
