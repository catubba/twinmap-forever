// The trees and objects of the continents in 3D (M23-F7: the M2 models of the game), as main/props.ts makes them and the
// 3D view (props3d.ts) reads them. The choices are the user's, on the prototype design/props/ (design/ROADMAP.md, M23-F6).
import type { TexKind } from './buildings'

/**
 * A piece of a model: a run of triangles of one texture and one way of blending, with its own points. blend as the
 * game has it: 0 solid, 1 holes cut where see-through (leaves), 2 and 5-6 blended, 3, 4 and 7 added.
 */
export interface PropPiece {
  points: number
  indices: number
  texture: number
  kind: TexKind
  blend: number
  /** The game's flags of its material: 1 lit by itself, 4 both sides drawn. */
  flags: number
  /** How much it shows, 1 whole; the pieces the game keeps hidden are left out. */
  opacity: number
}

/**
 * A model's file once inflated: Uint32 length of the head, the head (this, as JSON), up to a multiple of 4, then for
 * each piece Float32 x y z, nx ny nz, u v a point (yards, x east, y up, z south as the 3D view, not turned) and its
 * Uint16 indices up to a multiple of 4.
 */
export interface PropHead {
  /** From the model's own origin, the farthest of its points. */
  radius: number
  /** A tree: leaves cut out by alpha, at least TREE_RADIUS wide. Its leaves open round the character. */
  tree: boolean
  pieces: PropPiece[]
}

/** Yards of a model's radius from which one with leaves is a tree, not a bush or a plant in a pot. */
export const TREE_RADIUS = 4

/**
 * How many trees are drawn, from the fewest: a tree is kept when no tree kept before it, in an order fixed by where it
 * stands, has its crown nearer than this many times the two crowns together (the crown 0.6 of the model's radius). The
 * user's choice on the prototype (M23-F6): the same trees at each visit, thinned where the woods hide the ground.
 */
export const DENSITIES = { few: 1.2, some: 1, many: 0.6 } as const
export type Density = keyof typeof DENSITIES

/**
 * Of each copy of a block (its file <continent>/props/<column>-<row>.bin, deflated): Uint32 number of models, then of
 * each Uint32 file, Uint32 copies, and for each copy 12 Float32 (its 3 x 4 matrix, column by column, into the view's
 * yards) and a Float32 of these bits: drawn with few, some or many trees (always all three for what is not a tree).
 */
export const KEPT_BITS: Record<Density, number> = { few: 4, some: 2, many: 1 }

/** The blocks of a continent that have copies, as "column-row": written last, the view takes none before it. */
export interface PropBlocks {
  format: number
  blocks: string[]
}
