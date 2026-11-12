// The way back, end to end: the app's own code writes the fonts and the slots into a folder, and the
// addon reads them in the stand-in client.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadAddon } = require('./client');
const { decodeStrip } = require('./decode');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const SIGNAL = 'TwinmapForever_Signal';

// One game folder with the channel installed, for all the tests: the bank takes seconds to make.
let app, addons; // app/src/main/signal.ts: Node runs it as it is
before(async () => {
  app = await import('../../app/src/main/signal.ts');
  addons = fs.mkdtempSync(path.join(os.tmpdir(), 'twinmap-inbox-'));
  assert.equal(await app.installChannel(addons), true);
});

after(() => fs.rmSync(addons, { recursive: true, force: true }));

// A new run of the game on that folder, with nothing sent yet as far as app and addon know, and the
// addon in the world with one receiver per part named: what each was told, in order, is in GOT.
function world(...parts) {
  const outbox = path.join(addons, SIGNAL, 'outbox.json');
  const seq = fs.existsSync(outbox) ? JSON.parse(fs.readFileSync(outbox, 'utf8')).seq : 0;
  fs.writeFileSync(outbox, JSON.stringify({ seq, parts: {} }));
  const addon = loadAddon(DIR, { addons });
  addon.lua(`TwinmapForeverDB.inbox = { seq = ${seq}, parts = {} }`);
  const enter = () => {
    addon.lua(`local ns = ...; GOT = GOT or {}
      for name in ("${parts.join(' ')}"):gmatch("%S+") do ns.receivers[name] = function(v) GOT[#GOT + 1] = name .. "=" .. tostring(type(v) == "table" and v.name or v) end end`);
    addon.fire('PLAYER_LOGIN');
    addon.fire('PLAYER_ENTERING_WORLD');
  };
  enter();
  const got = () => (addon.lua('local out = table.concat(GOT, " "); GOT = {}; return out') || '').split(' ').filter(Boolean);
  return { addon, enter, got };
}
const part = (addon, code) => addon.lua(`local parts = (...).db.inbox.parts; return ${code}`);

test('small news arrives in the font within seconds, once, and spends no slot', () => {
  const { addon, got } = world('pin');
  addon.run(12);
  assert.deepEqual(got(), ['pin=nil'], 'told at login what there is: nothing');
  assert.equal(app.send(addons, { pin: { name: 'Inn', m: 1429, x: 43.7, y: 65.8 } }).inFont, true);
  addon.run(7);
  assert.deepEqual(got(), ['pin=Inn']);
  assert.equal(part(addon, 'parts.pin.x + parts.pin.m'), '1472.7');
  addon.run(20);
  assert.deepEqual(got(), [], 'told twice');
  assert.equal(addon.slots(), 0);
  assert.equal(addon.ns('signal'), 'reading');
});

test('in combat nothing is read; it arrives right after', () => {
  const { addon, got } = world('pin');
  addon.run(6);
  got();
  addon.lua('GAME.combat = true');
  app.send(addons, { pin: { name: 'After' } });
  addon.run(12);
  assert.deepEqual(got(), []);
  addon.lua('GAME.combat = false');
  addon.run(7);
  assert.deepEqual(got(), ['pin=After']);
  assert.equal(addon.slots(), 0);
});

test('news too big for a font comes through a slot, whole', () => {
  const { addon, got } = world('route');
  addon.run(6);
  got();
  const stops = Array.from({ length: 60 }, (_, i) => ({ m: 1429, x: i, y: i, label: 'Stop number ' + i }));
  const sent = app.send(addons, { route: { name: 'Big', stops } });
  assert.equal(sent.inFont, false);
  assert.ok(sent.bytes > app.CAPACITY);
  addon.run(7);
  assert.deepEqual(got(), ['route=Big']);
  assert.equal(addon.slots(), 1);
  assert.equal(part(addon, '#parts.route.stops .. parts.route.stops[60].label'), '60Stop number 59');
});

test('two sends before one read: the font has only the second, so a slot brings both', () => {
  const { addon, got } = world('pin', 'route');
  addon.run(6);
  got();
  app.send(addons, { pin: { name: 'First' } });
  app.send(addons, { route: { name: 'Second' } });
  addon.run(7);
  assert.deepEqual(got().sort(), ['pin=First', 'route=Second']);
  assert.equal(addon.slots(), 1);
});

test('taking a part away rides the font too, and the others stay', () => {
  const { addon, got } = world('pin', 'route');
  addon.run(6);
  app.send(addons, { pin: { name: 'Here' } });
  addon.run(6);
  app.send(addons, { route: { name: 'Round' } });
  addon.run(6);
  got();
  assert.equal(app.send(addons, { pin: false }).inFont, true);
  addon.run(6);
  assert.deepEqual(got(), ['pin=nil']);
  assert.equal(part(addon, 'parts.route.name'), 'Round');
  assert.equal(addon.slots(), 0);
});

test('a font whose data does not add up (a read in the middle of a write) is no data: a slot has the news', () => {
  const { addon, got } = world('pin');
  addon.run(6);
  got();
  app.send(addons, { pin: { name: 'Whole' } });
  for (let b = 0; b < 8; b++) {
    const file = path.join(addons, SIGNAL, app.nameOf(b * 1023));
    const font = fs.readFileSync(file), at = app.hmtx(font)[0] + 16 + 4 * 10; // one data letter, far off
    font.writeUInt16BE(font.readUInt16BE(at) ^ 0x800, at);
    const fd = fs.openSync(file, 'r+');
    fs.writeSync(fd, font);
    fs.closeSync(fd);
  }
  addon.run(7);
  assert.deepEqual(got(), ['pin=Whole']);
  assert.equal(addon.slots(), 1);
});

test('text stays text whatever it holds, in a slot and in a font', () => {
  const { addon } = world();
  const name = 'a"} os.exit() --\\ |n \n è]]';
  app.send(addons, { pin: { name }, big: 'x'.repeat(1100) });
  addon.run(7);
  assert.equal(addon.slots(), 1);
  assert.equal(part(addon, 'parts.pin.name'), name);
  assert.equal(part(addon, '#parts.big'), '1100');
  assert.equal(app.send(addons, { pin: { name: name + '!' } }).inFont, true);
  addon.run(7);
  assert.equal(addon.slots(), 1);
  assert.equal(part(addon, 'parts.pin.name'), name + '!');
});

test('after a /reload the news is still there, reading goes on from the next name and no slot is spent', () => {
  const { addon, enter, got } = world('pin');
  app.send(addons, { pin: { name: 'Kept' } });
  addon.run(7);
  got();
  const at = Number(addon.lua('return (...).db.signalPos'));
  addon.reload();
  enter();
  assert.deepEqual(got(), ['pin=Kept'], 'told again at login');
  addon.run(12);
  assert.ok(Number(addon.lua('return (...).db.signalPos')) > at, 'not reading');
  assert.deepEqual(got(), []);
  assert.equal(addon.slots(), 0);
});

test('when the slots are used up it says so once, and a /reload brings what was missed', () => {
  const { addon, enter, got } = world('big');
  addon.run(6);
  for (let i = 1; i <= 31; i++) {
    app.send(addons, { big: { name: 'n' + i, fill: 'x'.repeat(1100) } });
    addon.run(6);
  }
  assert.equal(addon.slots(), 30);
  assert.equal(got().at(-1), 'big=n30');
  assert.equal(addon.printed(), 'Twinmap Forever: type /reload to go on receiving from Twinmap.');
  addon.run(30);
  assert.equal(addon.printed().split('\n').length, 1, 'said more than once');
  addon.reload();
  enter();
  addon.run(7);
  assert.equal(got().at(-1), 'big=n31');
  assert.equal(addon.slots(), 1);
});

test('slots that cannot be loaded: it says so, and the news comes once they can', () => {
  const { addon, enter, got } = world('pin');
  addon.run(6);
  got();
  addon.lua('GAME.slotsOff = true');
  app.send(addons, { pin: { name: 'One' } });
  app.send(addons, { pin: { name: 'Two' } });
  addon.run(12);
  assert.deepEqual(got(), []);
  assert.match(addon.printed(), /cannot be loaded/);
  addon.lua('GAME.slotsOff = nil');
  addon.reload();
  enter();
  addon.run(7);
  assert.deepEqual(got(), ['pin=nil', 'pin=Two']);
});

// Send to game, whole: the arrow of ours follows the pin the app sends, and the strip tells the app it arrived.
const told = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'inbox').map((b) => JSON.parse(b.text));
// The point the arrow follows: its map and its place on it, 0 to 1. The game's own map pin is never set.
const waypoint = (addon) => {
  assert.equal(addon.lua('return WAYPOINT ~= nil or TRACKED ~= nil'), 'false', 'the game\'s own pin is left alone');
  return addon.lua('local t = (...).Target(); return t and (t.m .. " " .. t.x .. " " .. t.y .. " true")');
};

test('a pin sent from the app is followed by the arrow, and the strip says which send arrived', () => {
  const { addon } = world();
  addon.lua('(...).db.mode = "fast"');
  addon.run(8);
  const before = told(addon).at(-1);
  assert.equal(before.left, 30);
  assert.equal(before.off, undefined);
  const { seq } = app.send(addons, { pin: { m: 1429, x: 43.71, y: 65.8, name: 'Lion\'s Pride Inn', t: 1001 } });
  assert.equal(seq, before.seq % 60 + 1);
  addon.run(8);
  assert.equal(waypoint(addon), '1429 0.4371 0.658 true');
  assert.equal(addon.printed(), 'Twinmap Forever: Lion\'s Pride Inn is followed: the arrow points to it.');
  assert.deepEqual(told(addon).at(-1), { seq, left: 30 });
});

test('a pin the player let go does not come back at the next login, and a new one does', () => {
  const { addon, enter } = world();
  app.send(addons, { pin: { m: 1429, x: 10, y: 20, name: 'Old', t: 1 } });
  addon.run(7);
  addon.lua('(...).Forget()');
  addon.reload();
  enter();
  addon.run(7);
  assert.equal(waypoint(addon), null);
  app.send(addons, { pin: { m: 1429, x: 30, y: 40, name: 'New', t: 2 } });
  addon.run(7);
  assert.equal(waypoint(addon), '1429 0.3 0.4 true');
});

test('a point on a map the game tells no place of is followed with no direction; a pin that is not one is left alone', () => {
  const { addon } = world();
  addon.lua('GAME.noWorld, GAME.north, GAME.west = 1455, 0, 0');
  app.send(addons, { pin: { m: 1455, x: 50, y: 50, name: 'The Great Forge', t: 3 } });
  addon.run(7);
  assert.equal(waypoint(addon), '1455 0.5 0.5 true');
  assert.equal(addon.arrow(), 'The Great Forge | no direction from here | no tip');
  addon.lua('(...).Forget()');
  app.send(addons, { pin: { m: 1429, x: 500, y: 'north', t: 4 } });
  addon.run(7);
  assert.equal(waypoint(addon), null);
});

// The route in the game: the arrow follows the next stop, and reaching it, skipping it and the end of the route all tell the app.
const onStrip = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'route').map((b) => JSON.parse(b.text)).at(-1);
const threeStops = (t) => ({ t, at: 1, stops: [
  { m: 1432, x: 40, y: 50, rx: 0.5, ry: 0.75, name: 'First' },
  { m: 1432, x: 60, y: 50, rx: 0.5, ry: 0.75, name: 'Second' },
  { m: 1429, x: 20, y: 20, rx: 0.4, ry: 0.6, name: 'Third' },
] });
function onRoute(t) {
  const { addon, enter } = world();
  addon.lua('(...).db.mode = "fast"; GAME.map, GAME.x, GAME.y = 1432, 0.30, 0.50');
  app.send(addons, { route: threeStops(t) });
  addon.run(8);
  return { addon, enter };
}

test('a route sent from the app marks its first stop, and arriving moves the pin to the next', () => {
  const { addon } = onRoute(11);
  assert.equal(waypoint(addon), '1432 0.4 0.5 true');
  assert.equal(addon.printed(), 'Twinmap Forever: stop 1 of 3, First.');
  assert.deepEqual(onStrip(addon), { t: 11, at: 1, of: 3 });
  addon.lua('GAME.x = 0.39'); // one percent away, the stop is half a percent wide
  addon.run(2);
  assert.deepEqual(onStrip(addon), { t: 11, at: 1, of: 3 }, 'arrived from too far');
  addon.lua('GAME.x, GAME.y = 0.397, 0.505');
  addon.run(2);
  assert.equal(waypoint(addon), '1432 0.6 0.5 true');
  assert.deepEqual(onStrip(addon), { t: 11, at: 2, of: 3 });
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: stop 2 of 3, Second.');
  // On another map the place tells nothing of a stop of this one.
  addon.lua('GAME.map, GAME.x, GAME.y = 1429, 0.6, 0.5');
  addon.run(2);
  assert.deepEqual(onStrip(addon), { t: 11, at: 2, of: 3 });
});

test('a stop is skipped from the game and from the app, only forwards', () => {
  const { addon } = onRoute(12);
  addon.slash('/twinmap skip');
  addon.run(2);
  assert.deepEqual(onStrip(addon), { t: 12, at: 2, of: 3 });
  app.send(addons, { step: { t: 12, at: 3 } });
  addon.run(8);
  assert.equal(waypoint(addon), '1429 0.2 0.2 true');
  assert.deepEqual(onStrip(addon), { t: 12, at: 3, of: 3 });
  app.send(addons, { step: { t: 12, at: 1 } });
  app.send(addons, { step: { t: 99, at: 3 } });
  addon.run(8);
  assert.deepEqual(onStrip(addon), { t: 12, at: 3, of: 3 }, 'went back, or took a step of another route');
});

test('past the last stop the route is complete: the pin goes, the strip says so, and there is nothing left to skip', () => {
  const { addon } = onRoute(13);
  addon.slash('/twinmap skip');
  addon.slash('/twinmap skip');
  addon.lua('GAME.map, GAME.x, GAME.y = 1429, 0.2, 0.2');
  addon.run(2);
  assert.equal(waypoint(addon), null);
  assert.deepEqual(onStrip(addon), { t: 13, at: 4, of: 3 });
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: route complete.');
  addon.slash('/twinmap skip');
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: no route to skip on.');
});

test('a /reload keeps the place on the route, a new route starts where the app says, and one taken away clears the pin', () => {
  const { addon, enter } = onRoute(14);
  addon.slash('/twinmap skip');
  addon.reload();
  enter();
  addon.lua('(...).db.mode = "fast"');
  addon.run(8);
  assert.deepEqual(onStrip(addon), { t: 14, at: 2, of: 3 });
  assert.equal(waypoint(addon), '1432 0.6 0.5 true');
  app.send(addons, { route: { ...threeStops(15), at: 3 } });
  addon.run(8);
  assert.deepEqual(onStrip(addon), { t: 15, at: 3, of: 3 });
  app.send(addons, { route: false });
  addon.run(8);
  assert.equal(waypoint(addon), null);
  addon.slash('/twinmap skip');
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: no route to skip on.');
  // A route that is not one is no route.
  app.send(addons, { route: { t: 16, stops: [{ m: 1432, x: 'east' }] } });
  addon.run(8);
  assert.equal(waypoint(addon), null);
});

test('an app just opened asks for everything, and has it within seconds though nothing changed', () => {
  const { addon, enter } = world();
  addon.lua('(...).db.mode = "fast"; GAME.level, GAME.xp, GAME.xpMax, GAME.faction = 13, 8400, 13600, "Alliance"');
  addon.run(12);
  const sections = (from) => [...new Set(addon.strips().slice(from).map(decodeStrip).map((b) => b.section))].sort();
  let mark = addon.strips().length;
  addon.run(8);
  assert.deepEqual(sections(mark), ['pos'], 'unchanged sections went out again unasked');
  mark = addon.strips().length;
  assert.equal(app.send(addons, { sync: 1731350000000 }).inFont, true);
  addon.run(8);
  assert.deepEqual(sections(mark), ['char', 'inbox', 'pos']);
  assert.equal(addon.slots(), 0);
  // The same number again, at a login, asks for nothing more than a login sends anyway.
  addon.reload();
  enter();
  assert.equal(addon.lua('return string.format("%.0f", (...).db.syncSeen)'), '1731350000000');
});

test('the strip tells the app why nothing can arrive, and how many slots are left', () => {
  const { addon } = world();
  addon.lua('(...).db.mode = "fast"');
  addon.run(6);
  app.send(addons, { big: 'x'.repeat(1100) });
  addon.run(8);
  assert.equal(told(addon).at(-1).left, 29);
  const bare = loadAddon(DIR);
  bare.fire('PLAYER_LOGIN');
  bare.lua('(...).db.mode = "fast"');
  bare.fire('PLAYER_ENTERING_WORLD');
  bare.run(20);
  assert.deepEqual(told(bare), [], 'said before it knew');
  bare.run(20);
  assert.deepEqual(told(bare).at(-1), { seq: 0, left: 30, off: 'fonts not readable' });
});

test('with no bank to read (the addon without the app) it gives up quietly, and /twinmap tells', () => {
  const addon = loadAddon(DIR);
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  addon.run(60);
  assert.equal(addon.printed(), '');
  assert.equal(addon.ns('signal'), 'fonts not readable');
  addon.slash('/twinmap');
  assert.match(addon.printed(), /Nothing can arrive from Twinmap in this session \(fonts not readable\)/);
});

test('the addon and the app agree on the numbers of the channel', () => {
  const lua = fs.readFileSync(path.join(DIR, 'Inbox.lua'), 'utf8');
  const ts = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'src', 'main', 'signal.ts'), 'utf8');
  assert.ok(lua.includes(`local SLOTS = ${app.SLOTS} `) && lua.includes(`local BANK = ${app.BANK} `));
  assert.ok(lua.includes('local EM, A_BASE, A_STEP = 1000, 100, 50') && ts.includes('const EM = 1000, A_BASE = 100, A_STEP = 50'));
  assert.ok(lua.includes('local B_WIDTH, C_WIDTH = 1000, 500') && ts.includes('const B_WIDTH = 1000, C_WIDTH = 500'));
  assert.ok(lua.includes('DATA_FIRST, DATA_LETTERS = 0xE000, 1024') && ts.includes('DATA_FIRST = 0xe000') && ts.includes('DATA_LETTERS = 1024'));
  assert.ok(lua.includes(`AddOns\\\\${SIGNAL}\\\\`) && ts.includes(`'${SIGNAL}'`));
});

// My pins, whole: every point saved in the app is a flag of ours on the game's world map, and one
// removed on either side goes on the other.
const INN = { m: 1429, x: 43.71, y: 65.8, name: 'Inn' }, MINE = { m: 1429, x: 10, y: 20, name: 'Mine' };
const marksTold = (addon) => addon.strips().map(decodeStrip).filter((b) => b.section === 'marks').map((b) => JSON.parse(b.text)).at(-1);

test('the pins saved in the app are flags on the game\'s map, each on its point; one taken away goes, the rest stay through a /reload', () => {
  const { addon, enter } = world();
  addon.lua('GAME.mapOpen, GAME.shown = true, 1429');
  addon.run(8);
  assert.equal(addon.flags(), '');
  const sent = app.send(addons, { mark1429x4371y6580: INN, mark1429x1000y2000: MINE, mark1433x5000y5000: { m: 1433, x: 50, y: 50, name: 'Elsewhere' } });
  assert.equal(sent.inFont, true);
  addon.run(8);
  assert.equal(addon.flags(), 'Inn 437 395; Mine 100 120', 'on a canvas 1000 by 600; the one of another map is not on this one');
  assert.equal(part(addon, 'parts.pin'), null, 'the game\'s own pin is not touched');

  app.send(addons, { mark1429x1000y2000: false });
  addon.run(8);
  assert.equal(addon.flags(), 'Inn 437 395');

  addon.reload();
  enter();
  assert.equal(addon.flags(), 'Inn 437 395');
  addon.lua('GAME.mapOpen = false');
  app.send(addons, { mark1429x1000y2000: MINE });
  addon.run(8);
  assert.equal(addon.flags(), '', 'with the map closed nothing is drawn');
});

test('Alt and a right click removes a flag: the strip tells the app, until the app takes the pin away itself', () => {
  const { addon } = world();
  addon.lua('(...).db.mode = "fast"; GAME.mapOpen, GAME.shown = true, 1429');
  app.send(addons, { mark1429x4371y6580: INN, mark1429x1000y2000: MINE });
  addon.run(8);
  assert.deepEqual(marksTold(addon), { gone: [], new: [] });

  addon.flagClick('Inn', 'RightButton');
  assert.equal(addon.flags(), 'Inn 437 395; Mine 100 120', 'a right click alone is the map\'s own');
  addon.lua('GAME.alt = true');
  addon.flagClick('Inn', 'LeftButton');
  assert.equal(addon.flags(), 'Inn 437 395; Mine 100 120');
  addon.flagClick('Inn', 'RightButton');
  assert.equal(addon.flags(), 'Mine 100 120');
  assert.equal(addon.printed(), 'Twinmap Forever: Inn is no longer among your pins.');
  addon.run(3);
  assert.deepEqual(marksTold(addon), { gone: ['mark1429x4371y6580'], new: [] });

  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  assert.equal(addon.flags(), 'Mine 100 120', 'removed stays removed while the app has not heard');

  app.send(addons, { mark1429x4371y6580: false });
  addon.run(8);
  assert.deepEqual(marksTold(addon), { gone: [], new: [] });
  app.send(addons, { mark1429x4371y6580: INN });
  addon.run(8);
  assert.equal(addon.flags(), 'Inn 437 395; Mine 100 120', 'saved again in the app, it is back');
});

test('more pins than a font holds come by a slot, and one taken away in a send that was missed goes all the same', () => {
  const { addon } = world();
  addon.lua('GAME.mapOpen, GAME.shown = true, 1429');
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`mark1429x${1000 + i * 100}y5000`, { m: 1429, x: 10 + i, y: 50, name: `Pin number ${String(i).padStart(2, '0')}` }]));
  assert.equal(app.send(addons, many).inFont, false);
  addon.run(8);
  assert.equal(addon.flags().split('; ').length, 40);
  assert.equal(addon.slots(), 1);

  app.send(addons, { mark1429x1000y5000: false });
  app.send(addons, { mark1429x1100y5000: false });
  addon.run(8);
  assert.equal(addon.slots(), 2);
  assert.equal(addon.flags().split('; ').length, 38);
  assert.ok(!addon.flags().includes('Pin number 00') && !addon.flags().includes('Pin number 01'));
});

test('Alt and a click on the game\'s map sets a flag there: the strip tells the app, and once the app has taken it the pin is the app\'s own', () => {
  const { addon } = world();
  addon.lua('(...).db.mode = "fast"; GAME.mapOpen, GAME.shown = true, 1429');
  addon.run(8);
  assert.equal(addon.mapClick('LeftButton', 0.25, 0.5), false, 'a click alone is the map\'s own');
  addon.lua('GAME.alt = true');
  assert.equal(addon.mapClick('RightButton', 0.25, 0.5), false);
  assert.equal(addon.flags(), '');
  assert.equal(addon.mapClick('LeftButton', 0.25, 0.5), true);
  assert.equal(addon.flags(), 'Elwynn Forest 25.0, 50.0 250 300');
  assert.equal(addon.printed(), 'Twinmap Forever: Elwynn Forest 25.0, 50.0 is among your pins.');
  addon.run(3);
  const set = { id: '1429x2500y5000', m: 1429, x: 25, y: 50, name: 'Elwynn Forest 25.0, 50.0' };
  assert.deepEqual(marksTold(addon), { gone: [], new: [set] });

  addon.reload();
  addon.fire('PLAYER_LOGIN');
  addon.fire('PLAYER_ENTERING_WORLD');
  assert.equal(addon.flags(), 'Elwynn Forest 25.0, 50.0 250 300', 'kept while the app has not taken it');

  // A second one, removed here before the app ever heard of it.
  assert.equal(addon.mapClick('LeftButton', 0.6, 0.1), true);
  assert.equal(addon.flags(), 'Elwynn Forest 25.0, 50.0 250 300; Elwynn Forest 60.0, 10.0 600 60');
  addon.flagClick('Elwynn Forest 60.0, 10.0', 'RightButton');
  assert.equal(addon.flags(), 'Elwynn Forest 25.0, 50.0 250 300');

  app.send(addons, { mark1429x2500y5000: { m: 1429, x: 25, y: 50, name: 'Elwynn Forest 25.0, 50.0' }, taken: ['1429x2500y5000'] });
  addon.lua('(...).db.mode = "fast"');
  addon.run(8);
  assert.equal(addon.flags(), 'Elwynn Forest 25.0, 50.0 250 300', 'one flag, not two');
  assert.deepEqual(marksTold(addon), { gone: [], new: [] });
});

test('no more than twenty pins set in the game wait for the app', () => {
  const { addon } = world();
  addon.lua('GAME.mapOpen, GAME.shown, GAME.alt = true, 1429, true');
  addon.run(8);
  for (let i = 0; i < 21; i++) assert.equal(addon.mapClick('LeftButton', 0.1 + i * 0.01, 0.5), true);
  assert.equal(addon.flags().split('; ').length, 20);
  assert.match(addon.printed().split('\n').at(-1), /open Twinmap before setting more pins/);
});

// The arrow of ours: where it points, how far it says, and when it goes.
// The stand-in world: Elwynn (1429) is 2000 yards a side around the middle of the world; the character at its middle.
test('the arrow turns to the point followed and tells how far; arriving ends it, and so does a right click on it', () => {
  const { addon, enter } = world();
  addon.lua('GAME.north, GAME.west, GAME.facing = 0, 0, 0'); // at the middle of Elwynn, facing north
  assert.equal(addon.arrow(), null);
  app.send(addons, { pin: { m: 1429, x: 50, y: 25, name: 'North Gate', t: 21 } });
  addon.run(8);
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 0 26', 'straight ahead: the tip is up');
  addon.lua('GAME.facing = math.pi / 2'); // now facing west: the point is to the right
  addon.run(1);
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 26 0');
  addon.lua('GAME.north, GAME.facing = 250, math.pi'); // closer, and with the back to it
  addon.run(1);
  assert.equal(addon.arrow(), 'North Gate | 250 yd | 0 -26');

  addon.reload();
  enter();
  addon.run(1);
  assert.equal(addon.arrow(), 'North Gate | 250 yd | 0 -26', 'followed again after a /reload');

  addon.lua('GAME.north = 490'); // ten yards from it
  addon.run(1);
  assert.equal(addon.arrow(), null);
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: you are at North Gate.');
  addon.reload();
  enter();
  addon.run(8);
  assert.equal(addon.arrow(), null, 'a point reached does not come back');

  app.send(addons, { pin: { m: 1429, x: 50, y: 25, name: 'North Gate', t: 22 } });
  addon.lua('GAME.north = 0');
  addon.run(8);
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 0 -26');
  addon.arrowClick('LeftButton');
  assert.equal(addon.arrow(), 'North Gate | 500 yd | 0 -26');
  addon.arrowClick('RightButton');
  addon.run(1);
  assert.equal(addon.arrow(), null);
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: North Gate is no longer followed.');
});

test('with a route the arrow follows its next stop, and a right click on it does not end the route', () => {
  const { addon } = onRoute(31);
  addon.lua('GAME.north, GAME.west, GAME.facing = 15000, 0, 0'); // the middle of Loch Modan (1432) in the stand-in world
  addon.run(1);
  assert.equal(addon.arrow(), 'First | 200 yd | -26 0', 'the first stop is at 40, 50: 200 yards west, to the left of one who faces north');
  addon.arrowClick('RightButton');
  addon.run(1);
  assert.equal(addon.arrow(), 'First | 200 yd | -26 0');
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: the arrow follows the route: /twinmap skip moves on.');
  addon.slash('/twinmap skip');
  addon.run(1);
  assert.equal(addon.arrow(), 'Second | 200 yd | 26 0');
  addon.slash('/twinmap skip');
  addon.run(1);
  assert.equal(addon.arrow(), 'Third | 14412 yd | -1 -26', 'the third stop is in Elwynn, far to the south: behind one who faces north');
});

test('a click on a flag of the map has the arrow follow it, in gold; another click lets it go; the flags near are on the minimap', () => {
  const { addon } = world();
  addon.lua('GAME.mapOpen, GAME.shown, GAME.north, GAME.west, GAME.facing, GAME.miniRadius = true, 1429, 0, 0, 0, 200');
  addon.lua('Minimap = CreateFrame("Frame"); function Minimap:GetWidth() return 140 end; function Minimap:GetFrameLevel() return 1 end; function Minimap:GetZoom() return 0 end');
  app.send(addons, { mark1429x4371y6580: INN, mark1429x1000y2000: MINE });
  addon.run(8);
  assert.equal(addon.arrow(), null);
  // The inn is 316 yards south and 126 west: off a minimap that shows 200 yards around.
  assert.equal(addon.miniFlags(), '');
  addon.flagClick('Inn', 'LeftButton');
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: Inn is followed: the arrow points to it.');
  addon.run(1);
  assert.match(addon.arrow(), /^Inn \| 340 yd \| /);
  assert.equal(addon.flags(), 'Inn 437 395; Mine 100 120', 'no second flag for the point followed');

  addon.lua('GAME.north, GAME.west = -216, 125.8'); // a hundred yards north of the inn
  addon.run(1);
  assert.equal(addon.miniFlags(), 'Inn 0 -35', 'a hundred yards south on a minimap 140 wide that shows 200 around');
  addon.lua('GAME.cvars = { rotateMinimap = "1" }; GAME.facing = math.pi'); // the minimap turns: facing south, the inn is up
  addon.run(1);
  assert.equal(addon.miniFlags(), 'Inn 0 35');

  addon.flagClick('Inn', 'LeftButton');
  addon.run(1);
  assert.equal(addon.arrow(), null);
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: Inn is no longer followed.');
  assert.equal(addon.miniFlags(), 'Inn 0 35', 'the flag stays: only the arrow goes');
});

test('the strip tells the app which point is followed, and the app can ask to let it go', () => {
  const { addon, enter } = world();
  const followTold = () => addon.strips().map(decodeStrip).filter((b) => b.section === 'follow').map((b) => JSON.parse(b.text)).at(-1);
  addon.lua('(...).db.mode = "fast"; GAME.north, GAME.west, GAME.facing = 0, 0, 0');
  addon.run(8);
  assert.equal(followTold(), undefined, 'nothing was ever followed: nothing is told');
  app.send(addons, { pin: { m: 1429, x: 50, y: 25, name: 'North Gate', t: 41 } });
  addon.run(8);
  assert.deepEqual(followTold(), { m: 1429, x: 50, y: 25, name: 'North Gate' });

  app.send(addons, { unfollow: 7001 });
  addon.run(8);
  assert.equal(addon.arrow(), null);
  assert.equal(addon.printed().split('\n').at(-1), 'Twinmap Forever: North Gate is no longer followed.');
  assert.deepEqual(followTold(), [], 'told that there is none');

  // The same asking, told again at a login, lets go of nothing.
  app.send(addons, { pin: { m: 1429, x: 50, y: 75, name: 'South Gate', t: 42 } });
  addon.run(8);
  addon.reload();
  enter();
  addon.lua('(...).db.mode = "fast"');
  addon.run(8);
  assert.equal(addon.arrow(), 'South Gate | 500 yd | 0 -26');
  assert.deepEqual(followTold(), { m: 1429, x: 50, y: 75, name: 'South Gate' });
});
