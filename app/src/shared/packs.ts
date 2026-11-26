// The icon packs of the map (M21-F4), chosen in Settings > Appearance: Twinmap's own pins (marks.ts), the game's, or
// Questie's. A pack draws the pins of the quests: to take, to hand in, and the objectives by what they ask for. None of
// their pictures is in the app: the game's are cut from the player's game beside the tiles (main/icons.ts), Questie's are
// its own files, read from its folder in the player's AddOns (main/index.ts). Where a pack has no picture, ours is drawn.

export const PACKS = ['twinmap', 'game', 'questie'] as const
export type Pack = (typeof PACKS)[number]

/** For each pin a pack draws, the name of its picture: under icons/ for the game's, under questie/ for Questie's. */
export const PACK_ICONS: Record<Exclude<Pack, 'twinmap'>, Record<string, string>> = {
  // The game's ! and ?, the gold dot its map marks an objective with, and for a creature to slay, a thing to loot and an
  // event the pictures its minimap gives them.
  game: { quest: 'game-quest', turnin: 'game-turnin', objective: 'game-objective', object: 'game-objective', talk: 'game-objective', slay: 'game-slay', loot: 'game-loot', event: 'game-event' },
  // Questie has no picture for an objective whose kind is not known: ours.
  questie: { quest: 'available', turnin: 'complete', slay: 'slay', loot: 'loot', object: 'object', talk: 'chatbubblegossipicon', event: 'event' },
}

/** The files of Questie the window may ask for, and nothing else of its folder. */
export const QUESTIE_ICONS = new Set(Object.values(PACK_ICONS.questie))
