const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const STOCKADE = 'GAME.instance = { name = "The Stockade", kind = "party", id = 34 }';

function enterWorld(before) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
// What the section of the kills said last, or undefined when it never spoke.
const kills = (addon) => {
  const last = addon.strips().map(decodeStrip).filter((b) => b.section === 'kills').at(-1);
  return last && JSON.parse(last.text);
};

test('in the open world nothing is said of bosses', () => {
  const addon = enterWorld();
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 1, 'Hogger']).slice(1, -1)})`);
  addon.run(12);
  assert.equal(kills(addon), undefined);
});

test('a boss killed in a dungeon is told once, however the game tells it, and a fight lost is not', () => {
  const addon = enterWorld(STOCKADE);
  addon.run(12);
  assert.deepEqual(kills(addon), { map: 34, list: [] });
  addon.lua(`T_fire(${JSON.stringify(['ENCOUNTER_END', 2757, 'Kam Deepfury', 1, 5, 0]).slice(1, -1)})`); // a wipe
  addon.lua(`T_fire(${JSON.stringify(['ENCOUNTER_END', 2756, 'Targorr the Dread', 1, 5, 1]).slice(1, -1)})`);
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2756, 'Targorr the Dread']).slice(1, -1)})`);
  addon.run(3);
  assert.deepEqual(kills(addon), { map: 34, list: ['Targorr the Dread'] });
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2758, 'Hamhock']).slice(1, -1)})`);
  addon.run(3);
  assert.deepEqual(kills(addon), { map: 34, list: ['Hamhock', 'Targorr the Dread'] });
});

test('the kills outlive a reload, and start again in another dungeon, on a reset, on a second kill, with time', () => {
  const addon = enterWorld(STOCKADE);
  addon.run(12);
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2756, 'Targorr the Dread']).slice(1, -1)})`);
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2758, 'Hamhock']).slice(1, -1)})`);
  addon.run(3);
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.lua('local ns = ...; ns.db.mode = "fast"');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(12);
  assert.deepEqual(kills(addon).list, ['Hamhock', 'Targorr the Dread'], 'after a reload');

  // The same boss again, minutes later: another run has begun.
  addon.run(300);
  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2756, 'Targorr the Dread']).slice(1, -1)})`);
  addon.run(3);
  assert.deepEqual(kills(addon).list, ['Targorr the Dread'], 'killed again');

  addon.lua('INSTANCE_RESET_SUCCESS = "%s has been reset."');
  addon.lua(`T_fire(${JSON.stringify(['CHAT_MSG_SYSTEM', 'The Stockade has been reset.']).slice(1, -1)})`);
  addon.run(3);
  assert.deepEqual(kills(addon).list, [], 'reset by the group');

  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 2758, 'Hamhock']).slice(1, -1)})`);
  addon.lua('GAME.instance = { name = "Deadmines", kind = "party", id = 36 }');
  addon.run(3);
  assert.deepEqual(kills(addon), { map: 36, list: [] }, 'another dungeon');

  addon.lua(`T_fire(${JSON.stringify(['BOSS_KILL', 644, 'Rhahk\'Zor']).slice(1, -1)})`);
  addon.run(3);
  assert.deepEqual(kills(addon).list, ['Rhahk\'Zor']);
  addon.lua('local ns = ...; ns.db.kills.at = ns.db.kills.at - 2 * 60 * 60 - 5');
  addon.run(3);
  assert.deepEqual(kills(addon).list, [], 'two hours on');
});
