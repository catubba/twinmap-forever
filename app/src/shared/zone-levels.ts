// The level range of each zone, which the game's tables do not have (UiMap's LevelRange is 0 everywhere), and the
// colour a zone takes for a character: the game's colours of difficulty, as it gives them to a quest or a creature.
//
// The ranges: Data/Forever/Levels.lua of OpenMap v0.8.13 (MIT, in THIRD-PARTY-LICENSES), which takes them from the
// Warcraft Wiki's "Zones by level (original)" page; Mount Hyjal and Shen'dralas, which it has not, from the wiki's own
// pages of the two zones of Forever. Cities have none, and are not tinted.

/** [uiMapID]: [lowest, highest] level. */
export const ZONE_LEVELS: Record<number, readonly [number, number]> = {
  // Eastern Kingdoms
  1416: [30, 40], // Alterac Mountains
  1417: [30, 40], // Arathi Highlands
  1418: [35, 45], // Badlands
  1419: [45, 55], // Blasted Lands
  1420: [1, 10], // Tirisfal Glades
  1421: [10, 20], // Silverpine Forest
  1422: [51, 58], // Western Plaguelands
  1423: [53, 60], // Eastern Plaguelands
  1424: [20, 30], // Hillsbrad Foothills
  1425: [40, 50], // The Hinterlands
  1426: [1, 10], // Dun Morogh
  1427: [45, 50], // Searing Gorge
  1428: [50, 58], // Burning Steppes
  1429: [1, 10], // Elwynn Forest
  1430: [55, 60], // Deadwind Pass
  1431: [18, 30], // Duskwood
  1432: [10, 20], // Loch Modan
  1433: [15, 25], // Redridge Mountains
  1434: [30, 45], // Stranglethorn Vale
  1435: [35, 45], // Swamp of Sorrows
  1436: [10, 20], // Westfall
  1437: [20, 30], // Wetlands
  2548: [35, 45], // Riverglades (warcraft.wiki.gg/wiki/Riverglades)
  // Kalimdor
  1411: [1, 10], // Durotar
  1412: [1, 10], // Mulgore
  1413: [10, 25], // The Barrens
  1438: [1, 10], // Teldrassil
  1439: [10, 20], // Darkshore
  1440: [18, 30], // Ashenvale
  1441: [25, 35], // Thousand Needles
  1442: [15, 27], // Stonetalon Mountains
  1443: [30, 40], // Desolace
  1444: [40, 50], // Feralas
  1445: [35, 45], // Dustwallow Marsh
  1446: [40, 50], // Tanaris
  1447: [45, 55], // Azshara
  1448: [48, 55], // Felwood
  1449: [48, 55], // Un'Goro Crater
  1450: [55, 60], // Moonglade
  1451: [55, 60], // Silithus
  1452: [55, 60], // Winterspring
  2482: [60, 60], // Mount Hyjal (warcraft.wiki.gg/wiki/Mount_Hyjal_(Forever))
  2652: [35, 45], // Shen'dralas (warcraft.wiki.gg/wiki/Shen'dralas)
  // Elsewhere
  2521: [1, 12], // Zephras Isle (warcraft.wiki.gg/wiki/Zephras_Isle)
}

export type Difficulty = 'red' | 'orange' | 'yellow' | 'green' | 'grey'

/** The highest level that gives a character of this level no XP: grey in the game (Classic's rule for creatures). */
export function greyLevel(level: number): number {
  return level <= 5 ? 0 : level <= 39 ? level - Math.floor(level / 10) - 5 : level <= 59 ? level - Math.floor(level / 5) - 1 : level - 9
}

/**
 * A zone's colour for a character: the game's colour of the level in the zone's range closest to the character's.
 * Yellow while the character is within the range, or two levels from it.
 */
export function zoneDifficulty([low, high]: readonly [number, number], level: number): Difficulty {
  const diff = Math.min(high, Math.max(low, level)) - level
  return diff >= 5 ? 'red' : diff >= 3 ? 'orange' : diff >= -2 ? 'yellow' : high > greyLevel(level) ? 'green' : 'grey'
}
