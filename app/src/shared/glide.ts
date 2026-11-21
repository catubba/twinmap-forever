// The way of the arrow between the places the game tells. The arrow is shown a little behind the
// readings, where the character was at that moment: between two readings it goes at the speed
// the character had, whatever that was, and it never has to guess where the next one will be.

/** Milliseconds between two positions of a character on the move: the addon's period for "pos". */
export const PERIOD = 250
/**
 * How far behind the readings the arrow is shown: a period, and room for a reading that comes late. The next one must
 * reach the window (every 50 ms, SHOW_EVERY in main/index.ts) before the arrow reaches the last: readings up to
 * 300 ms apart keep it gliding, the period and a block of another section in the queue or a slow frame of the game.
 */
export const BEHIND = 350

/** A place and the moment the game told it, in milliseconds. */
export interface Fix { at: number; x: number; y: number }

/**
 * Adds a reading to the way. The same place told again adds nothing. The addon sends a place only
 * when it changes: after a silence the character stood on the last one until a period ago, and
 * that is written down, so a start from still takes one period and not the whole silence.
 */
export function addFix(way: Fix[], fix: Fix): Fix[] {
  const last = way.at(-1)
  if (!last) return [fix]
  if (last.x === fix.x && last.y === fix.y) return way
  const stood = fix.at - last.at > PERIOD * 1.6 ? [{ ...last, at: fix.at - PERIOD }] : []
  return [...way, ...stood, fix].slice(-8)
}

/** Where the arrow is at a moment, and whether it has reached the last place told. */
export function whereAt(way: Fix[], time: number): { x: number; y: number; arrived: boolean } {
  const last = way.at(-1)!
  for (let i = 1; i < way.length; i++) {
    const a = way[i - 1]!, b = way[i]!
    if (time >= b.at) continue
    const t = Math.max(0, (time - a.at) / (b.at - a.at))
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, arrived: false }
  }
  return { x: last.x, y: last.y, arrived: true }
}

/** Milliseconds an arrow takes to turn to a new heading, at an even pace. */
export const TURN = 250

/** A turn of the arrow under way, in degrees clockwise from north: from one heading to the next, begun at a moment. */
export interface Turn { from: number; to: number; at: number }

/** Where a turn has got to at a moment. */
export const turnAt = (turn: Turn, now: number): number => turn.from + (turn.to - turn.from) * Math.min(1, (now - turn.at) / TURN)
