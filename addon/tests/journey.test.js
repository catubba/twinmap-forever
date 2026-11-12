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

// What Twinmap follows is given to Shortest Path to guide. SP.calls: what it was asked, in order; SP.at: the
// stop its journey is at; SP.ended: why the last one ended. It refuses in combat, as the real one does.
const GUIDE = `
  SP = { calls = {} }
  ShortestPathForever = { API = {
    Journey = function() return nil, "none" end,
    NavigateRoute = function(owner, stops)
      if GAME.combat then return false end
      local names = {}
      for i, s in ipairs(stops) do names[i] = ("%s %d %.2f %.2f"):format(s.title, s.map, s.x, s.y) end
      SP.calls[#SP.calls + 1] = owner .. ": " .. table.concat(names, ", ")
      SP.at, SP.ended = 1, nil
      return true
    end,
    CurrentStop = function() if SP.at then return SP.at end return nil, "none" end,
    Cancel = function() SP.calls[#SP.calls + 1] = "cancel"; SP.at, SP.ended = nil, "cancelled"; return true end,
    Ended = function() if SP.ended then return SP.ended, 0 end return nil, "none" end,
  } }`;
const calls = (addon) => addon.lua('return table.concat(SP.calls, " | ")');
const PIN = '(...).receivers.pin({ m = 1429, x = 50, y = 25, name = "North Gate", t = 41 })';
const FIVE = `(...).receivers.route({ t = 7, at = 1, stops = {
  { m = 1429, x = 10, y = 50, rx = 0.5, ry = 0.5, name = "One" }, { m = 1429, x = 20, y = 50, rx = 0.5, ry = 0.5, name = "Two" },
  { m = 1429, x = 30, y = 50, rx = 0.5, ry = 0.5, name = "Three" }, { m = 1429, x = 40, y = 50, rx = 0.5, ry = 0.5, name = "Four" },
  { m = 1432, x = 50, y = 50, rx = 0.5, ry = 0.5, name = "Five" } } })`;
const routeTold = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'route').map((b) => JSON.parse(b.text)).at(-1);

test('a point sent from the app starts a journey of Shortest Path, once, and our arrow stays hidden', () => {
  const addon = enterWorld(GUIDE + ' GAME.north, GAME.west, GAME.facing = 0, 0, 0');
  addon.lua(PIN);
  addon.run(4);
  assert.equal(calls(addon), 'Twinmap: North Gate 1429 0.50 0.25');
  assert.equal(addon.arrow(), null, 'Shortest Path guides: no arrow of ours');
  addon.run(6);
  assert.equal(calls(addon), 'Twinmap: North Gate 1429 0.50 0.25', 'asked once');

  // At the goal the point is followed no longer.
  addon.lua('SP.at, SP.ended = nil, "arrived"');
  addon.run(3);
  assert.equal(addon.lua('return tostring((...).PinFollowed())'), 'nil');
});

test('without Shortest Path the same point is followed by our arrow', () => {
  const addon = enterWorld('GAME.north, GAME.west, GAME.facing = 0, 0, 0');
  addon.lua(PIN);
  addon.run(4);
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 0 26');
});

test('in combat Shortest Path refuses: the point is given when the fight ends', () => {
  const addon = enterWorld(GUIDE + ' GAME.combat = true');
  addon.lua(PIN);
  addon.run(5);
  assert.equal(calls(addon), '');
  addon.lua('GAME.combat = false');
  addon.run(3);
  assert.equal(calls(addon), 'Twinmap: North Gate 1429 0.50 0.25');
});

test('a route of five stops becomes one journey; its stops move ours on, a skip of ours gives it again from there', () => {
  const addon = enterWorld(GUIDE);
  addon.lua(FIVE);
  addon.run(4);
  assert.equal(calls(addon), 'Twinmap: One 1429 0.10 0.50, Two 1429 0.20 0.50, Three 1429 0.30 0.50, Four 1429 0.40 0.50, Five 1432 0.50 0.50');
  addon.lua('SP.at = 3');
  addon.run(4);
  assert.deepEqual(routeTold(addon), { t: 7, at: 3, of: 5 });
  assert.equal(calls(addon).split(' | ').length, 1, 'a stop reached is no new asking');

  addon.lua('(...).SkipStop()');
  addon.run(4);
  assert.equal(calls(addon).split(' | ').at(-1), 'Twinmap: Four 1429 0.40 0.50, Five 1432 0.50 0.50');
  addon.lua('SP.at = 2');
  addon.run(4);
  assert.deepEqual(routeTold(addon), { t: 7, at: 5, of: 5 });

  addon.lua('SP.at, SP.ended = nil, "arrived"');
  addon.run(4);
  assert.deepEqual(routeTold(addon), { t: 7, at: 6, of: 5 }, 'the route is done');
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: route complete.');
});

test('a journey cleared in Shortest Path is not asked again: our arrow takes over; a point let go cancels its journey', () => {
  const addon = enterWorld(GUIDE + ' GAME.north, GAME.west, GAME.facing = 0, 0, 0');
  addon.lua(PIN);
  addon.run(4);
  addon.lua('SP.at, SP.ended = nil, "cleared"');
  addon.run(6);
  assert.equal(calls(addon), 'Twinmap: North Gate 1429 0.50 0.25');
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 0 26');

  addon.lua('(...).receivers.pin({ m = 1429, x = 50, y = 75, name = "South Gate", t = 42 })');
  addon.run(4);
  assert.equal(calls(addon).split(' | ').at(-1), 'Twinmap: South Gate 1429 0.50 0.75');
  addon.lua('(...).Forget()');
  addon.run(3);
  assert.equal(calls(addon).split(' | ').at(-1), 'cancel');
});
