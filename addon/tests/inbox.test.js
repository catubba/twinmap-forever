// The way back, end to end: the app's own code writes the fonts and the slots into a folder, and the
// addon reads them in the stand-in client.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadAddon } = require('./client');

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
  addon.lua(`TwinmapForeverDB = { inbox = { seq = ${seq}, parts = {} } }`);
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
