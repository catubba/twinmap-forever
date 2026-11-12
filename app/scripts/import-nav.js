// Brings the walking grid of Shortest Path Forever (cjber, GPL-3.0-or-later) into the app: the
// terrain of the two continents as its Nav/*.lua hold it, and which cells and edges are road, one
// JSON file a continent in resources/nav. Nothing is decoded here: the packed blocks are copied as
// they are, and the app reads them with the format told in the head of Nav/Nav0.lua.
//   node scripts/import-nav.js "<game>\_forever_\Interface\AddOns\ShortestPathForever"
// Run it again when Shortest Path Forever ships a new bake of the terrain, and commit the result.
const fs = require('fs'), path = require('path');

const from = process.argv[2];
if (!from || !fs.existsSync(path.join(from, 'Nav', 'Nav0.lua'))) {
  console.error('Give the folder of Shortest Path Forever: the one with Nav and Data in it.');
  process.exit(1);
}
const FIELDS = ['graph', 'grid', 'height', 'floor', 'terrain'];
const version = /^## Version:\s*(\S+)/m.exec(fs.readFileSync(path.join(from, 'ShortestPathForever.toc'), 'utf8'))?.[1] ?? 'unknown';

// The strings of one map in a Data file: `[map] = { [cluster] = "..." }`, clusters counted from 1.
function perCluster(file, map) {
  const out = {};
  let at = null;
  for (const line of fs.readFileSync(path.join(from, 'Data', file), 'latin1').split('\n')) {
    const head = /^\t\[(\d+)\] = \{/.exec(line), row = /^\t\t\[(\d+)\] = "([^"]*)"/.exec(line);
    if (head) at = Number(head[1]);
    else if (row && at === map) out[Number(row[1]) - 1] = row[2];
  }
  return out;
}

const to = path.join(__dirname, '..', 'resources', 'nav');
fs.mkdirSync(to, { recursive: true });
for (const map of [0, 1]) {
  const head = fs.readFileSync(path.join(from, 'Nav', `Nav${map}.lua`), 'utf8');
  const num = (name) => Number(new RegExp(`\\b${name} = (-?[\\d.]+)`).exec(head)[1]);
  const packed = Object.fromEntries(FIELDS.map((field) => [field, {}]));
  for (const file of fs.readdirSync(path.join(from, 'Nav')).filter((f) => f.startsWith(`Nav${map}_`)).sort()) {
    const text = fs.readFileSync(path.join(from, 'Nav', file), 'latin1');
    for (const m of text.matchAll(/data\.packed\.(\w+)\[(\d+)\] = \{([^}]*)\}/g)) {
      if (!packed[m[1]]) throw new Error(`a field this script does not know: ${m[1]}`);
      packed[m[1]][Number(m[2]) - 1] = [...m[3].matchAll(/"([^"]*)"/g)].map((b) => b[1]); // clusters from 0, as in the format
    }
  }
  const nav = {
    map,
    from: `Shortest Path Forever ${version}`,
    // The lines of the bake: the build of the game it was made from, and what made it.
    source: head.split('\n').slice(0, 3).map((line) => line.replace(/^-- /, '').trim()),
    cx0: num('cx0'), cy0: num('cy0'), nx: num('nx'), ny: num('ny'), cells: num('cells'), swim: num('swim'), zstep: num('zstep'), format: num('format'), steep: /\bsteep = true/.test(head),
    packed,
    roads: perCluster('RoadCells.lua', map),
    roadEdges: perCluster('RoadEdges.lua', map),
  };
  const file = path.join(to, `nav${map}.json`);
  fs.writeFileSync(file, JSON.stringify(nav));
  console.log(`${file}: ${(fs.statSync(file).size / 1048576).toFixed(1)} MB, ${Object.keys(packed.grid).length} clusters, ${Object.keys(nav.roads).length} with roads, from ${nav.from}`);
}
