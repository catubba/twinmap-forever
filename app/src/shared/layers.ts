// The layers of the map, in the groups the Layers button shows. A layer that is not built yet is
// listed, greyed out: its turn comes with the data that fills it.
import { t } from './i18n'

export const LAYER_GROUPS = [
  { id: 'you', layers: [{ id: 'arrow', built: true }, { id: 'route', built: true }, { id: 'mypins', built: true }, { id: 'death', built: true }] },
  {
    id: 'quests',
    layers: [
      { id: 'available', built: true },
      { id: 'turnin', built: true },
      { id: 'objectives', built: true },
      { id: 'lowlevel', built: true }, // not a layer of its own: off, the quests to take that already give less XP are left out
    ],
  },
  {
    id: 'services',
    layers: [
      { id: 'flight', built: true },
      { id: 'inn', built: true },
      { id: 'vendors', built: true },
      { id: 'repair', built: true },
      { id: 'trainers', built: true },
      { id: 'bank', built: true },
      { id: 'auction', built: true },
      { id: 'stable', built: true },
    ],
  },
  {
    id: 'resources',
    layers: [
      { id: 'ore', built: true },
      { id: 'herbs', built: true },
    ],
  },
  {
    id: 'world',
    layers: [
      { id: 'zones', built: true },
      { id: 'relief', built: true },
      { id: 'caves', built: true },
      { id: 'dungeons', built: true },
      { id: 'routes', built: true },
      { id: 'vessels', built: true },
      { id: 'bosses', built: true },
    ],
  },
  { id: 'group', layers: [{ id: 'companions', built: true }] },
] as const

export type LayerId = (typeof LAYER_GROUPS)[number]['layers'][number]['id']
export type LayerChoices = Record<LayerId, boolean>
export type GroupId = (typeof LAYER_GROUPS)[number]['id']

// The ids are kept in the player's choices: the names shown come from the English file and its languages.
export const layerName = (id: LayerId): string => t(`map.layers.names.${id}`)
export const groupName = (id: GroupId): string => t(`map.layers.groups.${id}`)

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
