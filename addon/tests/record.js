// Records strips the addon really draws, for the app's decoder tests: the two halves are tested
// against the same pixels. `npm run record` rewrites the file; fixture.test.js fails when it is stale.
const fs = require('node:fs');
const path = require('node:path');
const { loadAddon } = require('./client');

const DIR = path.join(__dirname, '..', 'TwinmapForever');
const FILE = path.join(__dirname, '..', '..', 'app', 'src', 'shared', 'strips.fixture.json');

function enterWorld(before, after) {
  const addon = loadAddon(DIR);
  if (before) addon.lua(before);
  addon.fire('PLAYER_LOGIN');
  if (after) addon.lua(after);
  addon.fire('PLAYER_ENTERING_WORLD');
  return addon;
}

// Each strip is a string of cells, one digit 0 to 7 (R*4 + G*2 + B) per pixel.
function record() {
  // Three positions in steady mode: every block, then its negative.
  const session = enterWorld();
  session.run(10);
  session.lua('GAME.x, GAME.facing = 0.5, 3.1416');
  session.run(3);
  session.lua('GAME.zone, GAME.sub, GAME.map, GAME.x, GAME.y = "Stormwind City", "Trade District", 1453, 0.612, 0.708');
  session.run(3);

  // A window so narrow that one position takes several blocks.
  const zone = 'Città di Roccavento è qui '.repeat(4);
  const narrow = enterWorld(`GAME.width, GAME.zone = 320, ${JSON.stringify(zone)}`, 'local ns = ...; ns.db.mode = "fast"');
  narrow.run(10);

  // The same addon, speaking a protocol the app does not know yet.
  const protocol2 = enterWorld(null, 'local ns = ...; ns.PROTOCOL = 2');
  protocol2.run(10);

  // Into a dungeon, around in it, to where the game stops telling the place, and out again.
  const instance = enterWorld(null, 'local ns = ...; ns.db.mode = "fast"');
  instance.run(10);
  instance.lua('GAME.instance = { name = "Deadmines", kind = "party", id = 36 }; GAME.zone, GAME.sub, GAME.map, GAME.x, GAME.north, GAME.west = "The Deadmines", "", nil, nil, -16.4, -383.1');
  instance.run(3);
  instance.lua('GAME.north, GAME.west = -64.2, -820.7');
  instance.run(3);
  instance.lua('GAME.north, GAME.west = nil, nil');
  instance.run(3);
  instance.lua('GAME.instance = nil; GAME.zone, GAME.sub, GAME.map, GAME.x = "Westfall", "Moonbrook", 1436, 0.423');
  instance.run(3);

  return { session: session.strips(), narrow: narrow.strips(), protocol2: protocol2.strips(), instance: instance.strips() };
}

module.exports = { record, FILE };

if (require.main === module) {
  fs.writeFileSync(FILE, JSON.stringify(record(), null, 1) + '\n');
  console.log('wrote ' + FILE);
}
