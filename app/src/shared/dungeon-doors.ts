// Where one walks into the dungeons the game's table of maps gives no door for: the ones World of
// Warcraft: Forever added.
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
