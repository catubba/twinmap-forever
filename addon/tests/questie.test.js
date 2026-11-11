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
// A section cut in several blocks, put back together: the last whole one.
function section(addon, name) {
  const parts = addon.strips().map(decodeStrip).filter((b) => b.section === name);
  const last = parts.at(-1);
  if (!last) return undefined;
  const whole = parts.filter((b) => b.version === last.version);
  return JSON.parse(Array.from({ length: last.total }, (_, i) => whole.find((b) => b.part === i + 1).text).join(''));
}

// A stand-in Questie: the icons it holds (each a frame of the game, by name), and three quests in
// the log: one finished, one with a creature and an object still to find, one with nothing to find.
const QUESTIE = `
  COMPLETE = { [12] = true }
  C_QuestLog = { IsComplete = function(id) return COMPLETE[id] == true end }
  FRAMES, COUNT = {}, 0
  function Icon(quest, kind, area, x, y, more)
    COUNT = COUNT + 1
    local name = "QuestieFrame" .. COUNT
    local f = { data = { Id = quest, Type = kind }, AreaID = area, x = x, y = y, miniMapIcon = false }
    for k, v in pairs(more or {}) do f[k] = v end
    _G[name] = f
    FRAMES[quest] = FRAMES[quest] or {}
    FRAMES[quest][name] = name
    return f
  end
  local spawns = { { 1 } }
  ACTIVE = {
    [12] = { quest = { Objectives = { { Completed = true, spawnList = { { TooltipKey = "m_5", Spawns = spawns } } } } } },
    [102] = { quest = { Objectives = { { spawnList = { { TooltipKey = "m_117", Spawns = spawns }, { TooltipKey = "o_42", Waypoints = spawns } } } } } },
    [300] = { quest = { Objectives = {}, SpecialObjectives = { { spawnList = { { Spawns = spawns } } } } } },
  }
  QuestieLoader = { _modules = {
    QuestieMap = { questIdFrames = FRAMES },
    ActiveQuests = { GetAll = function() return ACTIVE end },
  } }
`;
const ICONS = `
  Icon(64, "available", 40, 56.5, 47.25)
  Icon(64, "available", 40, 56.5, 47.25)                         -- a second giver on the same spot
  Icon(64, "available", 40, 56.5, 47.25, { miniMapIcon = true }) -- its twin on the minimap
  Icon(6, "available", 12, 24.234, 74.456)
  Icon(7, "available", 12, 30, 30, { hidden = true })            -- turned off in Questie
  Icon(12, "complete", 12, 42.1, 65.9)
  Icon(102, "monster", 40, 50.05, 20)
  Icon(102, "object", 40, 44, 21.5)
  Icon(300, "event", 1497, 72.41, 11.37)
`;

test('the icons Questie holds go out, each with its quest and its place', () => {
  const addon = enterWorld(QUESTIE + ICONS);
  addon.run(12);
  assert.deepEqual(section(addon, 'questie'), {
    icons: {
      // quest, area, x, y: the last two in hundredths of a percent.
      a: [6, 12, 2423, 7446, 64, 40, 5650, 4725],
      t: [12, 12, 4210, 6590],
      o: [102, 40, 4400, 2150, 102, 40, 5005, 2000, 300, 1497, 7241, 1137],
    },
    active: [
      { id: 12, done: true, targets: [] },
      { id: 102, done: false, targets: ['m_117', 'o_42'] },
      { id: 300, done: false, targets: [] },
    ],
  });
});

test('a quest finished is told within fifteen seconds, and one handed in is gone', () => {
  const addon = enterWorld(QUESTIE + ICONS);
  addon.run(12);
  // Questie takes the icons of what was to find away and puts one where the quest is handed in.
  addon.lua('COMPLETE[102] = true; ACTIVE[102].quest.Objectives[1].Completed = true; FRAMES[102] = nil; Icon(102, "complete", 40, 10, 20)');
  addon.run(15);
  const told = section(addon, 'questie');
  assert.deepEqual(told.active.find((q) => q.id === 102), { id: 102, done: true, targets: [] });
  assert.deepEqual(told.icons.t, [12, 12, 4210, 6590, 102, 40, 1000, 2000]);
  assert.deepEqual(told.icons.o, [300, 1497, 7241, 1137]);
  addon.lua('ACTIVE[12] = nil; FRAMES[12] = nil');
  addon.run(15);
  assert.deepEqual(section(addon, 'questie').active.map((q) => q.id), [102, 300]);
  assert.deepEqual(section(addon, 'questie').icons.t, [102, 40, 1000, 2000]);
});

test('with no icon on the map the lists go out empty', () => {
  const addon = enterWorld(QUESTIE);
  addon.run(12);
  assert.deepEqual(section(addon, 'questie').icons, { a: [], t: [], o: [] });
});

test('without Questie nothing is sent about quests', () => {
  const addon = enterWorld();
  addon.run(12);
  assert.equal(section(addon, 'questie'), undefined);
});

const many = (n) => `for i = 1, ${n} do Icon(1000 + i % 150, i % 3 == 0 and "monster" or "available", 10 + i % 40, (i * 7.31) % 100, (i * 3.17) % 100) end`;

test('a long list is cut in several blocks, and the position still goes out between them', () => {
  const addon = enterWorld(QUESTIE + many(400));
  addon.run(12);
  const told = section(addon, 'questie');
  assert.equal((told.icons.a.length + told.icons.o.length) / 4, 400);
  const blocks = addon.strips().map(decodeStrip);
  const first = blocks.findIndex((b) => b.section === 'questie'), last = blocks.findLastIndex((b) => b.section === 'questie' && b.version === blocks[first].version);
  assert.ok(blocks[first].total > 1, 'one block was enough');
  addon.lua('GAME.x = 0.5');
  const before = addon.strips().length;
  addon.lua('Icon(5000, "available", 12, 1, 1)');
  addon.lua('GAME.x = 0.6');
  addon.run(6);
  const after = addon.strips().slice(before).map(decodeStrip);
  const from = after.findIndex((b) => b.section === 'questie'), to = after.findLastIndex((b) => b.section === 'questie');
  assert.ok(last > first && to > from);
});

test('on a window 2560 wide, six hundred icons take under two seconds to cross', () => {
  const addon = enterWorld('GAME.width = 2560 ' + QUESTIE + many(600));
  addon.run(12);
  const blocks = addon.strips().map(decodeStrip).filter((b) => b.section === 'questie');
  // A block and its negative stay up 50 ms each (the addon's defaults): a tenth of a second a block.
  const seconds = blocks[0].total * 0.1;
  assert.ok(seconds < 2, `${blocks[0].total} blocks, ${seconds} s`);
});
