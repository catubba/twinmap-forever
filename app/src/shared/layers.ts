// The layers of the map, in the groups the Layers button shows. A layer that is not built yet is
// listed, greyed out: its turn comes with the data that fills it.
export const LAYER_GROUPS = [
  { name: 'You', layers: [{ id: 'arrow', name: 'Arrow', built: true }, { id: 'route', name: 'Route', built: true }, { id: 'mypins', name: 'My pins', built: true }] },
  {
    name: 'Quests',
    layers: [
      { id: 'available', name: 'Available', built: true },
      { id: 'turnin', name: 'Turn in', built: true },
      { id: 'objectives', name: 'Objectives', built: true },
    ],
  },
  {
    name: 'Services',
    layers: [
      { id: 'flight', name: 'Flight', built: true },
      { id: 'inn', name: 'Inn', built: true },
      { id: 'vendors', name: 'Vendors', built: true },
      { id: 'repair', name: 'Repair', built: true },
      { id: 'trainers', name: 'Trainers', built: true },
      { id: 'bank', name: 'Bank', built: true },
      { id: 'auction', name: 'Auction', built: true },
      { id: 'stable', name: 'Stable', built: true },
    ],
  },
  {
    name: 'Resources',
    layers: [
      { id: 'ore', name: 'Ore', built: true },
      { id: 'herbs', name: 'Herbs', built: true },
    ],
  },
  {
    name: 'World',
    layers: [
      { id: 'zones', name: 'Place names', built: true },
      { id: 'dungeons', name: 'Dungeons', built: true },
      { id: 'routes', name: 'Flight routes', built: true },
      { id: 'bosses', name: 'Bosses in a dungeon', built: true },
    ],
  },
  { name: 'Group', layers: [{ id: 'companions', name: 'Companions', built: true }] },
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
