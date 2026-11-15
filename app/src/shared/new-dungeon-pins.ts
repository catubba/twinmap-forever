// Where the bosses and the entrance are on the map of the dungeons World of Warcraft: Forever added
// last, as dungeon-pins.ts has them for the others.
//
// GENERATED, do not edit: made by design/interiors/fdr-pins.ts from Forever Dungeon Routes 1.2.4 by
// Checkov23 (Data/DefaultRoutes.lua, the stops of each default route, and Data/Minimaps.lua), MIT
// License, Copyright (c) 2026 Checkov23. The notice is in THIRD-PARTY-LICENSES.
//
// The addon gives each stop on its own map of the dungeon, which it lays over the game's minimap
// pictures: the same pictures the app has, so a stop is brought to the yards of the app's map with
// no error of its own. The stops themselves are approximate, taken from video guides: a boss may
// stand some tens of yards from its skull. The entrance is where the addon's route starts.

import type { DungeonPins } from './dungeon-pins'

export const NEW_DUNGEON_PINS: DungeonPins[] = [
  {
    name: 'The Drowned City',
    map: 2970,
    bounds: [13706, 30068, 15097, 30779],
    entrance: [14846.2, 30322.6],
    bosses: [
      ['Zul\'Alai', 14620.7, 30399],
      ['Var\'Taka', 14264.9, 30611.9],
      ['Primeval Elemental', 14459.8, 30526.6],
      ['Captain Dreadrise', 14342.3, 30161.7],
      ['Deathless Guardians', 13994, 30390.8],
      ['Min\'loth the Serpent', 13746.1, 30395.6],
    ],
  },
  {
    name: 'Blackmaw Hold',
    map: 2974,
    bounds: [13077, 13235, 14363, 13854],
    entrance: [13305.1, 13687.3],
    bosses: [
      ['Impaan the Imprisoner', 13500, 13733.5],
      ['Bonesnout the Unbroken', 13687.4, 13654.6],
      ['Withermaw', 13465.6, 13404.8],
      ['Unbound Spirit', 14157.8, 13801.7],
      ['Elder Shaman Bloodmane', 14180.4, 13383.1],
      ['Blackmaw Behemoth', 14118.8, 13591.6],
      ['Varrox Bleakhoof', 14077.2, 13586.3],
    ],
  },
  {
    name: 'Alcaz Prison',
    map: 2994,
    bounds: [14000, 25738, 14342, 26120],
    entrance: [14215.3, 25863.3],
    bosses: [
      ['Tidemistress Ca\'zass', 14102.8, 25861.4],
      ['Overseer Wrex', 14179.3, 25954.2],
      ['The Questioner', 14219.3, 25828.7],
      ['Katerina the Cleaner', 14136, 25873.1],
      ['Blazeroar', 14099.4, 25959.5],
    ],
  },
  {
    name: 'The Shaper\'s Terrace',
    map: 3001,
    bounds: [17456, 22263, 19187, 23654],
    entrance: [17740.1, 22702.4],
    bosses: [
      ['Titanosaur', 17946.8, 22751.8],
      ['Cinder', 17921, 22953.9],
      ['Ravasaur Hunters', 18533, 22722.1],
      ['Direhorn Matriarch', 18793.7, 22914.2],
      ['Thunderhoof', 18535.6, 23016],
      ['Venomridge', 18260.9, 22962.6],
      ['Bolt', 18285.4, 22944.4],
      ['Snowtalon', 17874, 22535.5],
      ['Vitrix', 18387.5, 22656.1],
      ['Nanaya', 18659.6, 22892],
      ['King Op', 18925.7, 23172.5],
    ],
  },
  {
    name: 'Krol\'dok Stronghold',
    map: 3039,
    bounds: [20148, 23558, 22356, 25378],
    entrance: [20781.1, 24655.5],
    bosses: [
      ['Slavecrusher Grox', 20903.1, 24470.6],
      ['Twilight Commander Zarmok', 21156.2, 24558.2],
      ['Handler Ashka', 21539.4, 24363.8],
      ['Nar\'gurk', 21089.2, 24385],
      ['Overseer Mugg', 21641, 23880.8],
    ],
  },
]
