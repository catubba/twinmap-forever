// The pack of icons the player chose for the quest pins of the map, in Settings > Appearance (M21-F4, shared/packs.ts).
// Kept by this window, as the arrow is: a phone chooses its own. A picture of a pack is asked the first time a pin
// needs it; until it came, and where it never comes (no game, no Questie), the pin is ours.
import { PACK_ICONS, PACKS, type Pack } from '../../shared/packs'
import { pin, pinSize, type PinName } from './marks'
import { TILES } from './web'

const kept = localStorage.getItem('icon-pack') as Pack | null
export const packs = $state({ chosen: kept && PACKS.includes(kept) ? kept : ('twinmap' as Pack), came: {} as Record<string, true> })

export function setPack(to: Pack): void {
  packs.chosen = to
  localStorage.setItem('icon-pack', to)
}

// The objectives as icons, or as areas in the style of the game's map (M21-F5): kept by this window, as the pack is.
export const objectiveLooks = ['icons', 'areas'] as const
export const objectives = $state({ look: localStorage.getItem('objective-look') === 'areas' ? 'areas' : ('icons' as (typeof objectiveLooks)[number]) })
export function setObjectiveLook(to: (typeof objectiveLooks)[number]): void {
  objectives.look = to
  localStorage.setItem('objective-look', to)
}

// The 2D map drawn from the minimap's pictures (our tiles) or as the game's own map (M21-F6, main/parchment.ts): kept by
// this window, as the pack is.
export const mapLooks = ['tiles', 'parchment'] as const
export const mapLook = $state({ look: localStorage.getItem('map-look') === 'parchment' ? 'parchment' : ('tiles' as (typeof mapLooks)[number]) })
export function setMapLook(to: (typeof mapLooks)[number]): void {
  mapLook.look = to
  localStorage.setItem('map-look', to)
}

const asked = new Set<string>()
/** Whether the picture at this address came; the first time, it is asked for. */
function came(url: string): boolean {
  if (!asked.has(url)) {
    asked.add(url)
    const picture = new Image()
    // A picture the game did not have comes as an empty one of a pixel (main/index.ts): not come.
    picture.onload = () => {
      if (picture.naturalWidth > 1) packs.came[url] = true
    }
    picture.src = url
  }
  return packs.came[url] === true
}
const urlOf = (pack: Exclude<Pack, 'twinmap'>, name: string): string => `${TILES}/${pack === 'game' ? 'icons' : 'questie'}/${name}.png`

/** Whether Questie's pack can be offered: its pictures are in the player's AddOns. */
export const questieHere = (): boolean => came(urlOf('questie', PACK_ICONS.questie.quest!))

// A pack's pictures are drawn a little larger than our pins: the ! and the ? as large as the game's on its map, the dot
// of an objective whose kind is not known as large as the others (ours is a small dot of 9 px).
const SIZES: Partial<Record<PinName, number>> = { quest: 22, turnin: 22, objective: 14 }
/** A quest pin as the chosen pack draws it: its size in px and its markup. */
export function questPin(name: PinName): [number, string] {
  const pack = packs.chosen, file = pack === 'twinmap' ? undefined : PACK_ICONS[pack][name]
  const url = pack !== 'twinmap' && file ? urlOf(pack, file) : null
  if (!url || !came(url)) return [pinSize(name), pin(name)]
  const size = SIZES[name] ?? pinSize(name)
  return [size, `<img src="${url}" width="${size}" height="${size}" alt="" draggable="false">`]
}
