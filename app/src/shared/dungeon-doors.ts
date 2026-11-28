// Where one walks into the dungeons the game's table of maps gives no door for: the ones World of
// Warcraft: Forever added. And the other doors of the dungeons that have more than one (MORE_DOORS).
//
// From MapUtils 1.7.5 by D4KiR (pins.lua, the AddDungeon entries marked foreverOnly), GNU General
// Public License version 3. The notice is in THIRD-PARTY-LICENSES.
//
// The place is on the map of a zone, as the game counts it: x and y from 0 to 1 from its top left.

export interface DungeonDoor {
  /** The game's number of the dungeon's map. */
  map: number
  /** The dungeon's name, for when the game's table does not give it. */
  name: string
  /** The game's number of the zone's map the place is counted on. */
  zone: number
  x: number
  y: number
}

export const DUNGEON_DOORS: DungeonDoor[] = [
  { map: 2959, name: 'City of Dalaran', zone: 1416, x: 0.08509, y: 0.59261 },
  { map: 2970, name: 'The Drowned City', zone: 1434, x: 0.21317, y: 0.27817 },
  { map: 2974, name: 'Blackmaw Hold', zone: 1447, x: 0.386, y: 0.332 },
  { map: 2994, name: 'Alcaz Prison', zone: 1445, x: 0.75, y: 0.147 },
  { map: 2998, name: 'Excavation Site: Wetlands', zone: 1437, x: 0.47705, y: 0.56244 },
  { map: 2999, name: 'Ruins of Lordaeron', zone: 1420, x: 0.6336, y: 0.6738 },
  { map: 3001, name: "The Shaper's Terrace", zone: 1449, x: 0.481, y: 0.061 },
  { map: 3039, name: "Krol'dok Stronghold", zone: 2548, x: 0.485, y: 0.261 },
  { map: 3065, name: 'The Hall of Thanes', zone: 1455, x: 0.27864, y: 0.47695 },
]

/** A door more of a dungeon the game's table gives one door for: in yards of its continent, as the game counts them. */
export interface MoreDoor {
  map: number
  continent: 0 | 1
  x: number
  y: number
  /** The wing it opens on, by the name of its pins (dungeon-pins.ts). */
  wing?: string
}

// Where the game puts one who walks out through each of these doors, a few yards from it: the target of the exits in
// the areatrigger_teleport table of the CMaNGOS classic-db database (GNU General Public License, version 3; the
// notice is in THIRD-PARTY-LICENSES). The doors of the wings of Dire Maul are where MapUtils has them too.
export const MORE_DOORS: MoreDoor[] = [
  { map: 70, continent: 0, x: -6619.97, y: -3765.74 }, // Uldaman Instance End: the back door, in Dustwind Gulch
  { map: 349, continent: 1, x: -1182.8, y: 2877.43 }, // Maraudon Purple
  { map: 349, continent: 1, x: -1468.2, y: 2614.21 }, // Maraudon Orange
  { map: 429, continent: 1, x: -3520.24, y: 1078.4, wing: 'Dire Maul: North' },
  { map: 429, continent: 1, x: -3749.41, y: 1249.25, wing: 'Dire Maul: West' },
  { map: 429, continent: 1, x: -3738.62, y: 934.522, wing: 'Dire Maul: East' },
  { map: 429, continent: 1, x: -4031.25, y: 129.345, wing: 'Dire Maul: East' }, // the back door, by Lariss Pavilion
]
