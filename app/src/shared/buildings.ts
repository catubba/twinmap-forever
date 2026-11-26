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
 * at a height.
 */
export interface Placed {
  format: number
  placed: [string, number, number, number, number, number, number][]
  /** Each file's radius, by file. */
  radius: Record<string, number>
}

/** The BLP number of each kind of DXT (0 DXT1, 1 DXT3, 7 DXT5), as decodeDxtCutout takes it. */
export const DXT_KIND: Partial<Record<TexKind, number>> = { dxt1: 0, dxt1a: 0, dxt3: 1, dxt5: 7 }
