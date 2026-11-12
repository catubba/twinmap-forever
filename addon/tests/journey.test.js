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

// The whole way: the legs with their points, read off the frame Shortest Path paints its line with
// on the world map. The points are the ones read in the real game on 12 November 2026, cut short.
const lineTold = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'line').map((b) => JSON.parse(b.text)).at(-1);
const WITH_A_FLIGHT = `
  JOURNEY = { owner = "Twinmap", goal = { map = 1415, x = 0.5, y = 0.35, title = "Menethil" }, secondsLeft = 400, legs = {
    { mode = "walk", text = "Walk to Stormwind", seconds = 42 }, { mode = "flight", text = "Fly to Ironforge", seconds = 364 }, { mode = "walk", text = "Walk on", seconds = 36 } } }
  local flight = {}
  for i = 0, 99 do flight[#flight + 1] = { map = 0, x = -8833 + i * 50, y = 479 - i * 12 } end
  PAINTER = { paths = {
    { mode = "walk", points = { { map = 0, x = -8905.2, y = 632 }, { map = 0, x = -8870, y = 600, z = 104 }, { map = 0, x = -8833, y = 479 } } },
    { mode = "flight", points = flight },
    { mode = "walk", points = { { map = 0, x = -3883, y = -709 }, { map = 0, x = -3721, y = -585 } } },
    { mode = "boat", stop = 2, points = { { map = 0, x = 1, y = 2 }, { map = 1, x = 3, y = 4 } } } } }
  -- Another frame of Shortest Path holds paths too: the boats and zeppelins of the world, which are no journey.
  OTHER = { paths = { { mode = "boat", points = { { map = 0, x = 1, y = 2 }, { map = 1, x = 3, y = 4 } } } } }
  function WorldMapFrame:GetChildren() return { GetChildren = function() return OTHER, PAINTER end } end`;

test('with the world map open the legs of the journey go out with their points; the reading stays when the map closes', () => {
  const addon = enterWorld(SHORTEST_PATH + WITH_A_FLIGHT);
  addon.run(10);
  assert.equal(lineTold(addon), undefined, 'the map was never open: nothing is told');
  addon.lua('GAME.mapOpen = true');
  addon.run(6);
  const told = lineTold(addon);
  assert.deepEqual(told.legs.map((leg) => leg.mode), ['walk', 'flight', 'walk'], 'the legs of the journey only, not the stop after');
  assert.deepEqual([told.m, told.x, told.y], [1415, 50, 35], 'with the goal of the journey it was read for');
  assert.deepEqual(told.legs[0].p, [0, -8905, 632, 0, -8833, 479], 'a walk by its two ends, in whole yards');
  assert.equal(told.legs[1].p.length / 3 <= 41, true, 'a long flight is thinned');
  assert.deepEqual([told.legs[1].p.slice(0, 3), told.legs[1].p.slice(-3)], [[0, -8833, 479], [0, -3883, -709]], 'and keeps its two ends');

  addon.lua('GAME.mapOpen = false; PAINTER.paths = {}');
  addon.run(6);
  assert.deepEqual(lineTold(addon), told, 'kept');
  addon.lua('JOURNEY = nil');
  addon.run(6);
  assert.deepEqual(lineTold(addon), [], 'the journey is over: so is the reading');
});

test('legs that are not the journey, or do not read as legs, give no reading and break nothing', () => {
  const addon = enterWorld(SHORTEST_PATH + WITH_A_FLIGHT + ' PAINTER.paths[2].mode = "boat"; GAME.mapOpen = true');
  addon.run(10);
  assert.equal(lineTold(addon), undefined);
  addon.lua('PAINTER.paths[2].mode = "flight"; PAINTER.paths[1].points[1].x = "north"');
  addon.run(6);
  assert.equal(lineTold(addon), undefined);
  addon.lua('PAINTER.paths = 7; function WorldMapFrame:GetChildren() error("no children") end');
  addon.run(6);
  assert.equal(lineTold(addon), undefined);
  assert.equal(told(addon).at(-1).name, 'Menethil', 'the journey itself is still told');
});
