// The buildings of the continents in 3D (M23-F2), as main/buildings.ts makes them and the 3D view (buildings3d.ts) reads them.

/** The kinds of texture: DXT as the game keeps it, a PNG, or none (a plain stone). */
export type TexKind = 'dxt1' | 'dxt1a' | 'dxt3' | 'dxt5' | 'png' | 'none'

/** A run of triangles drawn with one material: its textures as the layers of one array, by the layer each point says. */
export interface Draw {
  start: number
  count: number
  kind: TexKind
  textures: number[]
  /** 0 solid, 1 holes cut where see-through (railings, leaves), 2 blended (glass). */
  blend: number
  /** Lit by itself, not by the sun. */
  unlit: boolean
  /** Ceilings of rooms under a roof: left out of a building inside the ground. */
  ceiling?: boolean
  /** The building's own liquid, with no texture: what it is, as shared/water.ts numbers them (the canals of Stormwind, the lava of Ironforge). */
  liquid?: number
}

/**
 * A building's file once inflated: Uint32 length of the head, the head (this, as JSON), up to a multiple of 4, then
 * Float32 x y z, Float32 u v, Float32 nx ny nz a point, Uint8 layer a point up to a multiple of 4, and the indices
 * (Uint16 under 65,536 points, Uint32 else).
 */
export interface BuildingHead {
  vertices: number
  indices: number
  /** From the file's own origin, the farthest of its points: what the view loads by. */
  radius: number
  /** The height of its main floor under a roof, in the file's yards: where a building inside the ground is cut from. */
  floor: number
  draws: Draw[]
}

/**
 * Where the buildings of a continent stand: file (its name in the folder), x, y, z (yards, as the 3D view), turn
 * (radians round y), scale, and 1 for a building inside the ground (Ironforge, Undercity, a mine), which the view cuts
 * at a height, or DUNGEON for one of a dungeon or a raid, drawn without its ceilings and not cut (M23-F23).
 */
export interface Placed {
  format: number
  placed: [string, number, number, number, number, number, number][]
  /** Each file's radius, by file. */
  radius: Record<string, number>
}

export const DUNGEON = 2

/** The folder of a dungeon's or raid's buildings, trees and objects, by the game's number of its map: the one its ground has, where it has one (interiors.ts). */
export const dungeonFolder = (map: number): string => `i${map}`

/** Pixels a building's radius is on the view when it comes on show, and those under which it goes again: smaller, it is left to the picture of the ground, where the game has it painted. */
export const SHOW_PX = 14
export const HIDE_PX = 11

/**
 * The buildings on show from a camera (M23-F3), by their place in the list: those on the ground the view shows (within
 * reach yards of the point looked at: turning round it changes nothing) whose radius is wide enough on the view
 * (perRadian: pixels a radian), the widest first, as long as their files fit under the roof (bytes: what a file takes on the graphics card, 0 for one not read yet; each file
 * once). shown: whether a building is on show already, which then stays down to HIDE_PX. Each with its pixels.
 */
export function onShow(list: Placed, camera: { x: number; y: number; z: number }, target: { x: number; z: number }, reach: number, perRadian: number, shown: (i: number) => boolean, bytes: (file: string) => number, roof: number): [number, number][] {
  const sized: [number, number][] = []
  list.placed.forEach(([file, x, y, z, , scale], i) => {
    const r = (list.radius[file] ?? 0) * scale, away = Math.hypot(x - camera.x, y - camera.y, z - camera.z)
    if (Math.hypot(x - target.x, z - target.z) - r > reach) return
    const px = (r / Math.max(away, r)) * perRadian
    if (px >= (shown(i) ? HIDE_PX : SHOW_PX)) sized.push([i, px])
  })
  sized.sort((a, b) => b[1] - a[1])
  const out: [number, number][] = [], counted = new Set<string>()
  let room = roof
  for (const one of sized) {
    const file = list.placed[one[0]]![0]
    if (!counted.has(file)) {
      counted.add(file)
      if ((room -= bytes(file)) < 0) break
    }
    out.push(one)
  }
  return out
}

/** The BLP number of each kind of DXT (0 DXT1, 1 DXT3, 7 DXT5), as decodeDxtCutout takes it. */
export const DXT_KIND: Partial<Record<TexKind, number>> = { dxt1: 0, dxt1a: 0, dxt3: 1, dxt5: 7 }
