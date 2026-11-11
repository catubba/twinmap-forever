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

// A stand-in Questie: three quests on offer (one hidden), and three in the log: one finished, one
// with a creature and an object still to find, one to do at a place.
const QUESTIE = `
  COMPLETE = { [12] = true }
  C_QuestLog = { IsComplete = function(id) return COMPLETE[id] == true end }
  Questie = { db = { profile = { enableAvailable = true, enableTurnins = true, enableAvailableItems = true } } }
  local spawns = { { 1 } }
  ACTIVE = {
    [12] = { quest = { Objectives = { { Completed = true, spawnList = { { TooltipKey = "m_5", Spawns = spawns } } } } } },
    [102] = { quest = { Objectives = {
      { spawnList = { { TooltipKey = "m_117", Spawns = spawns }, { TooltipKey = "o_42", Waypoints = spawns }, { TooltipKey = "m_9", Spawns = {} } } },
      { HideIcons = true, spawnList = { { TooltipKey = "m_8", Spawns = spawns } } },
    } } },
    [300] = { quest = { Objectives = {}, SpecialObjectives = { { spawnList = { { Spawns = spawns } } } } } },
    [400] = { quest = { HideIcons = true, Objectives = {} } },
  }
  QuestieLoader = { _modules = {
    AvailableQuests = { __availableQuests = { [64] = true, [6] = true, [7] = false } },
    ActiveQuests = { GetAll = function() return ACTIVE end },
  } }
`;

test('what Questie shows goes out: on offer, ready to hand in, still to find', () => {
  const addon = enterWorld(QUESTIE);
  addon.run(12);
  assert.deepEqual(section(addon, 'questie'), {
    available: [6, 64],
    items: true,
    active: [
      { id: 12, done: true, event: false, targets: [] },
      { id: 102, done: false, event: false, targets: ['m_117', 'o_42'] },
      { id: 300, done: false, event: true, targets: [] },
    ],
  });
});

test('a quest finished is told within fifteen seconds, and one handed in is gone', () => {
  const addon = enterWorld(QUESTIE);
  addon.run(12);
  addon.lua('COMPLETE[102] = true; ACTIVE[102].quest.Objectives[1].Completed = true');
  addon.run(15);
  assert.deepEqual(section(addon, 'questie').active.find((q) => q.id === 102), { id: 102, done: true, event: false, targets: [] });
  addon.lua('ACTIVE[12] = nil');
  addon.run(15);
  assert.deepEqual(section(addon, 'questie').active.map((q) => q.id), [102, 300]);
});

test("Questie's own switches are kept: icons turned off there are not sent", () => {
  const addon = enterWorld(QUESTIE + 'Questie.db.profile.enableAvailable, Questie.db.profile.enableTurnins, Questie.db.profile.enableAvailableItems = false, false, false');
  addon.run(12);
  const told = section(addon, 'questie');
  assert.deepEqual(told.available, []);
  assert.equal(told.items, false);
  assert.equal(told.active.find((q) => q.id === 12).done, false);
});

test('without Questie nothing is sent about quests', () => {
  const addon = enterWorld();
  addon.run(12);
  assert.equal(section(addon, 'questie'), undefined);
});

test('a long list is cut in several blocks, and the position still goes out between them', () => {
  const many = Array.from({ length: 400 }, (_, i) => `[${1000 + i}] = true`).join(', ');
  const addon = enterWorld(QUESTIE + `QuestieLoader._modules.AvailableQuests.__availableQuests = { ${many} }`);
  addon.run(12);
  assert.equal(section(addon, 'questie').available.length, 400);
  const blocks = addon.strips().map(decodeStrip);
  const first = blocks.findIndex((b) => b.section === 'questie'), last = blocks.findLastIndex((b) => b.section === 'questie' && b.version === blocks[first].version);
  assert.ok(blocks[first].total > 1, 'one block was enough');
  addon.lua('GAME.x = 0.5');
  const before = addon.strips().length;
  addon.lua('QuestieLoader._modules.AvailableQuests.__availableQuests[5000] = true');
  addon.lua('GAME.x = 0.6');
  addon.run(6);
  const after = addon.strips().slice(before).map(decodeStrip);
  const from = after.findIndex((b) => b.section === 'questie'), to = after.findLastIndex((b) => b.section === 'questie');
  assert.ok(last > first && to > from);
});
