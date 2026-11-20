// The log of the participation programme: kept only after a yes from the app, numbers only, a
// session at a time in the saved settings, let go at a no. The app's own reader takes the sessions
// out of the file as the game writes it, and the server's own rule says they are sessions.
const { test, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { loadAddon } = require('./client');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const DUNGEON = 'GAME.instance = { name = "The Hall of Thanes", kind = "party", id = 3065 }; GAME.map, GAME.x, GAME.y = nil, nil, nil';
const IRONFORGE = 'GAME.instance = nil; GAME.map, GAME.x, GAME.y = 1455, 0.30123456, 0.62';

let sessionsIn, logFor;
before(async () => {
  ({ sessionsIn } = await import('../../app/src/main/gamelog.ts'));
  ({ logFor } = await import('../../server/src/index.ts'));
});

// A character in the world; said: the last word of the app on the log, as the inbox keeps it.
function world(said) {
  const addon = loadAddon(DIR);
  addon.lua(IRONFORGE);
  addon.fire('PLAYER_LOGIN');
  if (said !== undefined) addon.lua(`TwinmapForeverDB.inbox = { id = "test", seq = 1, parts = { log = ${said} } }`);
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}
const enter = (addon) => {
  addon.run(2);
  addon.lua(DUNGEON);
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(2);
};
const leave = (addon) => (addon.lua(IRONFORGE), addon.fire('PLAYER_ENTERING_WORLD'));
// The game saves: what the file holds of the log, and the sessions the app reads in it.
const logout = (addon) => {
  addon.fire('PLAYER_LOGOUT');
  const file = addon.saved();
  return { file, sessions: sessionsIn(file).map((s) => JSON.parse(s.text)), texts: sessionsIn(file).map((s) => s.text) };
};

test('with no yes ever heard, and after a no, nothing of the log is in the saved settings', () => {
  for (const said of [undefined, 'false']) {
    const addon = world(said);
    enter(addon);
    const { file } = logout(addon);
    assert.doesNotMatch(file, /\["log"\] = \{|door/, String(said));
  }
});

test('after a yes the door of a dungeon is written down, with the app closed, as numbers the server takes', () => {
  const addon = world('true');
  enter(addon);
  const { sessions, texts, file } = logout(addon);
  assert.equal(sessions.length, 1);
  const [{ id, v, e, log }] = sessions;
  assert.equal(log, 1);
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal(v, addon.meta.Version);
  assert.deepEqual(e, [['door', 0, 3065, 1455, 0.3012, 0.62]]);
  assert.ok(!('error' in logFor(new URLSearchParams({ app: '0.14.0', build: '1.60.1.70938', locale: 'enUS' }), texts[0])));
  assert.doesNotMatch(file, /Catubbio|Sucameli/);
});

test('where the game tells the place in yards of the world, the door has it too', () => {
  const addon = world('true');
  addon.lua('GAME.north, GAME.west = -4921.5, -953.25');
  enter(addon);
  assert.deepEqual(logout(addon).sessions[0].e, [['door', 0, 3065, 1455, 0.3012, 0.62, 0, -4921.5, -953.25]]);
});

test('each run of the interface is a session of its own, and a run with nothing to say leaves none', () => {
  const addon = world('true');
  enter(addon);
  const first = logout(addon).sessions;
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD'); // inside, after the /reload: no door
  addon.run(3);
  assert.deepEqual(logout(addon).sessions, first);
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  leave(addon);
  enter(addon);
  const both = logout(addon).sessions;
  assert.equal(both.length, 2);
  assert.deepEqual(both[0], first[0]);
  assert.notEqual(both[1].id, first[0].id);
});

test('a no lets go of what was held and of what was saved', () => {
  const addon = world('true');
  enter(addon);
  logout(addon);
  addon.reload();
  addon.fire('PLAYER_LOGIN');
  leave(addon);
  enter(addon);
  addon.lua('local ns = ...; ns.db.inbox.parts.log = nil; ns.receivers.log(nil)');
  const { file, sessions } = logout(addon);
  assert.equal(sessions.length, 0);
  assert.doesNotMatch(file, /\["log"\] = \{|door/);
});

test('anything that is not a number keeps an entry out', () => {
  const addon = world('true');
  addon.lua('local ns = ...; ns.Log("npc", 1, "Someone"); ns.Log("npc", 1, {}); ns.Log("npc", 0/0); ns.Log("npc", 1e12); ns.Log("npc", 7, -2.5, 1/3)');
  assert.deepEqual(logout(addon).sessions[0].e, [['npc', 0, 7, -2.5, 0.3333]]);
});

test('the oldest sessions go past ten, and past 200,000 bytes', () => {
  const addon = world('true');
  for (let i = 0; i < 12; i++) {
    addon.lua(`(...).Log("n", ${i})`);
    addon.fire('PLAYER_LOGOUT');
    addon.reload();
    addon.fire('PLAYER_LOGIN');
  }
  assert.deepEqual(logout(addon).sessions.map((s) => s.e[0][2]), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // Sessions of 84,000 bytes: two fit, the third pushes the first out. One session alone stops short of the whole room.
  for (let i = 0; i < 3; i++) {
    addon.lua('local ns = ...; for i = 1, 4000 do ns.Log("n", 123456.7891) end');
    addon.fire('PLAYER_LOGOUT');
    addon.reload();
    addon.fire('PLAYER_LOGIN');
  }
  const { texts } = logout(addon);
  assert.equal(texts.length, 2);
  addon.lua('local ns = ...; for i = 1, 20000 do ns.Log("n", 123456.7891) end');
  const all = logout(addon).texts;
  assert.equal(all.length, 1);
  assert.ok(all[0].length <= 200000 && all[0].length > 190000, String(all[0].length));
});
