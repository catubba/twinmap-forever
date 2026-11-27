// Brings the hand-painted map art of OpenMap (MIT, "OpenMap contributors") into the app, for the parchment
// (main/parchment.ts): its fills of the land no zone map covers (Data/Forever/GapFills.lua, MapGapFill) and its
// continent maps with the sea lettering taken off (Data/Forever/ArtEdits.lua, MapArt). Each picture is put together
// from its tiles and kept as resources/openmap/<name>.bin: width and height (2 bytes each), channels (1 byte), then
// the rows top down, each but the first as its difference from the row above, deflated. Where a fill is clear its
// colour is zeroed: it is never shown, and the file is half the size. fills.json says where each fill lies, in
// fractions of the world map (947), as OpenMap places it.
//   node scripts/import-openmap.js "<game>\_forever_\Interface\AddOns\OpenMap"
// Run it again when OpenMap ships new fills, and commit the result.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const from = process.argv[2];
if (!from || !fs.existsSync(path.join(from, 'Data', 'Forever', 'GapFills.lua'))) {
  console.error('Give the folder of OpenMap: the one with Data and Media in it.');
  process.exit(1);
}
const TEX = path.join(from, 'Media', 'Textures', 'Forever');
const OUT = path.join(__dirname, '..', 'resources', 'openmap');
const version = /^## Version:\s*(\S+)/m.exec(fs.readFileSync(path.join(from, 'OpenMap.toc'), 'utf8'))?.[1] ?? 'unknown';
// The two continents: 1415 the Eastern Kingdoms, 1414 Kalimdor.
const CONTINENTS = [1415, 1414];

// A TGA as OpenMap keeps them: true colour, plain (2) or run-length (10), 24 or 32 bits, rows bottom up unless told.
function tga(file) {
  const b = fs.readFileSync(file), type = b[2], width = b.readUInt16LE(12), height = b.readUInt16LE(14), bytes = b[16] / 8, topDown = (b[17] & 0x20) !== 0;
  if ((type !== 2 && type !== 10) || (bytes !== 3 && bytes !== 4)) throw new Error(`${file}: a TGA of type ${type}, ${b[16]} bits`);
  const raw = Buffer.alloc(width * height * bytes);
  let at = 18 + b[0], o = 0;
  if (type === 2) b.copy(raw, 0, at, at + raw.length);
  else
    while (o < raw.length) {
      const c = b[at++], n = (c & 0x7f) + 1;
      if (c & 0x80) {
        for (let k = 0; k < n; k++) b.copy(raw, o + k * bytes, at, at + bytes);
        at += bytes;
      } else {
        b.copy(raw, o, at, at + n * bytes);
        at += n * bytes;
      }
      o += n * bytes;
    }
  // BGR(A) to RGB(A), top down.
  const channels = bytes, px = Buffer.alloc(raw.length);
  for (let y = 0; y < height; y++) {
    const s = (topDown ? y : height - 1 - y) * width * bytes, d = y * width * channels;
    for (let x = 0; x < width; x++) {
      px[d + x * channels] = raw[s + x * bytes + 2];
      px[d + x * channels + 1] = raw[s + x * bytes + 1];
      px[d + x * channels + 2] = raw[s + x * bytes];
      if (channels === 4) px[d + x * channels + 3] = raw[s + x * bytes + 3];
    }
  }
  return { width, height, channels, px };
}

// A picture from its tiles of 256 (by rows, from 1), `cols` to a row; the tiles not listed are clear.
function picture(prefix, width, height, channels, cols, list) {
  const px = Buffer.alloc(width * height * channels);
  for (const i of list) {
    const t = tga(`${prefix}_${i}.tga`), col = (i - 1) % cols, row = Math.floor((i - 1) / cols);
    if (t.channels !== channels) throw new Error(`${prefix}_${i}: ${t.channels} channels, not ${channels}`);
    for (let y = 0; y < t.height && row * 256 + y < height; y++) {
      const w = Math.min(t.width, width - col * 256);
      t.px.copy(px, ((row * 256 + y) * width + col * 256) * channels, y * t.width * channels, (y * t.width + w) * channels);
    }
  }
  return px;
}

function keep(name, width, height, channels, px) {
  if (channels === 4) for (let i = 0; i < px.length; i += 4) if (!px[i + 3]) px[i] = px[i + 1] = px[i + 2] = 0;
  const row = width * channels, rows = Buffer.from(px);
  for (let y = height - 1; y > 0; y--) for (let x = 0; x < row; x++) rows[y * row + x] = (px[y * row + x] - px[(y - 1) * row + x]) & 255;
  const head = Buffer.alloc(5);
  head.writeUInt16LE(width, 0);
  head.writeUInt16LE(height, 2);
  head[4] = channels;
  const bytes = Buffer.concat([head, zlib.deflateSync(rows, { level: 9 })]);
  fs.writeFileSync(path.join(OUT, `${name}.bin`), bytes);
  return bytes.length;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let size = 0;
// { "G01", { left, top, right, bottom }, width, height, cols, { tiles } },   -- its name
const lua = fs.readFileSync(path.join(from, 'Data', 'Forever', 'GapFills.lua'), 'utf8');
const fills = [...lua.matchAll(/\{\s*"(G\d+)",\s*\{([^}]*)\},\s*(\d+),\s*(\d+),\s*(\d+),\s*\{([^}]*)\}\s*\},?\s*--\s*(\S+)/g)].map((m) => {
  const [, name, box, width, height, cols, list, what] = m;
  size += keep(name, +width, +height, 4, picture(path.join(TEX, 'MapGapFill', name), +width, +height, 4, +cols, list.split(',').map(Number)));
  return { name, what, box: box.split(',').map(Number), width: +width, height: +height };
});
if (!fills.length) throw new Error('no fills read in GapFills.lua');
const edits = fs.readFileSync(path.join(from, 'Data', 'Forever', 'ArtEdits.lua'), 'utf8');
for (const id of CONTINENTS) {
  const list = new RegExp(`\\[${id}\\]\\s*=\\s*\\{([^}]*)\\}`).exec(edits)?.[1].split(',').map(Number) ?? [];
  if (list.length !== 12) throw new Error(`ArtEdits has ${list.length} tiles of ${id}, not 12`);
  size += keep(String(id), 1002, 668, 3, picture(path.join(TEX, 'MapArt', String(id)), 1002, 668, 3, 4, list));
}
fs.writeFileSync(path.join(OUT, 'fills.json'), JSON.stringify({ openmap: version, continents: CONTINENTS, fills }, null, 1) + '\n');
console.log(`OpenMap ${version}: ${fills.length} fills and ${CONTINENTS.length} continents, ${(size / 1e6).toFixed(1)} MB in ${OUT}`);
