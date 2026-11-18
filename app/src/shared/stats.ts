// The statistics of a character, as the game's character window words them (Sheet.lua, piece "stats"):
// its categories in its order, each with its lines. The app shows them as they come and works nothing out.

export interface StatLine {
  label: string
  value: string
  /** The colour the game gives the value, "#rrggbb": green for one raised by what is worn or by a spell. */
  color?: string
}

export interface StatGroup {
  name: string
  lines: StatLine[]
}

/** The piece "stats" of a sheet, checked: what is not a category or a line is left out. None where the addon sent none. */
export function statsOf(piece: unknown): StatGroup[] {
  if (!Array.isArray(piece)) return []
  const out: StatGroup[] = []
  for (const group of piece) {
    if (!Array.isArray(group) || typeof group[0] !== 'string' || !Array.isArray(group[1])) continue
    const lines: StatLine[] = []
    for (const line of group[1] as unknown[]) {
      if (!Array.isArray(line) || typeof line[0] !== 'string' || typeof line[1] !== 'string') continue
      const color = typeof line[2] === 'string' && /^[0-9a-f]{6}$/.test(line[2]) ? `#${line[2]}` : undefined
      lines.push({ label: line[0], value: line[1], ...(color && { color }) })
    }
    if (lines.length) out.push({ name: group[0], lines })
  }
  return out
}
