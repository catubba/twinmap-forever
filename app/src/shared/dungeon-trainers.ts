import type { Entrance } from './dungeon-doors'

/** A place inside a dungeon: its map, u and v in the yards of its rooms, and the door it is reached by where it has several. */
export interface InsidePlace {
  map: number
  u: number
  v: number
  door?: Entrance
}

// The profession trainers who stand inside a dungeon, by the NPC's number: the map and where on it, u and v in the
// yards of its rooms (yardsInside in inside.ts). QuestieDB has them only as "inside an instance" (-1, -1). From the
// creature table of CMaNGOS classic-db (GPL-3.0, see THIRD-PARTY-LICENSES): the only trainers of a profession it has
// off the two continents. The game's x and y are in the comments. The door: which one the player walks in by, from
// someone who went there in the game (Staliot, 28 November 2026: Annora by Uldaman's back door).
export const DUNGEON_TRAINERS: Record<number, InsidePlace> = {
  11073: { map: 70, u: 16870.5, v: 17226.5, door: 'back' }, // Annora, Master Enchanter, Uldaman: -159.803, 196.172
  8696: { map: 129, u: 16361.1, v: 14463.6 }, // Henry Stern, Razorfen Downs: 2603.03, 705.568
}
