// The samples of the participation programme: off until the player turns it on in the settings.
// Inside a dungeon the minimap, as the app read it, is kept each time the place was not found, and
// once a room where it was. When the character leaves, what was kept is sent (server/src/index.ts),
// and never before: nothing leaves this computer during a run. The server is asked first how many
// samples of that dungeon it still wants today, and no more than that is sent. A sample says nothing of who sent
// it: no name, no realm, and the number of its run is drawn anew at each dungeon entered.
import { randomBytes } from 'node:crypto'
import { SURE, type Box } from '../shared/minimap'
import type { InsideReport } from './minimap'
import { encodePng } from './png'

export const SAMPLES_TO = 'https://api.twinmap.app/sample'
const MOST = 100 // samples of a run: the server numbers them 0 to 99
const MOST_FOUND = 50 // of them, where the place was found: the rest of the room is for where it was not
const LARGEST = 200_000 // bytes of a picture the server takes
// A room is wanted once in a run, however long the run: on the recorded runs (49 minutes each) that is 40 samples in
// The Hall of Thanes and 26 in Deadmines, where one every five minutes gave 52 and 45, and one every half minute 129 and 115.
const ROOM_EVERY = Infinity // ms between two samples of the same room while the place is found
const FAILED_EVERY = 10_000 // ms between two samples of a place not found: standing lost, the minimap does not change
// ponytail: a room is a square of this many yards on the picture of its level, not a room of the
// game's files. The rooms themselves (inPiece in shared/inside.ts) when the rule of the rooms wants them.
const ROOM = 40
// The addon says the mouse was over the minimap a little after it was: the pictures of this
// many ms before are dropped, as they may hold the names the game shows there.
const COVERED_BEFORE = 5_000
const SEND_EVERY = 700 // ms between two sends: the server takes a hundred a minute from an address

export interface Sample {
  /** What is said of the picture, as the server wants it: its number in the run, the map, the zoom, and the place found with its likeness. */
  fields: Record<string, string>
  png: Buffer
}
export interface Run {
  id: string
  samples: Sample[]
}

/** The minimap alone as a PNG: black outside its circle, where the square cut off the screen shows the game around it. Halved until the server takes it. */
export function roundPng(box: Box): Buffer {
  let size = box.size, rgb = Uint8Array.from(box.rgb)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size / 2) rgb.fill(0, (y * size + x) * 3, (y * size + x) * 3 + 3)
  let png = encodePng(rgb, size, size, 3, 2)
  while (png.length > LARGEST && size >= 64) {
    const half = size >> 1, small = new Uint8Array(half * half * 3)
    for (let y = 0; y < half; y++) for (let x = 0; x < half; x++) for (let c = 0; c < 3; c++) small[(y * half + x) * 3 + c] = (rgb[(2 * y * size + 2 * x) * 3 + c]! + rgb[(2 * y * size + 2 * x + 1) * 3 + c]! + rgb[((2 * y + 1) * size + 2 * x) * 3 + c]! + rgb[((2 * y + 1) * size + 2 * x + 1) * 3 + c]!) >> 2
    ;(size = half), (rgb = small), (png = encodePng(rgb, size, size, 3, 2))
  }
  return png
}

/**
 * Keeps the samples of the run under way. take() is called with what each look at the minimap came
 * to (null out of a dungeon) and the square it looked at; own tells whether that square shows the
 * game and nothing over it, asked only when a sample is due. It gives a run when the run ends,
 * if it has anything: the caller sends it. With the choice off nothing is kept and nothing is given.
 */
export function startSamples(on: () => boolean): { take: (report: InsideReport | null, seen: Box | null, own: () => boolean, now: number) => Run | null } {
  let run: (Run & { dungeon: number; rooms: Map<string, number>; failedAt: number; found: number; times: number[] }) | null = null
  return {
    take(report, seen, own, now) {
      const done = run && report?.dungeon !== run.dungeon ? run : null
      if (done) run = null
      if (!on()) return (run = null), null
      if (report?.hid && run) {
        const since = now - COVERED_BEFORE
        while ((run.times.at(-1) ?? -Infinity) > since) {
          run.times.pop()
          if (!lost(run.samples.pop()!)) run.found--
        }
        for (const [room, at] of run.rooms) if (at > since) run.rooms.delete(room)
      }
      // Only a look that read the screen: a place found, or none like enough.
      if (report && seen && !report.hid && (report.why === undefined || report.why === 'not sure') && Number.isInteger(report.zoom) && report.zoom! >= 0 && report.zoom! <= 5) {
        const place = report.place, far = report.far, failed = !place || place.score < SURE
        run ??= { id: randomBytes(8).toString('hex'), dungeon: report.dungeon, samples: [], rooms: new Map(), failedAt: -Infinity, found: 0, times: [] }
        const room = place ? `${report.picture} ${Math.floor(place.u / ROOM)} ${Math.floor(place.v / ROOM)}` : ''
        const due = failed ? now - run.failedAt >= FAILED_EVERY : run.found < MOST_FOUND && now - (run.rooms.get(room) ?? -Infinity) >= ROOM_EVERY
        const png = due && run.samples.length < MOST && own() ? roundPng(seen) : null
        // Standing lost, the minimap stays as it is: the same picture is not kept twice in a row.
        if (png && !run.samples.at(-1)?.png.equals(png)) {
          if (failed) run.failedAt = now
          else run.rooms.set(room, now), run.found++
          const tenth = (n: number): string => String(Math.round(n * 10) / 10)
          run.times.push(now)
          run.samples.push({
            fields: {
              n: String(run.samples.length),
              map: String(report.dungeon),
              zoom: String(report.zoom),
              ...(place ? { u: tenth(place.u), v: tenth(place.v), score: String(Math.round(Math.min(1, Math.max(0, place.score)) * 1000) / 1000) } : {}),
              // Where the addon found the character from the flight masters at that moment, height included: the true place of the picture.
              ...(far ? { x: tenth(far.x), y: tenth(far.y), z: tenth(far.z), r: tenth(Math.min(far.r, 999)) } : {}),
            },
            png,
          })
        }
      }
      return done?.samples.length ? { id: done.id, samples: done.samples } : null
    },
  }
}

/** Whether a sample is one where no sure place was found: the server counts those apart (lost in server/src/index.ts). */
const lost = (sample: Sample): boolean => !(Number(sample.fields.score) >= SURE)

/**
 * Sends the samples of a run, one after the other, while the choice stays on: first the server is
 * asked how many of that dungeon it still wants today from this version of the app, with a place
 * found and without, and the rest is let go. said: the version of the app, the build of the game and its language. Gives how many the server took.
 */
// ponytail: a send that fails (no network, the server's limit of the day) lets the rest of the run go:
// nothing is tried again, nothing is kept on disk. A queue on disk if too many runs are lost this way.
export async function sendSamples(run: Run, said: { app: string; build: string; locale: string }, on: () => boolean, to: string = SAMPLES_TO, every: number = SEND_EVERY): Promise<number> {
  let sent = 0, want: { found: number; failed: number }
  try {
    const answer = await fetch(`${to.replace(/sample$/, 'want')}?${new URLSearchParams({ map: run.samples[0]?.fields.map ?? '', app: said.app })}`, { signal: AbortSignal.timeout(15_000) })
    if (!answer.ok || !on()) return 0
    // By kind of data: one that is not in the answer is not wanted, switched off on the server.
    want = ((await answer.json()) as Record<string, typeof want | undefined>).minimap ?? { found: 0, failed: 0 }
  } catch {
    return 0
  }
  for (const sample of run.samples) {
    if (!(want[lost(sample) ? 'failed' : 'found']-- > 0)) continue
    if (sent) await new Promise((next) => setTimeout(next, every))
    if (!on()) break
    try {
      const answer = await fetch(`${to}?${new URLSearchParams({ run: run.id, ...said, ...sample.fields })}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: new Uint8Array(sample.png), signal: AbortSignal.timeout(15_000) })
      if (!answer.ok) break
    } catch {
      break
    }
    sent++
  }
  return sent
}
