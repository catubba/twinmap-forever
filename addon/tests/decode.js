// Reads one drawn strip back: a string of cells, each a digit 0 to 7 (R*4 + G*2 + B).
// Returns null when the strip is not a whole, intact block. A block drawn in negative (every cell
// 7 - v) decodes to the same block, with negative: true.
function decodeStrip(cells) {
  return decode(cells, false) || decode(cells, true);
}

function decode(cells, negative) {
  const bytes = [];
  let acc = 0, nbits = 0;
  for (const c of cells) {
    acc = (acc << 3) | (negative ? 7 - Number(c) : Number(c));
    nbits += 3;
    if (nbits >= 8) {
      nbits -= 8;
      bytes.push((acc >> nbits) & 0xff);
      acc &= (1 << nbits) - 1;
    }
  }
  if (bytes[0] !== 0xc7 || bytes[1] !== 0x1b) return null;
  const protocol = bytes[2], id = (bytes[3] << 8) | bytes[4], end = 7 + ((bytes[5] << 8) | bytes[6]);
  if (bytes.length < end + 2) return null;
  let s1 = 0, s2 = 0;
  for (let i = 2; i < end; i++) {
    s1 = (s1 + bytes[i]) % 255;
    s2 = (s2 + s1) % 255;
  }
  if (bytes[end] !== s1 || bytes[end + 1] !== s2) return null;
  const [section, version, part, total, ...text] = Buffer.from(bytes.slice(7, end)).toString('utf8').split('\x1f');
  return { negative, protocol, id, section, version: Number(version), part: Number(part), total: Number(total), text: text.join('\x1f') };
}

module.exports = { decodeStrip };
