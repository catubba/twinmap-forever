// The layers of the map, in the groups the Layers button shows. A layer that is not built yet is
// listed, greyed out: its turn comes with the data that fills it.
export const LAYER_GROUPS = [
  { name: 'You', layers: [{ id: 'arrow', name: 'Arrow', built: true }] },
  {
    name: 'Quests',
    layers: [
      { id: 'available', name: 'Available', built: false },
      { id: 'turnin', name: 'Turn in', built: false },
      { id: 'objectives', name: 'Objectives', built: false },
    ],
  },
  {
    name: 'Services',
    layers: [
      { id: 'flight', name: 'Flight', built: false },
      { id: 'inn', name: 'Inn', built: false },
      { id: 'vendors', name: 'Vendors', built: false },
      { id: 'repair', name: 'Repair', built: false },
      { id: 'trainers', name: 'Trainers', built: false },
      { id: 'bank', name: 'Bank', built: false },
      { id: 'auction', name: 'Auction', built: false },
      { id: 'stable', name: 'Stable', built: false },
    ],
  },
  {
    name: 'Resources',
    layers: [
      { id: 'ore', name: 'Ore', built: false },
      { id: 'herbs', name: 'Herbs', built: false },
    ],
  },
  {
    name: 'World',
    layers: [
      { id: 'zones', name: 'Place names', built: true },
      { id: 'dungeons', name: 'Dungeons', built: false },
      { id: 'bosses', name: 'Bosses in a dungeon', built: true },
    ],
  },
] as const

export type LayerId = (typeof LAYER_GROUPS)[number]['layers'][number]['id']
export type LayerChoices = Record<LayerId, boolean>

/** The player's choices as they were saved, every layer on where nothing readable says otherwise. */
export function layersFrom(saved: string | null): LayerChoices {
  let kept: Record<string, unknown> = {}
  try {
    const read: unknown = JSON.parse(saved ?? '')
    if (typeof read === 'object' && read) kept = read as Record<string, unknown>
  } catch {
    // nothing saved yet, or not ours
  }
  const choices = {} as LayerChoices
  for (const group of LAYER_GROUPS) for (const layer of group.layers) choices[layer.id] = kept[layer.id] !== false
  return choices
}
