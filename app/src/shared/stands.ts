// Where what lies on the ground of the 3D view stands over the game's ground (M23-F4). Under Stormwind the ground of
// the game is flat, 35 yards under the streets, which are the city building's; under Orgrimmar 27. The walking grid
// shipped with the app (Shortest Path Forever's, main/walk.ts) knows where one walks: the base surface of each of its
// cells (about 8 yards) is the street, the game's ground a floor under it.
//
// The rule, tried on the whole world (design/ROADMAP.md, M23-F4): a cell is covered when its base surface is HIGH yards
// or more over the game's ground (less is a slope: a cell tells one height for all of it); a place is a city on its own
// floor where MOST of the cells within ROUND of it are covered (a cliff is narrow and is not), and so is all the ground
// flat as a table that reaches such a place: the floor the game lays under the city, also where the grid has taken it
// for the base surface (inside Stormwind's cathedral, cell by cell). There things stand on the base surface; where a
// cell has none over the ground (a roof, a block of houses, that cathedral), on the floor nearest to what the cells round
// it stand at, or with no floor either as those round it.
//   <continent>/stands.json    Stands, made after the buildings (main/stands.ts): the view asks for it until it is there

export const STANDS_FILE = 'stands.json'
/** Yards over the game's ground from which a place to stand is not the ground (and 2 over the water). */
export const OVER = 3
const HIGH = 8
const ROUND = 5
const MOST = 0.5
/** Yards between the ground of two cells side by side for it to be flat as a table. */
const FLAT = 0.05

/** A continent's cells where things stand over the ground: by block ("column-row"), a cell (its row times cells, plus its column: east, then south) and its height in quarters of a yard, one after the other. */
export interface Stands {
  format: number
  /** Cells a side of a block. */
  cells: number
  blocks: Record<string, number[]>
}

/** What there is to stand on over the ground of a cell: its base surface when that is over it, else its floors that are. */
export interface Over {
  base: number | null
  floors: number[]
}

/**
 * The height things stand at, by cell, where it is not the ground. width: cells a side of the continent; a cell is its
 * row times width plus its column. over: the cells with something to stand on over the ground. ground: the game's ground
 * at a cell, NaN where there is none.
 */
export function standsOf(width: number, over: Map<number, Over>, ground: (cell: number) => number): Map<number, number> {
  // how many of the cells round each are covered, counted from the covered ones
  const round = new Map<number, number>()
  for (const [at, o] of over) {
    if (o.base === null || !(o.base >= ground(at) + HIGH)) continue
    const x = at % width, y = Math.floor(at / width)
    for (let dy = -ROUND; dy <= ROUND; dy++)
      for (let dx = -ROUND; dx <= ROUND; dx++) {
        if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= width) continue
        const to = (y + dy) * width + x + dx
        round.set(to, (round.get(to) ?? 0) + 1)
      }
  }
  const city = new Set<number>()
  for (const [at, n] of round) if (n >= MOST * (2 * ROUND + 1) ** 2 && !Number.isNaN(ground(at))) city.add(at)
  // and the flat floor under it, as far as it goes
  const reached = [...city]
  for (let i = 0; i < reached.length; i++) {
    const at = reached[i]!, g = ground(at), x = at % width
    for (const to of [at - width, at + width, x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1]) {
      if (to < 0 || to >= width * width || city.has(to) || !(Math.abs(ground(to) - g) < FLAT)) continue
      city.add(to)
      reached.push(to)
    }
  }
  // the mean of what the cells round one stand at, looked for wider when none is near; NaN when none is
  const near = (at: number, from: Map<number, number>): number => {
    const x = at % width, y = Math.floor(at / width)
    for (let reach = ROUND; reach <= ROUND * 4; reach += ROUND) {
      let sum = 0, n = 0
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          const v = x + dx >= 0 && x + dx < width ? from.get((y + dy) * width + x + dx) : undefined
          if (v !== undefined) ((sum += v), n++)
        }
      if (n) return sum / n
    }
    return NaN
  }
  const stand = new Map<number, number>()
  for (const at of city) {
    const base = over.get(at)?.base
    if (base !== null && base !== undefined) stand.set(at, base)
  }
  const based = new Map(stand)
  for (const at of city) {
    const floors = over.get(at)?.floors
    if (stand.has(at) || !floors?.length) continue
    const level = near(at, based)
    stand.set(at, Number.isNaN(level) ? Math.min(...floors) : floors.reduce((a, b) => (Math.abs(b - level) < Math.abs(a - level) ? b : a)))
  }
  const walked = new Map(stand)
  for (const at of city) {
    if (stand.has(at)) continue
    const level = near(at, walked)
    if (level > ground(at) + OVER) stand.set(at, level)
  }
  return stand
}
