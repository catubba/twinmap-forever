-- The flight masters of the two continents and their place in the world (north, west, height, in yards), from the
-- game's own table of them (TaxiNodes, build 1.60.1). For Distance.lua, in the order it tries them. Made by a script: do not edit.
local _, ns = ...
ns.FLIGHT_MASTERS = {
  { 559, 5283.19, -3306.7, 1658.93 }, -- Summit of Eternity, Mount Hyjal
  { 19, -14473.05, 464.15, 36.43 }, -- Booty Bay, Stranglethorn
  { 38, -1767.64, 3263.89, 4.94 }, -- Shadowprey Village, Desolace
  { 40, -7048.89, -3780.36, 10.19 }, -- Gadgetzan, Tanaris
  { 27, 8643.59, 841.05, 23.3 }, -- Rut'theran Village, Teldrassil
  { 23, 1677.59, -4315.71, 61.17 }, -- Orgrimmar, Durotar
  { 58, 3374.71, 996.97, 5.19 }, -- Zoram'gar Outpost, Ashenvale
  { 77, -2380.67, -1882.67, 95.85 }, -- Camp Taurajo, The Barrens
  { 2, -8832.77, 478.62, 109.62 }, -- Stormwind, Elwynn
  { 52, 6799.24, -4742.44, 701.5 }, -- Everlook, Winterspring
  { 45, -11112.25, -3435.74, 79.09 }, -- Nethergarde Keep, Blasted Lands
  { 32, -3825.37, -4516.58, 10.44 }, -- Theramore, Dustwallow Marsh
  { 6, -4821.78, -1155.44, 502.21 }, -- Ironforge, Dun Morogh
  { 66, 931.32, -1430.11, 64.67 }, -- Chillwind Camp, Western Plaguelands
  { 79, -6113.82, -1142.7, -187.63 }, -- Marshal's Refuge, Un'Goro Crater
  { 65, 6205.88, -1949.63, 571.29 }, -- Talonbranch Glade, Felwood
  { 10, 478.86, 1536.59, 131.32 }, -- The Sepulcher, Silverpine Forest
  { 41, -4373.8, 3338.65, 12.27 }, -- Feathermoon, Feralas
  { 80, -894.59, -3773.01, 11.48 }, -- Ratchet, The Barrens
  { 3242, 4393.52, -2836.35, 1108.13 }, -- Tainted Foothills, Mount Hyjal
  { 42, -4419.86, 199.31, 25.06 }, -- Camp Mojache, Feralas
  { 26, 6341.38, 557.68, 16.29 }, -- Auberdine, Darkshore
  { 3276, -9104.1, -4830.47, 23.19 }, -- Farholde Keep, Riverglades
  { 22, -1197.21, 29.71, 176.95 }, -- Thunder Bluff, Mulgore
  { 12, -10515.46, -1261.65, 41.34 }, -- Darkshire, Duskwood
  { 48, 5068.4, -337.22, 367.41 }, -- Bloodvenom Post, Felwood
  { 73, -6761.83, 772.03, 88.91 }, -- Cenarion Hold, Silithus
  { 20, -12414.18, 146.29, 3.28 }, -- Grom'gol, Stranglethorn
  { 44, 3661.52, -4390.38, 113.05 }, -- Valormok, Azshara
  { 8, -5421.91, -2930.01, 347.25 }, -- Thelsamar, Loch Modan
  { 4, -10628.89, 1036.68, 34.06 }, -- Sentinel Hill, Westfall
  { 75, -6554.93, -1100.05, 309.57 }, -- Thorium Point, Searing Gorge
  { 71, -8364.61, -2738.35, 185.46 }, -- Morgan's Vigil, Burning Steppes
  { 11, 1568.62, 267.97, -43.1 }, -- Undercity, Tirisfal
  { 61, 2302.39, -2524.55, 104.4 }, -- Splintertree Post, Ashenvale
  { 62, 7793.61, -2403.47, 489.32 }, -- Nighthaven, Moonglade
  { 28, 2827.34, -289.24, 107.16 }, -- Astranaar, Ashenvale
  { 25, -441.8, -2596.08, 96.06 }, -- Crossroads, The Barrens
  { 5, -9429.1, -2231.4, 68.65 }, -- Lakeshire, Redridge
  { 55, -3147.39, -2842.18, 34.61 }, -- Brackenwall Village, Dustwallow Marsh
  { 33, 2681.13, 1461.68, 232.88 }, -- Stonetalon Peak, Stonetalon Mountains
  { 67, 2271.09, -5340.8, 87.11 }, -- Light's Hope Chapel, Eastern Plaguelands
  { 3203, -7923.74, -4782.96, 21.58 }, -- Rog'mar, Riverglades
  { 7, -3792.26, -783.29, 9.06 }, -- Menethil Harbor, Wetlands
  { 30, -5407.71, -2414.3, 90.32 }, -- Freewind Post, Thousand Needles
  { 21, -6633.99, -2180.05, 244.14 }, -- Kargath, Badlands
  { 13, -0.06, -859.91, 58.83 }, -- Tarren Mill, Hillsbrad
  { 64, 2721.99, -3880.64, 100.87 }, -- Talrendis Point, Azshara
  { 43, 283.74, -2002.76, 194.74 }, -- Aerie Peak, The Hinterlands
  { 76, -635.26, -4720.5, 5.38 }, -- Revantusk Village, The Hinterlands
  { 70, -7504.03, -2187.54, 165.53 }, -- Flame Crest, Burning Steppes
  { 84, 2998.71, -3050.1, 117.19 }, -- Plaguewood Tower, Eastern Plaguelands
  { 16, -1240.53, -2515.11, 22.16 }, -- Refuge Pointe, Arathi
  { 14, -711.48, -515.48, 26.11 }, -- Southshore, Hillsbrad
  { 87, 1857.56, -3658.47, 143.73 }, -- Crown Guard Tower, Eastern Plaguelands
  { 31, -4491.88, -775.89, -39.52 }, -- Thalanaar, Feralas
  { 56, -10456.97, -3279.25, 21.35 }, -- Stonard, Swamp of Sorrows
  { 29, 966.57, 1040.32, 104.27 }, -- Sun Rock Retreat, Stonetalon Mountains
  { 86, 2499.23, -4742.85, 93.5 }, -- Eastwall Tower, Eastern Plaguelands
  { 85, 3109.31, -4285.13, 109.45 }, -- Northpass Tower, Eastern Plaguelands
  { 37, 139.24, 1325.82, 193.5 }, -- Nijel's Point, Desolace
  { 69, 7470.39, -2123.38, 492.34 }, -- Moonglade
  { 17, -916.29, -3496.89, 70.45 }, -- Hammerfall, Arathi
  { 49, 7458.45, -2487.21, 462.33 }, -- Moonglade
  { 39, -7223.97, -3734.59, 8.39 }, -- Gadgetzan, Tanaris
  { 72, -6811.39, 836.74, 49.81 }, -- Cenarion Hold, Silithus
  { 53, 6813.06, -4611.12, 710.67 }, -- Everlook, Winterspring
  { 68, 2327.41, -5286.89, 81.78 }, -- Light's Hope Chapel, Eastern Plaguelands
  { 74, -6552.59, -1168.27, 309.31 }, -- Thorium Point, Searing Gorge
  { 18, -14444.29, 509.62, 26.2 }, -- Booty Bay, Stranglethorn
  { 63, 7787.72, -2404.1, 489.56 }, -- Nighthaven, Moonglade
}
