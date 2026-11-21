<script lang="ts">
  // The map: the game's own pictures of the two continents, the names of the zones, and the
  // character as an arrow. It follows the character until the player drags the map away.
  // Inside a dungeon or a raid it shows that instead: its rooms, its bosses, its entrance.
  import { TILES } from './web'
  import { layout as sides, setMapRight } from './layout.svelte'
  import type { Terrain } from './terrain3d'
  import type { Compass } from './compass'
  import { Arrow3d } from './arrow3d'
  import type { Inside3d } from './inside3d'
  import { Names3d } from './names3d'
  import { ARC, paintFixed, Pins3d, ROUTE } from './pins3d'
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import 'leaflet-rotate' // after Leaflet: it adds turning the map to the L that Leaflet puts on the page
  import { onMount, untrack } from 'svelte'
  import { DUNGEON_PINS } from '../../shared/dungeon-pins'
  import { NEW_DUNGEON_PINS } from '../../shared/new-dungeon-pins'
  import { MORE_BOSS_PINS } from '../../shared/more-boss-pins'
  import type { Position } from '../../shared/game'
  import { coloursFor, type Companion } from '../../shared/group'
  import { clearOf, gathered, unitsOfPlace, unitsOfRect, type Point } from '../../shared/geo'
  import { addFix, BEHIND, PERIOD, TURN, turnAt, whereAt, type Fix, type Turn } from '../../shared/glide'
  import { boxOf, buildingsAt, killedIn, nameOfBoss, piecesIn, RARE_BOSSES, roomPixels, yardsInside, YARDS_PER_UNIT, type Box, type InteriorMap, type Interiors, type Piece, type UnderRoom, type Yards } from '../../shared/inside'
  import type { Continent, GameMap } from '../../shared/maps'
  import type { QuestPin } from '../../shared/quests'
  import { iconOf, panelFor, serves, type FixedLayer, type FixedPin, type Travel } from '../../shared/services'
  import { pictureOfBlock, tileOfPicture } from '../../shared/pixels'
  import { WORLDS } from '../../shared/world'
  import { LAYER_GROUPS, layersFrom, type LayerId } from '../../shared/layers'
  import { fitNames, tierRank, tierShows, type Avoid, type NameBox, type NameTier, type Place } from '../../shared/places'
  import { wayTo, zoneAt, type Size } from '../../shared/point-label'
  import { fade, fly } from 'svelte/transition'
  import Glyph from './Glyph.svelte'
  import { drop, gone, still } from './motion'
  import PointLabel from './PointLabel.svelte'
  import { inRoute, noRoute, type Route, type Stop } from '../../shared/route'
  import { legsOn, type Journey, type WayLeg } from '../../shared/journey'
  import { ahead as restOf } from '../../shared/walk'
  import { deathPlaces, type Death, type Place as DeathPlace } from '../../shared/death'
  import { feet } from './feet.svelte'
  import { kept as keptByApp } from './kept.svelte'
  import { ARRIVE, pinOfMark, removePin, renamePin, savedAt, savedFrom, savePin, yardsBetween, type SavedPin } from '../../shared/saved'
  import { markPart, sendState, type GameMark, type Inbox, type Pin } from '../../shared/send'
  import { companionPin, pin, pinSize, type PinName } from './marks'

  // at: when the position was read off the game, in milliseconds.
  // insideReady: the rooms of the buildings are converted, and their list can be asked for.
  let { pos, group = [], at: readAt, insideReady, quests = [], fixed = [], side, live = false, inbox = null, removed = [], set = [], gameFollows = null, journey = null, route = noRoute(), onroute, onnpc, kills, death = null, back = $bindable(null), looking = $bindable(null) }: { kills?: unknown; death?: Death | null; back?: (DeathPlace & { name: string; door: boolean }) | null; looking?: { zone: string; where: string } | null; journey?: Journey | null; pos: Position | undefined; at: number | undefined; insideReady: boolean; quests?: QuestPin[]; fixed?: FixedPin[]; side?: string; live?: boolean; inbox?: Inbox | null; removed?: string[]; set?: GameMark[]; gameFollows?: Pin | null; route?: Route; onroute?: (stop: Stop) => void; onnpc?: (pin: FixedPin | null) => void; group?: Companion[] } = $props()

  const TOP_ZOOM = 7 // the game's own detail: a block's picture is four tiles
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
  const NAMES: Record<Continent, string> = { 0: 'Eastern Kingdoms', 1: 'Kalimdor' }
  // Two cities lie wholly under a roof, though the game calls them outdoors (one can ride there).
  // Ironforge is always on the map from the inside: what is above it is bare mountain, and the
  // player looks for the city there. Undercity shows only from within, as a cave does: above it
  // are the ruins of Lordaeron, which are a place of their own. Both by the id of their map.
  const ALWAYS_INSIDE = [1455]
  const ROOFED = new Set([1458])
  const CITY_UNDER = 3e6 // square yards: a zone map smaller than this is a city
  const PIN_ZOOM = 3.5 // under this zoom the pins of a zone lie on each other: they are not shown
  const GATHER = 26 // pixels: from far, the quests to take (or to hand in) nearer than this to each other are one pin
  const QUEST_ZOOM = 2 // the quests to take and to hand in are few: they are shown from farther, as the doors of the dungeons are
  const FAR = 3 // under this zoom the names of the regions are written small
  const EDGE = 14 // px from the edge of the map's box that a name keeps clear: the frame and a little air
  const GROUND_INSIDE = 0.45 // how bright the ground of a dungeon is: its rooms are what matters

  let holder: HTMLDivElement
  let map: L.Map | undefined
  let maps = $state<GameMap[]>([])
  let continent = $state<Continent>(0)
  let following = $state(true)
  let zoom = $state(2)
  let offMap = $state(false)
  let interiors: Interiors | undefined
  // The dungeon or raid on show, and how many of its levels: a room is a level up when it lies over another.
  let inside = $state<InteriorMap | null>(null)
  let levels = $state(0)
  let upTo = $state(0)
  let pinned = $state(false)
  // A dungeon or a raid opened from outside it (the button on its door, the search): the map shows it
  // until Back, or until the character goes into an instance or out of one. inst: the one the
  // character was in then. The rest is the view to go back to, and its name.
  let browsing = $state<{ inst: number | null; continent: Continent; center: L.LatLng; zoom: number; following: boolean; dungeon: boolean; from: string } | null>(null)

  // The layers the player wants on the map: remembered from one run of the app to the next.
  let layers = $state(layersFrom(localStorage.getItem('layers')))
  let layersOpen = $state(false)
  // The point the player clicked, with its label: in map units, and where that is in the map's box now.
  // pin: the same point as the game names it, a zone map and a place on it; none where no zone is.
  let labelled = $state<{ units: Point; continent: Continent; title: string; where: string; spot: Point; box: Size; pin: { m: number; x: number; y: number } | null; plain?: boolean; notes?: string[]; dungeons?: { id: number; name: string; raid: boolean }[]; wing?: string; item?: number; npc?: FixedPin } | null>(null)
  // A vendor or a trainer labelled: its panel opens at the top of the side panel (NpcPanel.svelte).
  const labelledNpc = $derived(labelled?.npc ?? null)
  $effect(() => onnpc?.(labelledNpc))
  // Where the character is on the world map, for the distance on the label.
  let me = $state<{ units: Point; continent: Continent } | null>(null)
  // The yards and the time are those of the way on foot, where one is found: asked for the one point, again every few dozen yards.
  const toLabel = feet(() => (labelled && me && me.continent === labelled.continent ? { continent: me.continent, from: me.units, to: [labelled.units], reach: 20_000 } : null), 40)
  const way = $derived(labelled && me && me.continent === labelled.continent ? wayTo(me.units, labelled.units, toLabel.yards(labelled.units)) : null)
  // My pins: the points the player saved, kept by the app from one run to the next and for every screen that shows it.
  const keptPins = keptByApp('pins', savedFrom)
  const myPins = $derived(keptPins.value)
  const setPins = (to: SavedPin[]): void => {
    keptPins.value = to
  }
  // The game draws the same pins on its own map: it is told them all at every change. removed: the
  // ones the player removed there, which are forgotten here too. Only when that list changes: a
  // point saved again while the game still names it is kept. set: the ones the player set there
  // with Alt and a click, which become temporary pins here; the game is told they were taken, with the pins.
  // Nothing of this before the app has said which pins it keeps: no pins yet is not the player's word.
  let taken = $state.raw<string[]>([])
  $effect(() => {
    if (keptPins.heard) void window.twinmap.sendMarks(myPins.flatMap((p) => (p.pin ? [{ ...p.pin, name: p.name }] : [])), taken)
  })
  const setNow = $derived(JSON.stringify(set))
  $effect(() => {
    const marks = JSON.parse(setNow) as GameMark[]
    if (maps.length === 0 || !keptPins.heard) return // the maps say where a mark of the game is on ours
    untrack(() => {
      let pins = myPins
      for (const mark of marks) {
        const pin = pinOfMark(maps, mark)
        if (pin) pins = savePin(pins, { ...pin, temp: true })
      }
      setPins(pins)
      taken = marks.map((mark) => mark.id)
    })
  })
  const goneNow = $derived(removed.join(' '))
  $effect(() => {
    const parts = new Set(goneNow.split(' '))
    if (!keptPins.heard) return
    untrack(() => {
      const left = myPins.filter((p) => !(p.pin && parts.has(markPart(p.pin))))
      if (left.length < myPins.length) setPins(left)
    })
  })
  // A temporary pin goes once the character gets there, in the game too; and the label of a point
  // sent to the game with it, unless the point is saved. Only once the character was further away:
  // a pin set where the character stands stays until it has left.
  const away = new Set<string>()
  const keyOf = (continent: Continent, at: Point): string => `${continent} ${at.x} ${at.y}`
  let sentTo: string | null = null // the point of the last Send to game from a label
  $effect(() => {
    const here = me, pins = myPins // a pin set while the character stands far from it is counted at once
    if (!here || !keptPins.heard) return
    untrack(() => {
      const reached = (continent: Continent, at: Point): boolean => {
        if (continent !== here.continent) return false
        const key = keyOf(continent, at)
        if (yardsBetween(at, here.units) <= ARRIVE) return away.has(key)
        away.add(key)
        return false
      }
      const left = pins.filter((p) => !(p.temp && reached(p.continent, p.at)))
      if (left.length < pins.length) setPins(left)
      if (labelled && !savedForGood && sentTo === keyOf(labelled.continent, labelled.units) && reached(labelled.continent, labelled.units)) {
        labelled = null
        sentTo = null
      }
    })
  })
  // The labelled point as one of them, or -1; and the point under the name it goes by: a saved one has its own.
  // A temporary pin has its name too, but is not saved: its label offers Save.
  const savedIndex = $derived(labelled ? savedAt(myPins, labelled.continent, labelled.units) : -1)
  const savedForGood = $derived(savedIndex >= 0 && !myPins[savedIndex]!.temp)
  const pointName = $derived(!labelled ? '' : savedIndex >= 0 ? myPins[savedIndex]!.name : labelled.plain ? `${labelled.title} ${labelled.where}` : labelled.title)
  const asStop = (): Stop | null => labelled && { name: pointName, continent: labelled.continent, at: { ...labelled.units }, pin: labelled.pin && { ...labelled.pin } }

  // Leaflet's plain coordinates: a map unit is a pixel of zoom 0, north is up.
  // A point of a way on foot keeps how high the way is there: the 3D view puts the line on that floor (pins3d.ts).
  const at = (p: Point & { z?: number }): L.LatLng => L.latLng(-p.y, p.x, p.z)
  const atYards = (y: Yards): L.LatLng => at({ x: y.u / YARDS_PER_UNIT, y: y.v / YARDS_PER_UNIT })
  const boundsOf = (m: GameMap): L.LatLngBounds => {
    const [a, b] = unitsOfRect(m.rect!)
    return L.latLngBounds(at(a), at(b))
  }
  const boundsOfBox = ([u1, v1, u2, v2]: Box): L.LatLngBounds => L.latLngBounds(atYards({ u: u1, v: v1 }), atYards({ u: u2, v: v2 }))
  const WORLD_BOUNDS = L.latLngBounds([-256, 0], [0, 256])
  // The map's size as Leaflet keeps it: the box itself, read at every move, made the page lay itself out again each time.
  const frameSize = (): Size => {
    const size = map!.getSize()
    return { width: size.x, height: size.y }
  }

  // A file of the map as the converter keeps it, deflated; null where there is none.
  const inflated = (url: string): Promise<Uint8Array<ArrayBuffer> | null> =>
    fetch(url)
      .then(async (answer) => (answer.ok && answer.body ? new Uint8Array(await new Response(answer.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()) : null))
      .catch(() => null)
  // Keeps the last few of what is slow to make: the same one is asked for again and again.
  function kept<K, V>(most: number, make: (key: K) => V): (key: K) => V {
    const made = new Map<K, V>()
    return (key) => {
      if (!made.has(key)) {
        made.set(key, make(key))
        if (made.size > most) made.delete(made.keys().next().value!)
      }
      return made.get(key)!
    }
  }

  // The pictures of the blocks, decoded, for the tiles of the two top levels (0.8 MB each): the four
  // tiles of a block ask for the same one, and so does coming back to it.
  const block = kept(40, (url: string) => inflated(url).then((dxt) => dxt && pictureOfBlock(dxt)))

  // Zoom 6 and 7 are drawn from the game's own blocks; past 7 Leaflet stretches them.
  const BlockLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer & { options: { world: string } }, coords: L.Coords, done: L.DoneCallback) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const top = coords.z === TOP_ZOOM
      const column = top ? coords.x >> 1 : coords.x, row = top ? coords.y >> 1 : coords.y
      void block(`${TILES}/${this.options.world}/blocks/${column}/${row}.dxt`).then((picture) => {
        if (picture) {
          const rgb = tileOfPicture(picture, top ? (coords.x & 1) + (coords.y & 1) * 2 : undefined)
          const image = new ImageData(256, 256)
          for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
            image.data[o] = rgb[i]!
            image.data[o + 1] = rgb[i + 1]!
            image.data[o + 2] = rgb[i + 2]!
            image.data[o + 3] = 255
          }
          canvas.getContext('2d')!.putImageData(image, 0, 0)
        }
        done(undefined, canvas)
      })
      return canvas
    },
  }) as unknown as new (options: L.GridLayerOptions & { world: string }) => L.GridLayer

  // The picture of a room, decoded with its shape cut out, by its file and its proportions (width
  // over height). Its pixels: the file holds half a byte each.
  const room = kept(600, (wanted: string) => {
    const [file, proportions] = wanted.split(':')
    return inflated(`${TILES}/rooms/${file}.dxt`).then((dxt) => {
      if (!dxt) return null
      const width = Math.round(Math.sqrt(dxt.length * 2 * Number(proportions))), height = (dxt.length * 2) / width
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.putImageData(new ImageData(roomPixels(dxt, width, height), width, height), 0, 0)
      return canvas
    })
  })
  const roomOf = (p: Piece): Promise<HTMLCanvasElement | null> => room(`${p.file}:${p.width / p.height}`)

  // The rooms of a map: each tile is drawn from the pictures that reach into it, each turned as its
  // building stands, the lower ones first.
  const RoomsLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer & { options: { pieces: Piece[] } }, coords: L.Coords, done: L.DoneCallback) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const yardsPerPixel = YARDS_PER_UNIT / 2 ** coords.z, side = 256 * yardsPerPixel
      const u0 = coords.x * side, v0 = coords.y * side
      const here = piecesIn(this.options.pieces, [u0, v0, u0 + side, v0 + side])
      void Promise.all(here.map(roomOf)).then((pictures) => {
        const g = canvas.getContext('2d')!
        here.forEach((p, i) => {
          const picture = pictures[i]
          if (!picture) return
          g.setTransform(1, 0, 0, 1, 0, 0)
          g.translate((p.u - u0) / yardsPerPixel, (p.v - v0) / yardsPerPixel)
          g.rotate(-p.angle) // the canvas turns clockwise
          g.drawImage(picture, -p.width / 2 / yardsPerPixel, -p.height / 2 / yardsPerPixel, p.width / yardsPerPixel, p.height / yardsPerPixel)
        })
        done(undefined, canvas)
      })
      return canvas
    },
  }) as unknown as new (options: L.GridLayerOptions & { pieces: Piece[] }) => L.GridLayer

  let shown: L.Layer[] = []
  let rooms: L.Layer | undefined
  // The names written over the map, the most important first; layout() decides which of them show.
  const labels = L.layerGroup()
  let named: { tier: NameTier; text: string; at: L.LatLng; marker: L.Marker; sizes: Record<string, [number, number]> }[] = []
  // The same names on the 3D view (names3d.ts), and what they keep clear of there: the buttons and the readout.
  let names3d: Names3d | undefined
  let avoid3d: Avoid[] = []
  const names3dSet = (): void => names3d?.set(named.map((n) => ({ tier: n.tier, text: n.text, x: n.at.lng * YARDS_PER_UNIT, z: -n.at.lat * YARDS_PER_UNIT })))
  let places: Place[] = []
  const pins = L.layerGroup()
  const arrow = L.marker([0, 0], {
    zIndexOffset: 5000, // over every pin and the ring of a label: the character is never under anything
    interactive: false,
    keyboard: false, // nothing to do on it: not a stop for Tab
    icon: L.divIcon({
      className: 'me',
      iconSize: [28, 28],
      html: pin('player'),
    }),
  })
  // Under something it can walk on (a bridge, the floor above, the rock over a mine) the arrow
  // fades, a little: the map shows what is on top. The walk worker follows the floor it stands on
  // from point to point; an answer that comes after a newer point is dropped.
  const BELOW = 0.6
  let tracked = 0
  let floorAt: number | null = null // the height the character stands at: on a bridge the 3D arrow is put there
  $effect(() => {
    const here = me
    const asked = ++tracked
    if (!here) return void (arrow.setOpacity(1), (floorAt = null))
    void window.twinmap.walkTrack({ continent: here.continent, at: { x: here.units.x, y: here.units.y }, indoors: untrack(() => pos?.indoors === true) }).then((floors) => {
      if (asked !== tracked) return
      arrow.setOpacity(floors && floors.over > 0 ? BELOW : 1)
      floorAt = floors?.z ?? null
    })
  })

  // Where the arrow is to point, in degrees clockwise from north, and its turn there: in a quarter of a second at an
  // even pace (turnAt, glide.ts), drawn frame by frame with the bearing of the map under it (spin).
  let turned = 0
  let turn2d: Turn = { from: 0, to: 0, at: 0 }
  function turnTo(degrees: number): void {
    const to = turned + ((((degrees - turned) % 360) + 540) % 360) - 180 // the short way round
    if (to === turned) return // the same facing told again: the turn under way goes on as it is
    const now = performance.now()
    turn2d = { from: turnAt(turn2d, now), to: (turned = to), at: now }
    spinSoon()
  }

  // The 2D map turned (leaflet-rotate): its bearing is the way at the top, in degrees anticlockwise from north as the
  // game counts its facing. With the character, heading up: the bearing keeps to the arrow, so the arrow points up.
  // North up asked: it goes back to 0. Each a fifth of the way at every frame from far off, as the 3D view does.
  let northing = false
  let spinning = 0
  const spinSoon = (): void => {
    spinning ||= requestAnimationFrame(spin)
  }
  function spin(): void {
    spinning = 0
    if (!map) return
    const now = performance.now(),
      pointing = turnAt(turn2d, now),
      bearing = map.getBearing(),
      aim = threeD ? null : turning ? -pointing : northing ? 0 : null
    let next = bearing
    if (aim !== null) {
      // Near enough is there: a hundredth of a degree is not seen, and every turn of the map fits its names again.
      const off = ((((aim - bearing) % 360) + 540) % 360) - 180
      if (Math.abs(off) >= 0.01) map.setBearing((next = bearing + (Math.abs(off) < 9 ? off : off * 0.2)))
      else if (northing) northing = false
    }
    const svg = arrow.getElement()?.firstElementChild as SVGElement | null
    if (svg) svg.style.transform = `rotate(${pointing + next}deg)`
    if (!threeD) compassAt(next)
    if (now - turn2d.at < TURN || (aim !== null && Math.abs(((((aim - next) % 360) + 540) % 360) - 180) >= 0.01)) spinSoon()
  }

  // The ground of a continent or of a dungeon, from its folder. The halved tiles stay under
  // everything at every zoom, stretched past their own detail: while the sharp tiles of a place are
  // still being read, the map shows it blurred, never black. The game's own blocks go on top, from
  // halfway between the two kinds of tile up.
  function ground(folder: string, opacity = 1): void {
    if (!map) return
    for (const layer of shown) layer.remove()
    shown = [
      L.tileLayer(`${TILES}/${folder}/{z}/{x}/{y}.png`, { minZoom: 0, maxZoom: 9, maxNativeZoom: TOP_ZOOM - 2, bounds: WORLD_BOUNDS, errorTileUrl: BLANK, keepBuffer: 4, zIndex: 1, opacity }),
      new BlockLayer({ world: folder, minZoom: TOP_ZOOM - 1.5, minNativeZoom: TOP_ZOOM - 1, maxNativeZoom: TOP_ZOOM, bounds: WORLD_BOUNDS, keepBuffer: 3, zIndex: 2, opacity }),
    ]
    // Under the 3D view no ground is drawn: its tiles would be read and decoded for nothing.
    if (!threeD) for (const layer of shown) layer.addTo(map)
  }

  // The shaded relief of the continent on show (main/heights.ts), over its ground and under the
  // rooms, in soft light: its grey of level ground leaves the map as it is. Once the list of the
  // maps is in, the continent is on show: the map itself is not watched, so it is looked at last.
  let relief: L.Layer | undefined
  $effect(() => {
    relief?.remove()
    const world = WORLDS.find((w) => w.continent === continent)
    relief = maps.length > 0 && layers.relief && !inside && !threeD && world && map ? L.tileLayer(`${TILES}/${world.name}/shade/{z}/{x}/{y}.png`, { minZoom: 0, maxZoom: 9, maxNativeZoom: 6, bounds: WORLD_BOUNDS, errorTileUrl: BLANK, keepBuffer: 4, zIndex: 3, className: 'relief' }).addTo(map) : undefined
  })

  // Puts these rooms on the map, in place of the ones before.
  function showRooms(pieces: Piece[]): void {
    rooms?.remove()
    const box = boxOf(pieces)
    rooms = map && box ? new RoomsLayer({ pieces, bounds: boundsOfBox(box), keepBuffer: 2, zIndex: 4 }).addTo(map) : undefined
  }

  // The cities that are always shown from the inside, on the continent on show: the rooms of
  // whatever building stands at the middle of their map. Needs the list of the rooms.
  let cities: L.Layer | undefined
  function showCities(): void {
    cities?.remove()
    cities = undefined
    const world = inside ? undefined : interiors?.maps.find((m) => m.kind === 'world' && m.id === continent)
    if (!map || !world) return
    const buildings = new Set<number>()
    for (const id of ALWAYS_INSIDE) {
      const zone = maps.find((m) => m.id === id)
      if (!zone?.rect || zone.continent !== continent) continue
      const middle = unitsOfPlace(zone.rect, 50, 50)
      for (const b of buildingsAt(world.pieces, middle.x * YARDS_PER_UNIT, middle.y * YARDS_PER_UNIT)) buildings.add(b)
    }
    const pieces = world.pieces.filter((p) => buildings.has(p.building)), box = boxOf(pieces)
    // Not from far away: there a city is a few pixels, and its hundred pictures would be read for nothing.
    // 2.5 and not 3: at the half level under a whole minZoom Leaflet draws these tiles while the map moves and takes them away when it stops.
    if (box) cities = new RoomsLayer({ pieces, bounds: boundsOfBox(box), minZoom: 2.5, keepBuffer: 2, zIndex: 4 }).addTo(map)
  }

  // The caves and the mines of the continent on show, seen from outside: the rooms of the buildings
  // that lie under the ground (caves.json, main/caves.ts), over the terrain and see-through. Only
  // from close up: from far away a mine is a few pixels. A layer of its own, Caves. Where the
  // character is, under a roof, the rooms of that building are drawn whole over these.
  const CAVES_ZOOM = 7 // about a pixel a yard: a mine is a hundred pixels across
  const CAVES_OPACITY = 0.65 // the hill over the cave shows through
  let buried: Record<string, number[]> | undefined
  let caves: L.Layer | undefined
  function showCaves(): void {
    caves?.remove()
    caves = undefined
    const world = inside || !layers.caves ? undefined : interiors?.maps.find((m) => m.kind === 'world' && m.id === continent)
    const under = new Set(world && buried?.[continent])
    if (!map || !world || !under.size) return
    const pieces = world.pieces.filter((p) => under.has(p.building)), box = boxOf(pieces)
    if (box) caves = new RoomsLayer({ pieces, bounds: boundsOfBox(box), keepBuffer: 2, zIndex: 4, opacity: CAVES_OPACITY, className: 'caves' })
    fitCaves()
  }
  // On the map from CAVES_ZOOM up, and off it below, by hand. A layer's own minZoom is not used: half
  // a level under it Leaflet draws the tiles of the level above while the map moves and takes them
  // away when it stops, so the caves flickered while the map was dragged.
  function fitCaves(): void {
    if (!map || !caves) return
    if (map.getZoom() < CAVES_ZOOM) caves.remove()
    else if (!map.hasLayer(caves)) caves.addTo(map)
  }
  $effect(() => {
    void layers.caves
    void inside
    showCaves()
  })

  // What the middle of the map shows, for the readout, while the map does not follow the character:
  // someone moving the map to explore reads what is being looked at, not where the character stands.
  function look(): void {
    if (browsing && inside) return void (looking = { zone: inside.name, where: '' }) // a dungeon opened from outside: its name, not the character's place
    if (!map || following || inside) return void (looking = null)
    // From far, where the pins of a zone are not shown, it is the continent that is looked at, not the zone in its middle.
    const middle = map.getCenter(), found = map.getZoom() < PIN_ZOOM ? null : zoneAt(maps, continent, { x: middle.lng, y: -middle.lat })
    looking = { zone: found?.zone.name ?? NAMES[continent], where: found ? `${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : '' }
  }
  $effect(look) // following, the continent on show, a dungeon entered or left, or opened from outside

  // Writes the names of the continent on show: its regions, its towns, its points
  // of interest and the areas of its zones. A city has a map of its own but is not a region:
  // its name comes with the towns.
  function writeNames(): void {
    labels.clearLayers()
    named = []
    const name = (tier: NameTier, text: string, at: L.LatLng): void => {
      const html = `<span>${text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`
      named.push({ tier, text, at, sizes: {}, marker: L.marker(at, { interactive: false, keyboard: false, icon: L.divIcon({ className: `place ${tier}`, html, iconSize: [0, 0] }) }).addTo(labels) })
    }
    const zones = maps.filter((m) => m.level === 'zone' && m.continent === continent && m.rect)
    // ponytail: a city is told from a region by the size of its map (Stormwind, the largest, is 2.0 million
    // square yards; Moonglade, the smallest region, 3.5). Read the kind of area from the game if a city ever outgrows this.
    for (const m of zones) if ((m.rect!.maxX - m.rect!.minX) * (m.rect!.maxY - m.rect!.minY) > CITY_UNDER) name('region', m.name, boundsOf(m).getCenter())
    for (const p of places) if (p.continent === continent) name(p.kind, p.name, at(p))
    named.sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
    names3dSet()
    layout()
  }

  // Which names show: the kinds that belong to this zoom, none touching another or the arrow.
  // A name fades in and out as it gains and loses its place.
  function layout(): void {
    if (!map) return
    if (!layers.zones || inside) return void labels.remove()
    labels.addTo(map)
    const view = map, zoom = view.getZoom(), size = view.getSize(), boxes: NameBox[] = []
    // From far away the regions are written smaller, so that most of them fit on a whole continent.
    const scale = zoom < FAR ? 'far' : 'near'
    holder.classList.toggle('far', scale === 'far')
    named.forEach((n, id) => {
      const span = n.marker.getElement()?.firstElementChild as HTMLElement | null
      if (!span || !tierShows(n.tier, zoom)) return
      const p = view.latLngToContainerPoint(n.at)
      // A little past the edges too, so a name is there already when the map is dragged to it.
      if (p.x < -300 || p.y < -200 || p.x > size.x + 300 || p.y > size.y + 200) return
      const [width, height] = (n.sizes[scale] ??= [span.offsetWidth, span.offsetHeight])
      if (!width) return void delete n.sizes[scale] // not drawn yet: measured the next time
      // Whole inside the frame, or not at all: half a name under the moulding reads as a mistake.
      const whole = p.x - width / 2 >= EDGE && p.x + width / 2 <= size.x - EDGE && p.y - height / 2 >= EDGE && p.y + height / 2 <= size.y - EDGE
      if (whole) boxes.push({ id, x: p.x, y: p.y, width, height })
    })
    // Kept clear: the arrow, and what is written or pressed over the map (the zone and its coordinates, the buttons).
    const frame = holder.getBoundingClientRect()
    const clear = [...holder.parentElement!.querySelectorAll('.corner, .readout')].map((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left - frame.left, top: r.top - frame.top, right: r.right - frame.left, bottom: r.bottom - frame.top }
    })
    avoid3d = [...clear]
    const me = view.hasLayer(arrow) ? view.latLngToContainerPoint(arrow.getLatLng()) : null
    if (me) clear.push({ left: me.x - 18, top: me.y - 18, right: me.x + 18, bottom: me.y + 18 })
    const shown = fitNames(boxes, clear)
    named.forEach((n, id) => n.marker.getElement()?.classList.toggle('on', shown.has(id)))
  }
  // The arrow and the map that follows it move at every frame: the names are laid out a moment
  // later, once for all the moves of that moment.
  let laying = 0
  const layoutSoon = (): void => {
    laying ||= window.setTimeout(() => {
      laying = 0
      layout()
    }, 150)
  }

  // Puts a continent on the map: its tiles and the names written over it.
  function show(which: Continent, fit: boolean): void {
    if (!map) return
    ground(WORLDS.find((w) => w.continent === which)!.name)
    inside = null
    browsing = null
    if (labelled && labelled.continent !== which) labelled = null
    showRooms([])
    under = ''
    pins.clearLayers()
    continent = which
    writeNames()
    showCities()
    showCaves()
    const whole = maps.find((m) => m.level === 'continent' && m.continent === which && m.parent !== 0)
    // At once: a zoom still running would end by putting this view back over whatever came after it.
    if (fit && whole?.rect) map.fitBounds(boundsOf(whole), { animate: false })
  }

  // The bosses on the map of the dungeon on show, and which of them the addon tells are killed: a
  // boss killed is drawn dark with a red cut across, and its name is struck out.
  // The door of a dungeon or a raid: the swirl the game's own maps mark it with, from the player's game (blue for
  // a dungeon, green for a raid), larger than the other pins so that it stands out. The picture has a glow around
  // the swirl, which is about half of it. Where the game's picture is not there, the drawn door.
  const DOOR = 44
  function doorIcon(raid: boolean): L.DivIcon {
    const mark = document.createElement('div'), picture = new Image(DOOR, DOOR)
    mark.className = 'swirl'
    picture.alt = ''
    picture.onerror = () => (mark.innerHTML = pin('dungeon'))
    picture.src = `${TILES}/icons/${raid ? 'raid' : 'dungeon'}.png`
    mark.append(picture)
    return L.divIcon({ className: 'door', iconSize: [DOOR, DOOR], html: mark })
  }
  const bossIcon = (gone: boolean, rare: boolean): L.DivIcon => {
    const size = rare ? 26 : 22
    return L.divIcon({ className: gone ? 'door' : 'door boss', iconSize: [size, size], html: pin(rare ? (gone ? 'rareSlain' : 'rareBoss') : gone ? 'slain' : 'boss') })
  }
  let bosses = $state.raw<{ name: string; rare: boolean; marker: L.Marker; gone?: boolean }[]>([])
  const dead = $derived(killedIn(kills, inside?.id))
  $effect(() => {
    for (const boss of bosses) {
      const gone = dead.has(nameOfBoss(boss.name))
      if (gone === boss.gone) continue // the section comes again and again, unchanged
      boss.gone = gone
      boss.marker.setIcon(bossIcon(gone, boss.rare))
      // The name is there already: its look changes where it is, and for when it is drawn again.
      const name = boss.marker.getTooltip()
      if (name) name.options.className = gone ? 'boss-name dead' : 'boss-name'
      name?.getElement()?.classList.toggle('dead', gone)
    }
  })

  // Puts a dungeon or a raid on the map: its ground dimmed, its rooms, its bosses and its entrance.
  // wing: of a map with several, the one to put in view.
  function showInside(m: InteriorMap, wing?: string): void {
    if (!map) return
    if (m.ground) ground(m.ground, GROUND_INSIDE)
    else {
      for (const layer of shown) layer.remove()
      shown = []
    }
    labels.clearLayers()
    named = []
    pins.clearLayers()
    inside = m
    labelled = null
    showCities()
    showCaves()
    levels = Math.max(0, ...m.pieces.map((p) => p.level))
    upTo = levels
    showRooms(m.pieces)
    // The dungeons of this map: one, or its wings.
    const dungeons = [...DUNGEON_PINS, ...NEW_DUNGEON_PINS].filter((d) => d.map === m.id)
    const bossMarks: typeof bosses = []
    pinned = dungeons.length > 0
    // A boss: its skull, and its name written under it, there without the pointer on it. On a second
    // screen nobody hovers while playing. Those of the pins, then the ones the pins lacked.
    const all = [...dungeons.flatMap((d) => d.bosses), ...MORE_BOSS_PINS.filter(([map]) => map === m.id).map(([, name, u, v]) => [name, u, v] as const)]
    for (const [name, u, v] of all) {
      // A rare boss is not there in every run: a silver ring, and said in its name.
      const rare = RARE_BOSSES.has(nameOfBoss(name))
      bossMarks.push({ name, rare, gone: false, marker: L.marker(atYards({ u, v }), { keyboard: false, icon: bossIcon(false, rare) }).bindTooltip(rare ? `${name} (rare)` : name, { permanent: true, direction: 'bottom', offset: [0, rare ? 11 : 9], className: 'boss-name' }).addTo(pins) })
    }
    for (const d of dungeons) {
      if (d.entrance)
        L.marker(atYards({ u: d.entrance[0], v: d.entrance[1] }), { keyboard: false, icon: doorIcon(m.kind === 'raid') })
          .bindTooltip(dungeons.length > 1 ? `Entrance: ${d.name}` : 'Entrance', { direction: 'top', offset: [0, -13], className: 'tip' })
          .addTo(pins)
    }
    bosses = bossMarks
    const framed = dungeons.filter((d) => d.name === wing)
    const box = dungeons.length
      ? (framed.length ? framed : dungeons).reduce<Box>((all, d) => [Math.min(all[0], d.bounds[0]), Math.min(all[1], d.bounds[1]), Math.max(all[2], d.bounds[2]), Math.max(all[3], d.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity])
      : boxOf(m.pieces)
    if (box) map.fitBounds(boundsOfBox(box), { animate: false }) // at once: the arrow is placed against this view
  }

  // The level the character is on shows by itself each time it changes; a level picked by hand stays until then.
  let onLevel: number | undefined
  $effect(() => {
    const level = pos?.inst?.level
    if (level === onLevel) return
    onLevel = level
    if (inside && !browsing && level !== undefined && level <= levels && level !== upTo) showUpTo(level)
  })

  // Shows the rooms up to a level: the ones above are taken off, to see what they cover.
  function showUpTo(level: number): void {
    if (!inside) return
    upTo = level
    showRooms(inside.pieces.filter((p) => p.level <= level))
  }

  /**
   * Shows the map of a dungeon or a raid from outside it, with its bosses and its entrance; false where
   * the app has no rooms of it. The character in it: the map follows the character there, as always.
   */
  export function openDungeon(id: number, wing?: string): boolean {
    const m = interiors?.maps.find((d) => d.id === id && d.kind !== 'world')
    if (!map || !m) return false
    if (pos?.inst?.id === id) {
      browsing = null
      following = true
      showInside(m, wing)
      place(true)
      return true
    }
    // Opened from another dungeon opened so: Back still goes to where the player was before the first.
    if (!browsing) {
      const center = map.getCenter(), found = inside ? undefined : zoneAt(maps, continent, { x: center.lng, y: -center.lat })
      browsing = { inst: pos?.inst?.id ?? null, continent, center, zoom: map.getZoom(), following, dungeon: inside !== null, from: inside?.name ?? found?.zone.name ?? NAMES[continent] }
    }
    following = false
    showInside(m, wing)
    arrow.remove() // the character is not in there
    return true
  }

  // Back from a dungeon opened from outside: to the view the player had, or to the dungeon the character is in.
  function goBack(): void {
    const from = browsing
    if (!map || !from) return
    browsing = null
    following = from.following
    if (!from.dungeon) {
      show(from.continent, false)
      map.setView(from.center, from.zoom, { animate: false })
    }
    place(true)
  }

  // A continent picked while the character is in a dungeon stays on show, as a dungeon opened from outside does:
  // until Back, Follow, or the character going out of the instance or into another.
  function choose(which: Continent): void {
    const keep = browsing?.inst != null ? browsing : inside && pos?.inst ? { inst: pos.inst.id, following: true, dungeon: true, from: inside.name } : null
    following = false
    show(which, true)
    if (keep && map) browsing = { ...keep, continent: which, center: map.getCenter(), zoom: map.getZoom() }
  }

  /**
   * Takes the map to a place and opens the label on it: for a row chosen in the panel, for a
   * result of the search. zoom: how near to look, when the map is farther than that.
   */
  export function goTo(to: { continent: Continent; at: Point; title: string; where?: string; zoom?: number; whole?: GameMap; dungeon?: { id: number; wing?: string }; item?: number }): void {
    if (!map || !maps.length) return
    following = false
    if (inside || continent !== to.continent) show(to.continent, false)
    const view = map
    // whole: a zone was asked for, and all of it is put in view.
    if (to.whole?.rect) view.fitBounds(boundsOf(to.whole), { animate: false })
    else view.setView(at(to.at), Math.max(view.getZoom(), to.zoom ?? 5), { animate: false })
    const found = zoneAt(maps, to.continent, to.at)
    // A dungeon: its door, labelled as a click on it labels it; Dungeon Map opens the wing that was found.
    const door = to.dungeon && travel.doors.find((d) => d.continent === to.continent && d.x === to.at.x && d.y === to.at.y)
    if (door) {
      labelPin(to.at, door.names.join(', '), ['Entrance'], found, behindDoor(door), to.dungeon!.wing)
      return
    }
    labelled = {
      units: to.at,
      continent: to.continent,
      title: to.title,
      // The caller may know the zone better: where two maps overlap, the point alone does not tell.
      where: to.where ?? (found ? `${found.zone.name} ${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : ''),
      spot: spotOf(at(to.at)),
      box: frameSize(),
      pin: found ? { m: found.zone.id, ...found.place } : null,
      ...(to.item && { item: to.item }), // an item found: its picture beside the name
    }
    // A vendor or a trainer found, by its name or as the one who sells the item found: its panel opens as for a click on its pin.
    // The nearest to the place: in a town several vendors of one thing stand within a step of the map.
    const target = at(to.at), far = (l: (typeof laid)[number]): number => view.distance(target, l.at)
    const npc = laid.filter((l) => panelFor(l.pin, to) && far(l) < 1).sort((a, b) => far(a) - far(b))[0]?.pin
    if (npc) labelled.npc = { ...npc }
  }

  // A click on a pin opens the label on it, as on any point of the map: its name, and under it what
  // the pin is. on: the zone the pin was placed by, since where two maps overlap the point alone does not tell.
  function labelPin(units: Point, title: string, notes: string[], on = zoneAt(maps, continent, units), dungeons?: { id: number; name: string; raid: boolean }[], wing?: string): void {
    if (!map) return
    if (holder.clientWidth < 640) layersOpen = false // on a narrow map the menu would lie over the label
    labelled = {
      units,
      continent,
      title,
      notes,
      where: on ? `${on.zone.name} ${on.place.x.toFixed(1)}, ${on.place.y.toFixed(1)}` : '',
      spot: spotOf(at(units)),
      box: frameSize(),
      pin: on ? { m: on.zone.id, ...on.place } : null,
      dungeons,
      wing,
    }
  }

  // A ring around one pin: the one whose row in the Now panel is under the pointer. The map does
  // not move for it: a pin out of view stays out of view.
  const ring = L.marker([0, 0], { interactive: false, keyboard: false, zIndexOffset: 2000, icon: L.divIcon({ className: 'ring', iconSize: [34, 34] }) })
  export function pointAt(to: { continent: Continent; at: Point } | null): void {
    if (!map || !to || inside || to.continent !== continent) return void ring.remove()
    ring.setLatLng(at(to.at)).addTo(map)
  }

  function follow(): void {
    following = !following
    if (!following) return
    browsing = null // back to the character, out of whatever was opened to look at
    place(true)
  }

  // The arrow goes to a new place, it does not jump there: at every frame it is put where the
  // character was a moment ago (glide.ts), and the map that follows is put under it.
  const TOO_FAR = 100 // yards: beyond this it is a portal or a hearthstone, and the arrow jumps
  let trail: Fix[] = [], gliding = 0
  let tied = false // the map moves with the arrow, frame by frame
  let zooming = false // a zoom is running: the map is left alone until its end
  function frame(): void {
    const now = whereAt(trail, Date.now() - BEHIND), here = L.latLng(now.y, now.x)
    arrow.setLatLng(here)
    if (map && following && tied && !zooming) map.panTo(here, { animate: false, noMoveStart: true })
    layoutSoon()
    gliding = now.arrived ? 0 : requestAnimationFrame(frame)
  }
  function glide(here: L.LatLng, jump: boolean): void {
    const fix = { at: readAt ?? Date.now(), x: here.lng, y: here.lat }, last = trail.at(-1)
    const yards = last ? Math.hypot(fix.x - last.x, fix.y - last.y) * YARDS_PER_UNIT : Infinity
    if (jump || still() || !map?.hasLayer(arrow) || yards > TOO_FAR) {
      cancelAnimationFrame(gliding)
      gliding = 0
      trail = [fix]
      layoutSoon()
      return void arrow.setLatLng(here)
    }
    const longer = addFix(trail, fix)
    if (longer === trail) return // the same place told again
    trail = longer
    gliding ||= requestAnimationFrame(frame)
  }

  // Puts the arrow on a place, turned as the character is. jump: at once, without the way there.
  function mark(here: L.LatLng, jump = false): void {
    if (!map) return
    glide(here, jump)
    if (layers.arrow) arrow.addTo(map)
    else arrow.remove()
    if (pos?.facing === undefined) return
    const turn = 360 - pos.facing // the game counts anticlockwise from north
    // It turns as it sets off on the stretch that ends where the game told this facing.
    if (gliding) setTimeout(() => turnTo(turn), BEHIND - PERIOD)
    else turnTo(turn)
  }

  // The arrow on a place, and the map with it when it follows. loose: the map moves only once the
  // arrow is at its edge, so a dungeon that fits the window stays still.
  function point(here: L.LatLng, jump: boolean, loose = false): void {
    if (!map) return
    mark(here, jump)
    tied = !loose
    if (!following) return
    if (jump) map.panTo(here, { animate: false })
    // In a dungeon the map goes after an arrow that reached its edge.
    else if (loose && !map.getBounds().pad(-0.05).contains(here)) map.panTo(here, { animate: !still(), duration: 0.9, easeLinearity: 1 })
    // A map left off a still arrow (a zoom on another point) goes back to it.
    else if (!loose && !gliding && !map.getCenter().equals(here)) map.panTo(here, { animate: !still(), duration: 0.35 })
  }

  // Where the character is on the map, or nothing: a place with no map, or one outside the two continents.
  let placed = false
  let under = '' // the buildings whose rooms are on show on a continent: the character is under their roof
  function place(jump = false): void {
    if (!map || !maps.length) return
    // A dungeon opened from outside stays on show while the character stays where it was; going into
    // an instance or out of one, the map follows the game again.
    if (browsing) {
      if ((pos?.inst?.id ?? null) === browsing.inst) return void arrow.remove()
      browsing = null
      following = true
    }
    // Inside a dungeon or a raid the app has the rooms of: that is the map, whatever was on show.
    const inst = pos?.inst, dungeon = inst && interiors?.maps.find((m) => m.id === inst.id && m.kind !== 'world')
    if (inst && dungeon) {
      const entering = inside?.id !== dungeon.id
      if (entering) showInside(dungeon)
      offMap = false
      placed = false // back in the world, the map goes to where the character comes out
      me = null
      const where = yardsInside(inst)
      if (!where) return void arrow.remove() // the game does not tell the place in here
      // On the way in the whole dungeon is in view, and stays so while the arrow is well inside it.
      if (entering) mark(atYards(where), true)
      else point(atYards(where), jump, true)
      return
    }
    const leaving = inside !== null
    const zone = pos?.map === undefined ? undefined : maps.find((m) => m.id === pos!.map)
    if (!zone?.rect || zone.continent === null || pos?.x === undefined || pos.y === undefined) {
      if (leaving) show(continent, true)
      offMap = pos !== undefined
      me = null
      arrow.remove()
      return
    }
    offMap = false
    const units = unitsOfPlace(zone.rect, pos.x, pos.y), here = at(units)
    if (me?.units.x !== units.x || me.units.y !== units.y || me.continent !== zone.continent) me = { units, continent: zone.continent }
    if (zone.continent !== continent || leaving) {
      if (!following && placed && !leaving) return void arrow.remove() // the player is looking at the other continent
      show(zone.continent, false)
    }
    if (!placed) {
      placed = true
      mark(here)
      map.fitBounds(boundsOf(zone), { animate: false })
    } else point(here, jump)

    // Under a roof (a cave, a mine, a house): the rooms of that building go over the ground.
    const world = pos.indoors || ROOFED.has(zone.id) ? interiors?.maps.find((m) => m.kind === 'world' && m.id === zone.continent) : undefined
    const buildings = world ? buildingsAt(world.pieces, units.x * YARDS_PER_UNIT, units.y * YARDS_PER_UNIT) : new Set<number>()
    const now = [...buildings].join()
    if (now !== under) {
      under = now
      showRooms(world ? world.pieces.filter((p) => buildings.has(p.building)) : [])
    }
  }

  // The 3D view of the continent (terrain3d.ts; ui.md, section 4), over the 2D map, made the first
  // time it is asked for. The 2D map stays under it and keeps the place: the view goes from one to
  // the other at the same point and zoom, and what moves the map by itself (search, Follow, the
  // continents, + and -) moves the 3D view with it.
  let threeD = $state(false)
  let terrainHost: HTMLDivElement
  let pinsHost: HTMLDivElement
  let compassHost: HTMLButtonElement
  let terrain: Terrain | undefined
  // What the 2D map lays on the ground, on the 3D view too (pins3d.ts).
  let pins3d: Pins3d | undefined
  // Where a point of the map is on screen, on the view on show: a label stays on its point in 3D too.
  const spotOf = (ll: L.LatLng): L.Point => (threeD && pins3d ? pins3d.spot(ll) : map!.latLngToContainerPoint(ll))
  let tilted = 0.9 // how far the 3D view was tilted when it was left; it comes back turned as the 2D map is
  // The compass, under the 2D map and the 3D view alike: lying flat and turned as the 2D map is, or as the 3D view
  // looks (terrain3d.ts turns it there). three.js comes with it, after the map is up.
  let compass = $state<Compass | undefined>()
  const compassReady = async (): Promise<Compass> => (compass ??= new (await import('./compass')).Compass(compassHost))
  function compassAt(bearing: number): void {
    compass?.turn(0, (bearing * Math.PI) / 180)
    compass?.render()
  }
  // Heading up: while the map follows the character it turns with it, the way it faces at the top, in 2D (spin) and
  // in 3D (terrain3d.ts). The compass or N turns it on and off; a drag lets the character go, and the map stays as it
  // was turned until Follow.
  // headingUp is the choice, kept; turning is what the view does now, and what the compass shows: a click on a
  // compass gone dark after a drag turns with the character again, it does not turn the choice off.
  let headingUp = $state(localStorage.getItem('headingUp') === '1')
  const turning = $derived(headingUp && following)
  function setHeadingUp(on: boolean): void {
    headingUp = on
    localStorage.setItem('headingUp', on ? '1' : '0')
    if (on && !following) follow()
    else if (!on && threeD) void terrain?.north()
    else if (!on) northing = true
    spinSoon()
  }
  $effect(() => {
    void turning
    untrack(spinSoon)
  })
  let zoomed2d = false // the 2D map was zoomed by itself, not to follow the 3D view
  // Followed, the character stays in the middle: the wheel, a double click and two fingers zoom on it,
  // not on the pointer, and Follow stays on.
  $effect(() => {
    const centre = following ? 'center' : true
    if (map) Object.assign(map.options, { scrollWheelZoom: centre, doubleClickZoom: centre, touchZoom: centre })
    terrain?.zoomAtCursor(!following)
  })
  let syncing = false // the 2D map is moved from the 3D view: not the other way round
  const worldShown = (): string | undefined => (inside ? undefined : WORLDS.find((w) => w.continent === continent)?.name)
  // Yards of ground from top to foot of the 2D map at a zoom, and back.
  const seenAt = (z: number): number => (map!.getSize().y / 2 ** z) * YARDS_PER_UNIT
  const zoomFor = (seen: number): number => Math.log2((map!.getSize().y * YARDS_PER_UNIT) / seen)
  function lookAsTheMap(polar: number, azimuth: number, seen = seenAt(map!.getZoom())): void {
    const c = map!.getCenter()
    terrain!.look({ x: c.lng * YARDS_PER_UNIT, z: -c.lat * YARDS_PER_UNIT, seen, polar, azimuth })
  }
  // The 2D map goes where the 3D view looks, a few times a second: the pins of the place in view
  // are there to be copied, and the readout tells it. Not the other way round meanwhile.
  let tying = 0,
    tiedTo = ''
  function mapAsTheView(): void {
    if (!terrain || !map) return
    const now = terrain.looking(),
      key = `${Math.round(now.x)} ${Math.round(now.z)} ${Math.round(now.seen)}`
    if (key === tiedTo) return
    tiedTo = key
    syncing = true
    map.setView(at({ x: now.x / YARDS_PER_UNIT, y: now.z / YARDS_PER_UNIT }), zoomFor(now.seen), { animate: false })
    syncing = false
  }
  // For the trials on a phone: the address ending in #fps shows how many times a second the 3D view is drawn while it moves.
  let counting = $state(location.hash === '#fps')
  let fps = $state(0)
  let counted = 0, since = 0, last = 0
  function count(): void {
    const now = performance.now()
    if (now - last > 250) ((counted = 0), (since = now)) // the view was still: a new count
    last = now
    counted++
    if (now - since >= 1000) ((fps = Math.round((counted * 1000) / (now - since))), (counted = 0), (since = now))
  }
  function onFrame(): void {
    if (counting) count()
    pins3d!.draw()
    // The names: off with their layer; clear of the buttons and of the arrow, where it is on this view.
    const me = map!.hasLayer(arrow) ? pins3d!.spot(arrow.getLatLng()) : null
    names3d!.draw(layers.zones && !inside ? [...avoid3d, ...(me ? [{ left: me.x - 18, top: me.y - 18, right: me.x + 18, bottom: me.y + 18 }] : [])] : null)
    if (labelled) {
      const spot = spotOf(at(labelled.units))
      if (spot.x !== labelled.spot.x || spot.y !== labelled.spot.y) labelled.spot = spot
    }
    tying ||= window.setTimeout(() => {
      tying = 0
      if (threeD) mapAsTheView()
    }, 200)
  }
  // The rooms inside the ground of the continent on show, for the 3D view (inside3d.ts; under.json, main/caves.ts).
  let inside3d: Inside3d | undefined
  let underRooms: Record<string, UnderRoom[]> | undefined
  let underOf = -1
  function inside3dSet(): void {
    const world = interiors?.maps.find((m) => m.kind === 'world' && m.id === continent)
    if (!inside3d || !world || !underRooms || underOf === continent) return
    underOf = continent
    inside3d.set(world.pieces, underRooms[continent] ?? [])
  }
  $effect(() => {
    void continent
    untrack(inside3dSet)
  })
  async function view3d(on: boolean): Promise<void> {
    const folder = worldShown()
    if (on === threeD || !map || (on && !folder)) return
    if (on) {
      if (!terrain) {
        const { Terrain } = await import('./terrain3d')
        terrain ??= new Terrain(terrainHost, await compassReady())
        // For the trials (design/terrain3d): the view within reach of a script, when the page is told so.
        if (localStorage.getItem('trial')) (window as unknown as { terrain3d: unknown }).terrain3d = terrain
        terrain.onGrab = () => (following = false)
        terrain.zoomAtCursor(!following)
        const body = new Arrow3d(terrain)
        terrain.onBefore = () => {
          const moved = body.step(performance.now())
          // Heading up: the view turns as the arrow does, so the arrow stays pointing up. Clockwise from north there,
          // anticlockwise for OrbitControls.
          terrain!.heading = turning && body.pointing !== null ? (-body.pointing * Math.PI) / 180 : null
          return moved
        }
        pins3d ??= new Pins3d(map, terrain, pinsHost, terrainHost, arrow, () => turned, body, () => floorAt)
        names3d ??= new Names3d(terrain, pinsHost)
        inside3d ??= new (await import('./inside3d')).Inside3d(terrain)
        inside3dSet()
        names3dSet()
        terrain.onFrame = onFrame
      }
      // The view looks the way the 2D map is turned; the 2D map under it lies north up meanwhile, as its pins are copied from it.
      const azimuth = (map.getBearing() * Math.PI) / 180
      threeD = true
      map.setBearing(0)
      for (const layer of shown) layer.remove()
      terrain.show(folder!)
      lookAsTheMap(0, azimuth)
      terrain.start()
      await terrain.turn(tilted, azimuth)
    } else if (terrain) {
      const left = terrain.looking()
      tilted = left.polar
      await terrain.turn(0, left.azimuth)
      back2d()
    }
  }
  // Straight to 2D, where the 3D view is looking.
  function back2d(): void {
    if (!terrain || !map) return
    tiedTo = ''
    mapAsTheView()
    // The 2D map turned as the view was looking.
    map.setBearing((((terrain.looking().azimuth * 180) / Math.PI) % 360 + 360) % 360)
    threeD = false
    for (const layer of shown) layer.addTo(map)
    terrain.stop()
    terrain.heading = null
    pins3d?.clear()
    names3d?.clear()
    spinSoon()
  }
  // Inside a dungeon there is no ground to show: back to 2D.
  $effect(() => {
    if (inside && untrack(() => threeD)) back2d()
  })

  onMount(() => {
    const made = L.map(holder, { scrollWheelZoom: 'center', doubleClickZoom: 'center', touchZoom: 'center', zoomControl: false, crs: L.CRS.Simple, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, attributionControl: false, zoomAnimation: !still(), fadeAnimation: !still(), rotate: true, rotateControl: false, shiftKeyRotate: false, pitchDrag: false, touchRotate: false })
    map = made
    // For the trials (design/map-2d-rotate): the 2D map within reach of a script, when the page is told so.
    if (localStorage.getItem('trial')) (window as unknown as { map2d: unknown }).map2d = made
    void compassReady().then(() => compassAt(made.getBearing()))
    made.on('rotate', layoutSoon) // the names, upright, are fitted again as the map turns under them
    made.setView([-128, 128], 2)
    made.setMaxBounds(WORLD_BOUNDS.pad(0.2)) // after a view: leaflet-rotate asks for the centre as the bounds are set
    pins.addTo(made)
    made.on('dragstart', () => (following = false))
    made.on('move', look)
    made.on('zoomend', layout)
    made.on('moveend', layoutSoon)
    made.on('moveend', () => {
      if (!threeD || syncing || !terrain) return
      const folder = worldShown()
      if (!folder) return back2d()
      terrain.show(folder)
      // The 3D view keeps its own distance, unless the 2D map was zoomed (+ and -): it moved only to follow.
      const l = terrain.looking()
      lookAsTheMap(l.polar, l.azimuth, zoomed2d ? undefined : l.seen)
      zoomed2d = false
    })
    made.on('zoomend', () => (zoomed2d = !syncing))
    made.on('zoomstart', () => (zooming = true))
    made.on('zoomend', () => (zooming = false))
    made.on('zoomend', () => (zoom = made.getZoom()))
    made.on('zoomend', fitCaves)
    // A window made wider or narrower: the map that follows puts the character back in its middle.
    made.on('resize', () => {
      if (following) place(true)
    })
    // Names are measured as they are drawn: once the typefaces are in, they are measured again.
    void document.fonts.ready.then(() => {
      for (const n of named) n.sizes = {}
      layout()
    })
    // A click on the world map puts the label on that point; with a label open, it only closes it. Inside a dungeon
    // there is nothing to say of a point yet.
    made.on('click', (e) => {
      if (labelled) return void (labelled = null)
      if (inside) return
      if (holder.clientWidth < 640) layersOpen = false // on a narrow map the menu would lie over the label
      const units = { x: e.latlng.lng, y: -e.latlng.lat }, found = zoneAt(maps, continent, units)
      labelled = {
        units,
        continent,
        title: found?.zone.name ?? NAMES[continent],
        where: found ? `${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : '',
        spot: e.containerPoint,
        plain: true, // a bare point of the map: as a stop it is told from the others by its coordinates
        box: frameSize(),
        pin: found ? { m: found.zone.id, ...found.place } : null,
      }
    })
    // The label stays on its point while the map moves under it.
    made.on('move zoom resize', () => {
      if (labelled) Object.assign(labelled, { spot: spotOf(at(labelled.units)), box: frameSize() })
    })
    void fetch(`${TILES}/maps.json`)
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => {
        maps = list
        show(continent, true)
        place()
      })
    void fetch(`${TILES}/travel.json`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<Travel>) : travel))
      .then((told) => (travel = told))
      .catch(() => {})
    made.on('moveend', movedFixed)
    void fetch(`${TILES}/places.json`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<Place[]>) : []))
      .then((list) => {
        places = list
        if (maps.length && !inside) writeNames()
      })
      .catch(() => {})
    // Gone with the screen: whatever was still waiting (a layout, a list being read) finds no map and does nothing.
    // The map is told when its box changes: the panel beside it opens and closes, a phone is turned.
    const sized = new ResizeObserver(() => made.invalidateSize())
    sized.observe(holder)
    return () => {
      sized.disconnect()
      clearTimeout(laying)
      cancelAnimationFrame(gliding)
      map = undefined
      made.remove()
    }
  })


  // The quests Questie shows, on the zones of the continent in view: where to take one, where to hand
  // one in, where what is still to find is. Each kind is a layer of its own.
  const questLayers = { available: L.layerGroup(), turnin: L.layerGroup(), objectives: L.layerGroup() }
  const QUEST_SAYS = { available: 'Quest to take', turnin: 'Quest to hand in', objective: 'Quest objective' } as const
  const KIND_SAYS = { slay: 'Objective: slay', loot: 'Objective: loot', object: 'Objective: use', talk: 'Objective: talk', event: 'Objective: go there' } as const
  const QUEST_PINS = { available: ['quest', 'available', 500], turnin: ['turnin', 'turnin', 1000], objective: ['objective', 'objectives', 0] } as const
  $effect(() => {
    for (const group of Object.values(questLayers)) group.clearLayers()
    const zones = new Map(maps.filter((m) => m.level === 'zone' && m.rect && m.area && m.continent === continent).map((m) => [m.area, m]))
    // From far the pins to take, and those to hand in, that would lie on each other are one, in their middle: it names them all, and a click goes near enough to tell them apart.
    const far = zoom < PIN_ZOOM ? zoom : null
    const placed = quests.flatMap((p) => {
      const zone = zones.get(p.area)
      return zone?.rect ? [{ p, zone, ...unitsOfPlace(zone.rect, p.x, p.y) }] : []
    })
    const alone = new Set(placed)
    if (far !== null) {
      const groups = (['available', 'turnin'] as const).flatMap((type) => gathered(placed.filter((q) => q.p.type === type), GATHER / 2 ** far).filter((g) => g.of.length > 1).map((g) => ({ ...g, type })))
      for (const group of groups) for (const q of group.of) alone.delete(q)
      // Such a pin says "around here": it stands a little aside rather than on another pin or on the character's arrow.
      const taken: Point[] = [...[...alone].filter((q) => q.p.type !== 'objective'), ...(me && me.continent === continent ? [me.units] : [])]
      for (const group of groups) {
        const [drawing, layer, above] = QUEST_PINS[group.type], size = pinSize(drawing), units = clearOf(group, taken, (size + 4) / 2 ** far)
        taken.push(units)
        const tip = document.createElement('span')
        group.of.forEach((q, i) => {
          if (i) tip.append(document.createElement('br'))
          tip.append(Object.assign(document.createElement('b'), { textContent: q.p.name }))
          for (const quest of q.p.quests) if (quest !== q.p.name) tip.append(document.createElement('br'), quest)
        })
        L.marker(at(units), { keyboard: false, zIndexOffset: above, icon: L.divIcon({ className: 'door', iconSize: [size, size], html: pin(drawing) }) })
          .bindTooltip(tip, { direction: 'top', offset: [0, -size / 2], className: 'tip' })
          .on('click', () => map?.setView(at(units), PIN_ZOOM + 1.5))
          .addTo(questLayers[layer])
      }
    }
    for (const { p, zone } of alone) {
      if (!zone.rect) continue
      const [plain, layer, above] = QUEST_PINS[p.type]
      // An objective is drawn by what it asks for, where the addon told.
      const drawing: PinName = p.type === 'objective' && p.kind ? p.kind : plain
      // Names come from the player's QuestieDB: written as text, never as markup.
      const tip = document.createElement('span')
      tip.append(Object.assign(document.createElement('b'), { textContent: p.name }))
      for (const quest of p.quests) if (quest !== p.name) tip.append(document.createElement('br'), quest)
      const size = pinSize(drawing)
      const units = unitsOfPlace(zone.rect, p.x, p.y)
      L.marker(at(units), { keyboard: false, zIndexOffset: above, icon: L.divIcon({ className: p.type === 'objective' ? 'door task' : 'door', iconSize: [size, size], html: pin(drawing) }) })
        .bindTooltip(tip, { direction: 'top', offset: [0, -size / 2], className: 'tip' })
        .on('click', () => labelPin(units, p.name, [(p.kind && KIND_SAYS[p.kind]) ?? QUEST_SAYS[p.type], ...p.quests.filter((quest) => quest !== p.name)], { zone, place: { x: p.x, y: p.y } }))
        .addTo(questLayers[layer])
    }
  })
  // Not inside a dungeon, whose map is another; not from far, where they would cover the land: the objectives, which are many, go first.
  $effect(() => {
    for (const [id, group] of Object.entries(questLayers) as [keyof typeof questLayers, L.LayerGroup][]) {
      if (map && layers[id] && !inside && zoom >= (id === 'objectives' ? PIN_ZOOM : QUEST_ZOOM)) group.addTo(map)
      else group.remove()
    }
  })

  // Who offers a service, and where ore and herbs grow. There are thousands on a continent: only
  // those in view are on the map, and each layer only from the zoom at which its pins stop lying
  // on each other.
  const FIXED_ZOOM: Record<FixedLayer, number> = { flight: 3, inn: 3.5, bank: 4, auction: 4, stable: 4, repair: 4.5, trainers: 4.5, vendors: 4.5, ore: 5.5, herbs: 5.5 }
  /** Turns a whole group of layers on or off. */
  function showAll(ids: readonly LayerId[], on: boolean): void {
    for (const id of ids) layers[id] = on
  }
  const LAYER_NAMES = Object.fromEntries(LAYER_GROUPS.flatMap((group) => group.layers.map((layer) => [layer.id, layer.name]))) as Record<LayerId, string>
  // They are painted on one canvas, not made one element each: three thousand elements over the map
  // brought dragging down to eight frames a second. Each is the picture the game itself has for it
  // (main/icons.ts takes them from the player's game); where the game gave none, the shapes and
  // colours of marks.ts: a square for a service, a lozenge for ore and herbs.
  const fixedCanvas = L.canvas({ padding: 0.5 })
  const pictures = new Map<string, HTMLImageElement>()
  let pictureCame = false
  function pictureOf(name: string): HTMLImageElement {
    let picture = pictures.get(name)
    if (!picture) {
      picture = new Image()
      // The pins already painted plain are painted again, once for all the pictures of a frame.
      picture.onload = () => {
        if (pictureCame) return
        pictureCame = true
        requestAnimationFrame(() => {
          pictureCame = false
          drawFixed()
        })
      }
      picture.src = `${TILES}/icons/${name}.png`
      pictures.set(name, picture)
    }
    return picture
  }
  const FixedPinMark = L.CircleMarker.extend({
    _updatePath(this: L.CircleMarker & { _renderer: { _ctx: CanvasRenderingContext2D }; _point: L.Point; _empty: () => boolean; options: { lozenge: boolean; fillColor: string; picture: HTMLImageElement } }) {
      if (this._empty()) return
      paintFixed(this._renderer._ctx, this._point.x, this._point.y, this.options)
    },
  }) as unknown as new (at: L.LatLng, options: L.CircleMarkerOptions & { lozenge: boolean; picture: HTMLImageElement }) => L.CircleMarker
  const fixedGroup = L.layerGroup()
  let laid: { pin: FixedPin; at: L.LatLng; zone: GameMap }[] = []
  // The label is open on a pin of the map: a ring around the pin instead of the dot, which would hide it.
  const onPin = $derived(!!labelled && labelled.continent === continent && !inside && laid.some((l) => at(labelled!.units).equals(l.at, 1e-6)))
  // What is drawn now: more than the view, so that the map can move a little (it does all the time
  // while it follows the character) without the pins being made again.
  let drawnFor: { view: L.LatLngBounds; far: number } | null = null
  function movedFixed(): void {
    if (!map || !drawnFor || drawnFor.far !== map.getZoom() || !drawnFor.view.contains(map.getBounds())) drawFixed()
  }
  function drawFixed(): void {
    fixedGroup.clearLayers()
    drawnFor = null
    if (!map || inside) return void fixedGroup.remove()
    fixedGroup.addTo(map)
    const view = map.getBounds().pad(threeD ? 2 : 0.5), far = map.getZoom() // the 3D view sees farther, to the fog
    drawnFor = { view, far }
    // What the label is open on is drawn even with its layers off: the search or a panel led there, and the line points at it.
    const here = labelled && labelled.continent === continent ? at(labelled.units) : null
    const labelledAt = (where: L.LatLng): boolean => !!here && here.equals(where, 1e-6)
    // Ore and herbs first, so that who offers a service is painted over them.
    for (const service of [false, true]) {
      for (const { pin: p, at: where, zone } of laid) {
        const shown = (layer: FixedLayer): boolean => layers[layer] && far >= FIXED_ZOOM[layer]
        if ((p.side !== undefined) !== service || !(p.layers.some(shown) || labelledAt(where)) || !view.contains(where)) continue
        // The radius is what the pointer feels, smaller than the picture: two people a few yards apart both answer.
        new FixedPinMark(where, { renderer: fixedCanvas, radius: 7, lozenge: !service, fillColor: service ? '#7fc8ff' : '#d9a066', picture: pictureOf(iconOf(p, shown)), bubblingMouseEvents: false })
          // Made when the pointer comes over the pin, not for every pin. Names come from the
          // player's QuestieDB: written as text, never as markup.
          .bindTooltip(
            () => {
              const tip = document.createElement('span')
              tip.append(Object.assign(document.createElement('b'), { textContent: p.name }))
              if (p.sub) tip.append(document.createElement('br'), p.sub)
              tip.append(document.createElement('br'), p.layers.map((layer) => LAYER_NAMES[layer]).join(', '))
              return tip
            },
            { direction: 'top', offset: [0, -9], className: 'tip' },
          )
          .on('click', () => {
            labelPin({ x: where.lng, y: -where.lat }, p.name, [...(p.sub ? [p.sub] : []), p.layers.map((layer) => LAYER_NAMES[layer]).join(', ')], { zone, place: { x: p.x, y: p.y } })
            if (labelled && p.npc) labelled.npc = { ...p }
          })
          .addTo(fixedGroup)
      }
    }
  }
  $effect(() => {
    const zones = new Map(maps.filter((m) => m.level === 'zone' && m.rect && m.area && m.continent === continent).map((m) => [m.area, m]))
    laid = fixed.flatMap((p) => {
      const zone = zones.get(p.area)
      return zone?.rect && serves(p, side) ? [{ pin: p, at: at(unitsOfPlace(zone.rect, p.x, p.y)), zone }] : []
    })
    drawFixed()
  })
  $effect(() => {
    void [inside, ...Object.values(layers)]
    drawFixed()
  })

  // The doors of the dungeons and the flight routes of the character's side, from the game's own tables.
  let travel = $state.raw<Travel>({ doors: [], nodes: [], routes: [] })
  const travelLayers = { dungeons: L.layerGroup(), routes: L.layerGroup() }
  // The maps behind a door the app has the rooms of: a button each on its label.
  const behindDoor = (door: Travel['doors'][number]): { id: number; name: string; raid: boolean }[] =>
    (door.maps ?? []).flatMap((id, i) => (interiors?.maps.some((m) => m.id === id) ? [{ id, name: door.names[i] ?? door.names[0]!, raid: door.raid === true }] : []))
  $effect(() => {
    for (const group of Object.values(travelLayers)) group.clearLayers()
    for (const door of travel.doors) {
      if (door.continent !== continent) continue
      L.marker(at(door), { keyboard: false, zIndexOffset: 200, icon: doorIcon(door.raid === true) })
        .bindTooltip(door.names.join(', '), { direction: 'top', offset: [0, -13], className: 'tip' })
        .on('click', () => {
          labelPin({ x: door.x, y: door.y }, door.names.join(', '), ['Entrance'], undefined, behindDoor(door))
        })
        .addTo(travelLayers.dungeons)
    }
    for (const [a, b] of travel.routes) {
      const from = travel.nodes[a], to = travel.nodes[b]
      if (!from || !to || from.continent !== continent || !serves(from, side) || !serves(to, side)) continue
      L.polyline([at(from), at(to)], { color: '#7fc8ff', weight: 1.5, opacity: 0.6, interactive: false, ...ROUTE }).addTo(travelLayers.routes)
    }
  })
  $effect(() => {
    for (const [id, group] of Object.entries(travelLayers) as [keyof typeof travelLayers, L.LayerGroup][]) {
      if (map && layers[id] && !inside && zoom >= 2) group.addTo(map)
      else group.remove()
    }
  })

  // My pins: a small flag on each saved point of this continent. A click opens its label. The
  // point the game's arrow follows has a gold flag, as in the game, whether it is saved or not.
  const followedPart = $derived(gameFollows ? markPart(gameFollows) : '')
  const myPinsLayer = L.layerGroup()
  $effect(() => {
    myPinsLayer.clearLayers()
    const flag = (saved: SavedPin, gold: boolean): void => {
      if (saved.continent !== continent) return
      L.marker(at(saved.at), { keyboard: false, zIndexOffset: gold ? 450 : 400, icon: L.divIcon({ className: 'door mine', iconSize: [16, 16], html: gold ? pin('flag').replaceAll('#f3ead9', '#ffd100') : pin('flag') }) })
        .bindTooltip(Object.assign(document.createElement('span'), { textContent: gold ? `${saved.name}, followed in the game` : saved.name }), { direction: 'top', offset: [0, -8], className: 'tip' })
        .on('click', () => {
          if (!map) return
          const found = zoneAt(maps, saved.continent, saved.at)
          labelled = {
            units: { ...saved.at },
            continent: saved.continent,
            title: saved.name,
            where: found ? `${found.zone.name} ${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : '',
            spot: spotOf(at(saved.at)),
            box: frameSize(),
            pin: saved.pin && { ...saved.pin },
          }
        })
        .addTo(myPinsLayer)
    }
    let met = false
    for (const saved of myPins) {
      const gold = !!saved.pin && markPart(saved.pin) === followedPart
      met ||= gold
      flag(saved, gold)
    }
    // Followed but not saved: a point sent with Send to game. Named as the game names it.
    const loose = gameFollows && !met && maps.length > 0 ? pinOfMark(maps, gameFollows) : null
    if (loose && gameFollows) flag({ ...loose, name: gameFollows.name }, true)
  })
  $effect(() => {
    if (map && layers.mypins && !inside) myPinsLayer.addTo(map)
    else myPinsLayer.remove()
  })

  // The companions of the group: a disc each, in the colour of their class and with what they do in the
  // group drawn on it, where the game or their own Twinmap tells they are. Inside a dungeon only
  // their Twinmap can tell, and the disc is on the dungeon's map while that is on show.
  // ponytail: a disc jumps to each new place; it can glide as the arrow does (glide.ts) if that reads badly.
  const companionLayer = L.layerGroup()
  const companionMarks = new Map<string, L.Marker>()
  let companionColours = new Map<string, string>()
  $effect(() => {
    const here = new Set<string>()
    companionColours = coloursFor(group, companionColours)
    for (const c of group) {
      const zone = inside || c.map === undefined ? undefined : maps.find((m) => m.id === c.map)
      const within = inside && c.inst === inside.id ? yardsInside({ id: c.inst, x: c.wx, y: c.wy }) : undefined
      if (!within && (!zone?.rect || zone.continent !== continent || c.x === undefined || c.y === undefined)) continue
      const where = within ? atYards(within) : at(unitsOfPlace(zone!.rect!, c.x!, c.y!)), colour = companionColours.get(c.name)!, key = `${c.name} ${colour} ${c.role ?? ''}`
      here.add(key)
      const marker = companionMarks.get(key)
      if (marker) marker.setLatLng(where)
      else
        companionMarks.set(
          key,
          L.marker(where, { keyboard: false, zIndexOffset: 900, icon: L.divIcon({ className: 'door', iconSize: [22, 22], html: `<span style="display:block;line-height:0;color:${colour}">${companionPin(c.role, c.name)}</span>` }) })
            .bindTooltip(Object.assign(document.createElement('span'), { textContent: c.name }), { direction: 'top', offset: [0, -11], className: 'tip' })
            .addTo(companionLayer),
        )
    }
    for (const [key, marker] of companionMarks) {
      if (here.has(key)) continue
      companionLayer.removeLayer(marker)
      companionMarks.delete(key)
    }
  })
  $effect(() => {
    if (map && layers.companions) companionLayer.addTo(map)
    else companionLayer.remove()
  })

  // The journey Shortest Path guides in the game: a ring on its goal, and the way there. A walk is a
  // dashed gold line, found here on the same grid (main/walk.ts): from the character to where the
  // walk ends, again when that changes or the character leaves it, and shortened as the character
  // walks. Where Shortest Path tells where every leg starts and ends (ahead), every leg is drawn, a
  // flight or a boat in its own colour from end to end; otherwise only a journey that is all on foot
  // has a line, to its goal.
  const OFF_THE_WAY = 40 // yards
  const ahead = $derived(legsOn(journey, maps))
  const ASK_EVERY = 2000 // ms between two askings at least
  const journeyGoal = $derived.by(() => {
    if (!journey || journey.loading || !journey.goal) return null
    const goal = journey.goal, on = maps.find((m) => m.id === goal.m)
    if (!on?.rect || on.continent === null) return null
    // As high as the last leg ends, when Shortest Path tells it: the goal is where that leg leads.
    const z = journey.legs.at(-1)?.heights?.[1] ?? undefined
    return { continent: on.continent, at: { ...unitsOfPlace(on.rect, goal.x, goal.y), z }, name: journey.name, walked: journey.legs.every((leg) => leg.mode === 'walk') }
  })
  let walked = $state<{ key: string; continent: Continent; points: Point[] } | null>(null)
  let asking = false, askedAt = 0
  $effect(() => {
    const goal = journeyGoal
    // Where the walk under way ends: where the first leg does when the legs are known and it is a walk, else at the goal of a journey all on foot.
    const first = ahead?.[0], end = first ? (first.mode === 'walk' ? first.points.at(-1)! : null) : goal?.walked ? goal : null
    if (!goal || !end || !me || me.continent !== end.continent) return void (walked = null)
    const key = `${end.continent} ${end.at.x} ${end.at.y}`, from = me.units, to = end.at
    if (walked?.key === key && restOf(walked.points, from).off <= OFF_THE_WAY) return
    if (asking || Date.now() - askedAt < ASK_EVERY) return
    asking = true
    askedAt = Date.now()
    // The floor at either end: the one the character is followed on now (the leg's own start is where it was planned from), and the one Shortest Path walks to.
    const fromZ = floorAt ?? first?.points[0]!.z, toZ = 'z' in end ? end.z : (end.at as { z?: number }).z
    void window.twinmap.walk({ continent: end.continent, from: { ...from }, to: { ...to }, fromZ, toZ }).then((path) => {
      asking = false
      // No way found (too far, or nothing to walk on there): a straight line.
      walked = { key, continent: end.continent, points: path?.points ?? [from, to] }
    })
  })
  // The walks further on, between the ends of their legs: asked once each, and kept while the legs are the same.
  let laterWalks = $state<Record<string, Point[]>>({})
  const laterAsked = new Set<string>()
  const walkKey = (leg: WayLeg): string => `${leg.points[0]!.continent} ${leg.points[0]!.at.x} ${leg.points[0]!.at.y} ${leg.points.at(-1)!.at.x} ${leg.points.at(-1)!.at.y}`
  $effect(() => {
    for (const leg of ahead?.slice(1) ?? []) {
      const a = leg.points[0]!, b = leg.points.at(-1)!, key = walkKey(leg)
      if (leg.mode !== 'walk' || a.continent !== b.continent || laterAsked.has(key)) continue
      laterAsked.add(key)
      void window.twinmap.walk({ continent: a.continent, from: { ...a.at }, to: { ...b.at }, fromZ: a.z, toZ: b.z }).then((path) => {
        if (path) laterWalks = { ...laterWalks, [key]: path.points }
      })
    }
  })
  // The colours Shortest Path gives the legs in the game.
  const LEG_COLOURS: Record<string, string> = { flight: '#33ff59', boat: '#00bfff', zeppelin: '#ff591a', tram: '#ff8000', lift: '#ff8000' }
  const journeyLayer = L.layerGroup()
  $effect(() => {
    journeyLayer.clearLayers()
    const goal = journeyGoal
    const dashes = (line: L.LatLng[], colour: string, opacity = 1, air = false): void => {
      for (const [color, weight] of [['#000', 7.5], [colour, 4.5]] as const) L.polyline(line, { color, weight, opacity, dashArray: '9 13', lineCap: 'round', lineJoin: 'round', interactive: false, ...(air && ARC) }).addTo(journeyLayer)
    }
    // The legs after the one under way, and the one under way when it is no walk: fainter than the walk the character is on.
    ahead?.forEach((leg, i) => {
      if (i === 0 && leg.mode === 'walk') return
      if (leg.mode === 'walk') {
        const found = laterWalks[walkKey(leg)]
        if (leg.points[0]!.continent === continent && leg.points.at(-1)!.continent === continent) dashes((found ?? leg.points.map((p) => p.at)).map(at), '#ffd100', 0.75)
        return
      }
      const colour = LEG_COLOURS[leg.mode]
      if (!colour) return // a hearthstone, a portal: a jump, with nothing between its ends
      // Only what lies on the continent shown: a boat that crosses the sea is cut where it leaves it.
      let run: L.LatLng[] = []
      for (const p of [...leg.points, null]) {
        if (p && p.continent === continent) run.push(at(p.at))
        else {
          if (run.length > 1) dashes(run, colour, 0.85, leg.mode === 'flight' || leg.mode === 'zeppelin') // through the air: an arc on the 3D view
          run = []
        }
      }
    })
    if (!goal) return
    if (walked && me && walked.continent === continent && me.continent === continent) {
      const rest = restOf(walked.points, me.units).rest.map(at)
      for (const [color, weight, dashArray] of [['#000', 7.5, '9 13'], ['#ffd100', 4.5, '9 13']] as const) L.polyline(rest, { color, weight, dashArray, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(journeyLayer)
    }
    if (goal.continent !== continent) return
    L.circleMarker(at(goal.at), { radius: 7, color: '#000', weight: 4, fill: false, interactive: false }).addTo(journeyLayer)
    L.circleMarker(at(goal.at), { radius: 7, color: '#ffd100', weight: 2, fillColor: '#ffd100', fillOpacity: 0.35 })
      .bindTooltip(Object.assign(document.createElement('span'), { textContent: `${goal.name}, the journey in the game` }), { direction: 'top', offset: [0, -8], className: 'tip' })
      .addTo(journeyLayer)
  })
  $effect(() => {
    // A ghost walks back: the way Shortest Path shows then is the same walk, drawn below.
    if (map && !inside && !(death?.ghost && back)) journeyLayer.addTo(map)
    else journeyLayer.remove()
  })

  // A death: the tombstone on the corpse, a ghost on the graveyard it came back at, and the way on
  // foot from the ghost to the corpse. Died in a dungeon, the way goes to its door, where the ghost
  // lives again. Found on the same grid as the journey's walks, again when the ghost strays off it.
  // The tombstone and the ghost are the game's own pictures; the way is in the red of the tombstone.
  const WAY_BACK = '#e0703a'
  const deathAt = $derived(death ? deathPlaces(death, maps, travel.doors) : { back: null, yard: null })
  $effect(() => {
    back = deathAt.back
  })
  let ghostWalk = $state<{ key: string; points: Point[] } | null>(null)
  let ghostAsking = false
  $effect(() => {
    const to = death?.ghost ? deathAt.back : null
    if (!to || !me || me.continent !== to.continent) return void (ghostWalk = null)
    const key = `${to.continent} ${to.at.x} ${to.at.y}`, from = me.units
    if (ghostWalk?.key === key && restOf(ghostWalk.points, from).off <= OFF_THE_WAY) return
    if (ghostAsking) return
    ghostAsking = true
    void window.twinmap.walk({ continent: to.continent, from: { ...from }, to: { ...to.at } }).then((path) => {
      ghostAsking = false
      ghostWalk = { key, points: path?.points ?? [from, to.at] }
    })
  })
  function deathIcon(name: string, size: number): L.DivIcon {
    const picture = new Image()
    picture.alt = ''
    picture.height = size
    picture.onerror = () => (picture.outerHTML = pin('corpse'))
    picture.src = `${TILES}/icons/${name}.png`
    return L.divIcon({ className: 'door death', iconSize: [size, size], html: picture })
  }
  const deathLayer = L.layerGroup()
  $effect(() => {
    deathLayer.clearLayers()
    const { back: to, yard } = deathAt
    if (ghostWalk && me && me.continent === continent && to?.continent === continent) {
      const rest = restOf(ghostWalk.points, me.units).rest.map(at)
      for (const [color, weight] of [['#000', 7.5], [WAY_BACK, 4.5]] as const) L.polyline(rest, { color, weight, dashArray: '9 13', lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(deathLayer)
    }
    if (death?.ghost && yard?.continent === continent)
      L.marker(at(yard.at), { keyboard: false, zIndexOffset: 700, icon: deathIcon('ghost', 26) }).bindTooltip('Graveyard', { direction: 'top', offset: [0, -13], className: 'tip' }).addTo(deathLayer)
    if (to?.continent !== continent) return
    if (to.door) {
      // The door has its swirl already: a ring in the colour of the way says it is the one to walk to.
      for (const [color, weight] of [['#000', 5], [WAY_BACK, 3]] as const) L.circleMarker(at(to.at), { radius: 24, color, weight, fill: false, interactive: false }).addTo(deathLayer)
      return
    }
    L.marker(at(to.at), { keyboard: false, zIndexOffset: 800, icon: deathIcon('corpse', 28) }).bindTooltip('Your corpse', { direction: 'top', offset: [0, -14], className: 'tip' }).addTo(deathLayer)
  })
  $effect(() => {
    if (map && layers.death && !inside) deathLayer.addTo(map)
    else deathLayer.remove()
  })

  // The route: a white line through its stops on this continent, and a disc on each. A stop done is
  // a dull disc with no number; the last has a ring more.
  const routeLayer = L.layerGroup()
  $effect(() => {
    routeLayer.clearLayers()
    const line: L.LatLng[][] = [[]]
    route.stops.forEach((stop, i) => {
      if (stop.continent !== continent) return void line.push([]) // the line does not cross the sea
      const done = i < route.next, last = i === route.stops.length - 1
      if (i >= route.next - 1) line.at(-1)!.push(at(stop.at))
      const html = `<i></i>${done ? '' : `<b>${i + 1}</b>`}`
      L.marker(at(stop.at), { keyboard: false, zIndexOffset: 600, icon: L.divIcon({ className: `stop${done ? ' done' : ''}${last ? ' last' : ''}`, iconSize: [16, 16], html }) })
        .bindTooltip(Object.assign(document.createElement('span'), { textContent: stop.name }), { direction: 'top', offset: [0, -8], className: 'tip' })
        .addTo(routeLayer)
    })
    for (const [color, weight] of [['#000', 5.5], ['#fff', 3]] as const) L.polyline(line, { color, weight, interactive: false, lineJoin: 'round' }).addTo(routeLayer)
  })
  $effect(() => {
    if (map && layers.route && !inside) routeLayer.addTo(map)
    else routeLayer.remove()
  })

  // The choices are saved as they are made, and the map follows them.
  $effect(() => {
    localStorage.setItem('layers', JSON.stringify(layers))
    if (!map) return
    layout()
    if (layers.bosses) pins.addTo(map)
    else pins.remove()
    if (!layers.arrow) arrow.remove()
    else if (arrow.getLatLng().lat || arrow.getLatLng().lng) place()
  })

  // L opens and closes Layers, F turns Follow on and off, N turns the map with the character, M sends the map to the other side of the panel, Esc closes the label and then Layers; with the
  // keyboard on the map, the space bar puts the label on its middle. Not while Settings lie over the map.
  function key(e: KeyboardEvent): void {
    if (holder.closest('[inert]')) return
    if (e.ctrlKey || e.altKey || e.metaKey || (e.target instanceof HTMLElement && e.target.matches('input:not([type=checkbox]), textarea'))) return
    if (e.key === 'Escape') {
      if (labelled) labelled = null
      else layersOpen = false
    } else if (e.key === 'l' || e.key === 'L') layersOpen = !layersOpen
    else if (e.key === 'f' || e.key === 'F') follow()
    else if (e.key === 'm' || e.key === 'M') setMapRight(!sides.mapRight)
    else if (e.key === '3' && !inside) void view3d(!threeD)
    else if (e.key === 'n' || e.key === 'N') setHeadingUp(!turning)
    else if (e.target === holder && e.key.startsWith('Arrow')) following = false // moved by hand, like a drag
    else if (e.key === ' ' && e.target === holder && map) {
      e.preventDefault()
      map.fire('click', { latlng: map.getCenter(), containerPoint: map.getSize().divideBy(2) })
    }
  }

  $effect(() => {
    void pos // each new position moves the arrow
    place()
  })

  // The list of the rooms, once: it is ready a little after the continents the first time.
  $effect(() => {
    if (!insideReady || interiors) return
    void fetch(`${TILES}/interiors.json`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<Interiors>) : undefined))
      .then((list) => {
        interiors = list
        showCities()
    showCaves()
        place()
        // Which of its buildings are caves: made right after the list.
        return fetch(`${TILES}/caves.json`)
      })
      .then((answer) => (answer.ok ? (answer.json() as Promise<{ worlds: Record<string, number[]> }>) : undefined))
      .then((list) => {
        buried = list?.worlds
        showCaves()
        return fetch(`${TILES}/under.json`)
      })
      .then((answer) => (answer.ok ? (answer.json() as Promise<{ worlds: Record<string, UnderRoom[]> }>) : undefined))
      .then((list) => {
        underRooms = list?.worlds
        inside3dSet()
      })
      .catch(() => {})
  })
</script>

<svelte:window onkeydown={key} onhashchange={() => (counting = location.hash === '#fps')} />

<div class="map" class:under={threeD} bind:this={holder}></div>
<div class="terrain" class:on={threeD} bind:this={terrainHost}><div class="map pins3d" bind:this={pinsHost}></div></div>
{#if counting && threeD}<p class="fps">{fps} fps</p>{/if}
<button class="compass" class:on={!!compass} class:turning bind:this={compassHost} tabindex={compass ? 0 : -1} aria-hidden={!compass} title={turning ? 'North up (N)' : 'Turn with your character (N)'} aria-label="Turn with your character" aria-pressed={turning} onclick={() => setHeadingUp(!turning)}></button>
{#if labelled}
  {#key labelled.units}
    <PointLabel
      title={savedIndex >= 0 ? pointName : labelled.title}
      item={labelled.item}
      notes={labelled.notes}
      where={labelled.where}
      {way}
      spot={labelled.spot}
      ring={onPin}
      box={labelled.box}
      sending={sendState(live, inbox, !!labelled.pin)}
      acked={inbox}
      onsend={() => {
        if (!labelled?.pin) return Promise.resolve({ error: 'There is nothing to send.' })
        sentTo = keyOf(labelled.continent, labelled.units)
        return window.twinmap.sendPin({ ...labelled.pin, name: pointName })
      }}
      following={!!labelled.pin && markPart(labelled.pin) === followedPart}
      onunfollow={() => window.twinmap.sendUnfollow()}
      routed={inRoute(route, labelled.continent, labelled.units)}
      onroute={() => {
        const stop = asStop()
        if (stop) onroute?.(stop)
      }}
      saved={savedForGood}
      onsave={() => {
        const pin = asStop()
        if (pin) setPins(savePin(myPins, pin))
      }}
      onrename={(name) => setPins(renamePin(myPins, savedIndex, name))}
      onremove={() => setPins(removePin(myPins, savedIndex))}
      onclose={() => (labelled = null)}
      dungeons={labelled.dungeons}
      ondungeon={(id) => openDungeon(id, labelled?.wing)}
    />
  {/key}
{/if}
<div class="corner top">
  <div class="line">
    {#if browsing}
      <button class="btn" onclick={goBack}>Back to {browsing.from}</button>
    {/if}
    {#if inside}
      <span class="tag">{inside.name}</span>
    {/if}
    {#each [1, 0] as const as which (which)}
      <button class="btn" aria-pressed={!inside && continent === which} onclick={() => choose(which)}>{NAMES[which]}</button>
    {/each}
    <button class="btn" aria-expanded={layersOpen} aria-controls="layers" title="Layers (L)" onclick={() => (layersOpen = !layersOpen)}>Layers</button>
    {#if !inside}
      <button class="view" role="switch" aria-checked={threeD} aria-label="3D view" title="2D or 3D view (3)" onclick={() => view3d(!threeD)}><i class="knob"></i><span class="two">2D</span><span class="three">3D</span></button>
    {/if}
  </div>
  {#if layersOpen}
    <div class="menu layers" id="layers" role="group" aria-label="Layers" in:fly={drop()} out:fade={gone}>
      <!-- Only the layers that draw something: a ticked box for one that is not built yet would not be true. -->
      {#each LAYER_GROUPS as group (group.name)}
        {#if group.layers.some((layer) => layer.built)}
          <!-- The name of a group turns all of it off, or on when any of it is off. -->
          {@const all = group.layers.filter((layer) => layer.built).map((layer) => layer.id)}
          {@const on = all.every((id) => layers[id])}
          <button class="group" aria-pressed={on} title={on ? `Hide all ${group.name}` : `Show all ${group.name}`} onclick={() => showAll(all, !on)}>{group.name}</button>
          {#each group.layers as layer (layer.id)}
            {#if layer.built}
              <label class="item"><input type="checkbox" class="check" bind:checked={layers[layer.id]} />{layer.name}</label>
            {/if}
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
  {#if inside && levels > 0}
    <div class="line" role="group" aria-label="Levels shown">
      <span class="tag">Levels</span>
      {#each Array.from({ length: levels + 1 }, (_, i) => i) as level (level)}
        <button class="btn" aria-pressed={upTo === level} title={level === levels ? 'Every room' : `Rooms up to level ${level + 1}`} onclick={() => showUpTo(level)}>{level + 1}</button>
      {/each}
    </div>
  {/if}
  {#if inside && inside.bosses.length && !pinned}
    <ol class="menu bosses" in:fly={drop()} out:fade={gone}>
      {#each inside.bosses as boss (boss)}
        <li class:dead={dead.has(nameOfBoss(boss))}>{boss}</li>
      {/each}
    </ol>
  {/if}
</div>
<div class="corner bottom">
  <button class="btn" aria-label="Zoom in" title="Zoom in (+)" aria-disabled={zoom >= 9} onclick={() => map?.zoomIn()}><Glyph name="plus" /></button>
  <button class="btn" aria-label="Zoom out" title="Zoom out (-)" aria-disabled={zoom <= 1} onclick={() => map?.zoomOut()}><Glyph name="minus" /></button>
  <button class="btn" aria-pressed={following} title="Follow your character (F)" onclick={follow}>Follow</button>
</div>
{#if offMap}
  <p class="map-note" in:fly={drop(8)} out:fade={gone}>This place is not on the map.</p>
{/if}

<style>
  .map {
    position: absolute;
    inset: 0;
    background: #000; /* the sea of the game's own pictures ends in black */
  }

  /* The 3D view lies over the 2D map, under the controls; hidden, it keeps its size. */
  .terrain {
    position: absolute;
    inset: 0;
    z-index: 1100;
    visibility: hidden;
  }
  .terrain.on {
    visibility: visible;
  }
  .terrain :global(canvas) {
    display: block;
  }
  /* Under the 3D view the 2D map is not drawn: it keeps its pins for the view to copy, but its
     thousands of elements made the page sort its layers out again at every frame of the view.
     Not content-visibility: after a change of continent it left the browser with the styles of the
     names and pins beside it never worked out again, so they stayed where they were. */
  .map.under {
    visibility: hidden;
  }
  /* The pins over the 3D view: the 2D map's look (.map), without its ground. */
  .pins3d {
    z-index: 1;
    background: none;
    pointer-events: none;
    overflow: hidden;
  }
  .fps {
    position: absolute;
    left: 12px;
    top: 124px;
    z-index: 1200;
    margin: 0;
    padding: 2px 8px;
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    font: 14px monospace;
    pointer-events: none;
  }
  /* The compass: bottom left, in 2D and 3D; a click turns the map with the character, or the north up again. */
  .compass {
    position: absolute;
    left: 12px;
    bottom: calc(12px + var(--lift, 0px));
    z-index: 1200;
    width: 110px;
    height: 110px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms;
  }
  .compass.on {
    opacity: 1;
    pointer-events: auto;
  }
  /* Turning with the character: a ring of gold round the bezel, glowing softly. */
  .compass.turning::after {
    content: '';
    position: absolute;
    inset: 7px;
    border-radius: 50%;
    box-shadow:
      0 0 0 2px var(--gold),
      0 0 14px 3px rgb(234 203 164 / 0.55);
    pointer-events: none;
  }
  .compass :global(canvas) {
    display: block;
  }
  /* The view switch: a dark box with 2D and 3D in it; a red block like the buttons lies on the one in use and slides to the other. */
  .view {
    position: relative;
    display: flex;
    height: 32px;
    padding: 0;
    border: 1px solid #120b05;
    border-radius: 4px;
    cursor: pointer;
    font: var(--t-label);
    color: var(--bronze-500);
    text-shadow: 0 1px 0 #000;
    background: linear-gradient(#000, var(--stone-800));
    box-shadow:
      inset 0 0 0 1px var(--bronze-700),
      inset 0 2px 4px #000,
      0 2px 4px #000d;
  }
  .view:hover {
    box-shadow:
      inset 0 0 0 1px var(--bronze-500),
      inset 0 2px 4px #000,
      0 2px 4px #000d;
  }
  .view:focus-visible {
    outline: none;
    box-shadow:
      inset 0 0 0 1px var(--bronze-500),
      0 0 0 5px #000;
  }
  .view span {
    position: relative;
    z-index: 1;
    width: 38px;
    line-height: 30px;
    text-align: center;
    transition: color var(--quick);
  }
  .view .knob {
    position: absolute;
    top: 0;
    left: 0;
    width: 38px;
    height: 30px;
    border-radius: 3px;
    transition: transform 180ms ease;
    background: linear-gradient(var(--red-top), var(--red-mid) 55%, var(--red-low));
    box-shadow:
      inset 0 1px 0 #ffb09a66,
      inset 0 0 0 1px var(--bronze-400),
      inset 0 -6px 8px #0005,
      0 1px 3px #000;
  }
  .view[aria-checked='true'] .knob {
    transform: translateX(38px);
  }
  .view[aria-checked='false'] .two,
  .view[aria-checked='true'] .three {
    color: var(--gold-pale);
  }

  /* The controls sit inside the frame, over its vignette. */
  .corner {
    position: absolute;
    right: 22px;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    /* The box is as wide as its widest row: only what is in it takes the mouse, the map shows through the rest. */
    pointer-events: none;
  }
  .corner > :global(*) {
    pointer-events: auto;
  }
  .corner.top {
    top: 22px;
    gap: 8px;
  }
  .corner.bottom {
    bottom: calc(22px + var(--lift, 0px)); /* above what lies over the foot of the map on a small screen */
    gap: 4px;
  }
  .corner .btn {
    min-width: 32px;
    height: 32px;
  }
  @media (pointer: coarse) {
    .corner .btn {
      min-width: 44px;
      height: 44px;
    }
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    max-width: calc(100cqw - 44px); /* the map's width less the two margins */
  }
  .tag {
    margin-right: 4px;
    color: #fff;
    text-shadow:
      0 1px 3px #000,
      0 0 2px #000;
  }

  /* Layers stays open until it is closed. It ends above the zoom buttons; on a low window it scrolls. */
  .layers {
    max-height: calc(100vh - 250px);
    overflow-y: auto;
  }

  /* On a narrow map the buttons keep the top and the zone goes under them (App.svelte). */
  @container (max-width: 640px) {
    .fps {
      top: 190px;
    }
  }
  /* The map draws its keyboard ring on the frame (App.svelte). */
  .map:focus-visible {
    outline: none;
  }

  /* The bosses of a raid: the game names them but not where they stand. */
  .bosses {
    min-width: 0;
    padding: 8px 12px 8px 32px;
    list-style: decimal;
    font: var(--t-small);
  }

  /* The ring is drawn inside the marker: the marker itself is moved by the map. */
  .map :global(.ring) {
    background: none;
    border: 0;
    pointer-events: none;
  }
  .map :global(.ring::after) {
    content: '';
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border: 2px solid var(--gold);
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px #000, inset 0 0 0 1.5px #000, 0 0 10px 2px var(--on-glow);
    animation: ring 1.1s ease-in-out infinite alternate;
  }
  @keyframes -global-ring {
    to {
      transform: scale(1.18);
    }
  }

  /* A stop of the route: a dark disc with a gold ring, its number in white beside it. */
  .map :global(.stop) {
    background: none;
    border: 0;
  }
  .map :global(.stop i) {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border: 2.5px solid var(--gold);
    border-radius: 50%;
    background: var(--plate-ink);
    box-shadow: 0 0 0 1.5px #000;
  }
  .map :global(.stop.last i) {
    box-shadow:
      0 0 0 1.5px #000,
      inset 0 0 0 1.5px var(--plate-ink),
      inset 0 0 0 3px var(--gold);
  }
  .map :global(.stop.done i) {
    border-color: var(--text-dim);
    background: var(--text-dim);
  }
  .map :global(.stop b) {
    position: absolute;
    left: 20px;
    top: -2px;
    font: 600 14px/20px var(--font);
    color: #fff;
    text-shadow:
      0 0 2px #000,
      0 0 2px #000,
      0 1px 2px #000;
  }
  .map :global(.me),
  .map :global(.door),
  .map :global(.place) {
    background: none;
    border: 0;
  }
  /* The swirl of a door, or the drawn door in its place, in the middle of its square. */
  .map :global(.swirl) {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }
  /* A soft light of its own colour under an objective: it is found at a glance on any ground. */
  .map :global(.task) {
    border-radius: 50%;
    box-shadow: 0 0 9px 4px color-mix(in srgb, var(--objective) 55%, transparent);
  }


  /* The names lie over the map as if hung above it: light letters, a close dark edge to read on
     any ground, and a wide soft shadow under them. Each kind has its size; the larger the thing
     named, the wider its letters are set. A name fades in and out. */
  .map :global(.place span) {
    position: absolute;
    translate: -50% -50%;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.3s;
    color: #fff;
    /* The close edge is a real one, drawn under the letters: a blur alone gives way on snow. */
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
    text-shadow:
      0 1px 2px #000,
      0 4px 12px #000c;
  }
  .map :global(.place.on span) {
    opacity: 1;
  }
  .map :global(.region span) {
    font: 400 17px/22px var(--display);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
  .map:global(.far) :global(.region span) {
    font: 400 12.5px/16px var(--display);
    letter-spacing: 0.14em;
  }
  .map :global(.town span) {
    font: 400 17px/21px var(--display);
    letter-spacing: 0.03em;
    color: var(--gold-pale);
  }
  .map :global(.poi span),
  .map :global(.area span) {
    font: 500 13.5px/17px var(--font);
    letter-spacing: 0.02em;
    color: #efe6d2;
  }

  .map :global(.relief) {
    mix-blend-mode: soft-light;
  }
  .map :global(.leaflet-container) {
    font: inherit;
  }
  /* A dark light under a boss, and its name under the skull: light letters with a dark edge, like
     the names of the places. */
  .map :global(.boss) {
    border-radius: 50%;
    box-shadow: 0 0 10px 4px #a3201a99;
  }
  .map :global(.boss-name) {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    font: var(--t-small);
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
  }
  .map :global(.boss-name.dead) {
    color: #a39a8c;
    text-decoration: line-through;
  }
  .bosses .dead {
    color: var(--text-dim);
    text-decoration: line-through;
  }
  .map :global(.boss-name::before) {
    display: none;
  }
  /* The name of a pin under the pointer: ours, like a menu. */
  .map :global(.tip) {
    padding: 2px 8px;
    border: 1px solid var(--float-edge);
    border-radius: 0;
    background: var(--float);
    box-shadow:
      0 0 0 1px #000,
      0 6px 16px #000000b3;
    font: var(--t-small);
    color: var(--text);
  }
  .map :global(.tip::before) {
    display: none;
  }
</style>