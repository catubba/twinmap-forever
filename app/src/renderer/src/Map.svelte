<script lang="ts">
  // The map: the game's own pictures of the two continents, the names of the zones, and the
  // character as an arrow. It follows the character until the player drags the map away.
  // Inside a dungeon or a raid it shows that instead: its rooms, its bosses, its entrance.
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import { onMount } from 'svelte'
  import { DUNGEON_PINS } from '../../shared/dungeon-pins'
  import type { Position } from '../../shared/game'
  import { unitsOfPlace, unitsOfRect, type Point } from '../../shared/geo'
  import { addFix, BEHIND, PERIOD, whereAt, type Fix } from '../../shared/glide'
  import { boxOf, buildingsAt, piecesIn, roomPixels, yardsInside, YARDS_PER_UNIT, type Box, type InteriorMap, type Interiors, type Piece, type Yards } from '../../shared/inside'
  import type { Continent, GameMap } from '../../shared/maps'
  import type { QuestPin } from '../../shared/quests'
  import { iconOf, serves, type FixedLayer, type FixedPin, type Travel } from '../../shared/services'
  import { pictureOfBlock, tileOfPicture } from '../../shared/pixels'
  import { WORLDS } from '../../shared/world'
  import { LAYER_GROUPS, layersFrom, type LayerId } from '../../shared/layers'
  import { fitNames, tierRank, tierShows, type NameBox, type NameTier, type Place } from '../../shared/places'
  import { wayTo, zoneAt, type Size } from '../../shared/point-label'
  import { fade, fly } from 'svelte/transition'
  import Glyph from './Glyph.svelte'
  import { drop, gone, still } from './motion'
  import PointLabel from './PointLabel.svelte'
  import { inRoute, noRoute, type Route, type Stop } from '../../shared/route'
  import { removePin, renamePin, savedAt, savedFrom, savePin } from '../../shared/saved'
  import { sendState, type Inbox } from '../../shared/send'
  import { pin } from './marks'

  // at: when the position was read off the game, in milliseconds.
  // insideReady: the rooms of the buildings are converted, and their list can be asked for.
  let { pos, at: readAt, insideReady, quests = [], fixed = [], side, live = false, inbox = null, route = noRoute(), onroute }: { pos: Position | undefined; at: number | undefined; insideReady: boolean; quests?: QuestPin[]; fixed?: FixedPin[]; side?: string; live?: boolean; inbox?: Inbox | null; route?: Route; onroute?: (stop: Stop) => void } = $props()

  const TILES = 'twinmap://tiles'
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

  // The layers the player wants on the map: remembered from one run of the app to the next.
  let layers = $state(layersFrom(localStorage.getItem('layers')))
  let layersOpen = $state(false)
  // The point the player clicked, with its label: in map units, and where that is in the map's box now.
  // pin: the same point as the game names it, a zone map and a place on it; none where no zone is.
  let labelled = $state<{ units: Point; continent: Continent; title: string; where: string; spot: Point; box: Size; pin: { m: number; x: number; y: number } | null; plain?: boolean } | null>(null)
  // Where the character is on the world map, for the distance on the label.
  let me = $state<{ units: Point; continent: Continent } | null>(null)
  const way = $derived(labelled && me && me.continent === labelled.continent ? wayTo(me.units, labelled.units) : null)
  // My pins: the points the player saved, remembered from one run of the app to the next.
  let myPins = $state.raw(savedFrom(localStorage.getItem('pins')))
  $effect(() => localStorage.setItem('pins', JSON.stringify(myPins)))
  // The labelled point as one of them, or -1; and the point under the name it goes by: a saved one has its own.
  const savedIndex = $derived(labelled ? savedAt(myPins, labelled.continent, labelled.units) : -1)
  const pointName = $derived(!labelled ? '' : savedIndex >= 0 ? myPins[savedIndex]!.name : labelled.plain ? `${labelled.title} ${labelled.where}` : labelled.title)
  const asStop = (): Stop | null => labelled && { name: pointName, continent: labelled.continent, at: { ...labelled.units }, pin: labelled.pin && { ...labelled.pin } }

  // Leaflet's plain coordinates: a map unit is a pixel of zoom 0, north is up.
  const at = (p: Point): L.LatLng => L.latLng(-p.y, p.x)
  const atYards = (y: Yards): L.LatLng => at({ x: y.u / YARDS_PER_UNIT, y: y.v / YARDS_PER_UNIT })
  const boundsOf = (m: GameMap): L.LatLngBounds => {
    const [a, b] = unitsOfRect(m.rect!)
    return L.latLngBounds(at(a), at(b))
  }
  const boundsOfBox = ([u1, v1, u2, v2]: Box): L.LatLngBounds => L.latLngBounds(atYards({ u: u1, v: v1 }), atYards({ u: u2, v: v2 }))
  const WORLD_BOUNDS = L.latLngBounds([-256, 0], [0, 256])

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
  let named: { tier: NameTier; at: L.LatLng; marker: L.Marker; sizes: Record<string, [number, number]> }[] = []
  let places: Place[] = []
  const pins = L.layerGroup()
  const arrow = L.marker([0, 0], {
    zIndexOffset: 2000,
    interactive: false,
    keyboard: false, // nothing to do on it: not a stop for Tab
    icon: L.divIcon({
      className: 'me',
      iconSize: [28, 28],
      html: pin('player'),
    }),
  })
  let turned = 0
  function turnTo(degrees: number): void {
    turned += ((((degrees - turned) % 360) + 540) % 360) - 180 // the short way round
    const svg = arrow.getElement()?.firstElementChild as SVGElement | null
    if (svg) svg.style.transform = `rotate(${turned}deg)`
  }

  // The ground of a continent or of a dungeon, from its folder. The halved tiles stay under
  // everything at every zoom, stretched past their own detail: while the sharp tiles of a place are
  // still being read, the map shows it blurred, never black. The game's own blocks go on top, from
  // halfway between the two kinds of tile up.
  function ground(folder: string, opacity = 1): void {
    if (!map) return
    for (const layer of shown) layer.remove()
    shown = [
      L.tileLayer(`${TILES}/${folder}/{z}/{x}/{y}.png`, { minZoom: 0, maxZoom: 9, maxNativeZoom: TOP_ZOOM - 2, bounds: WORLD_BOUNDS, errorTileUrl: BLANK, keepBuffer: 4, zIndex: 1, opacity }).addTo(map),
      new BlockLayer({ world: folder, minZoom: TOP_ZOOM - 1.5, minNativeZoom: TOP_ZOOM - 1, maxNativeZoom: TOP_ZOOM, bounds: WORLD_BOUNDS, keepBuffer: 3, zIndex: 2, opacity }).addTo(map),
    ]
  }

  // Puts these rooms on the map, in place of the ones before.
  function showRooms(pieces: Piece[]): void {
    rooms?.remove()
    const box = boxOf(pieces)
    rooms = map && box ? new RoomsLayer({ pieces, bounds: boundsOfBox(box), keepBuffer: 2, zIndex: 3 }).addTo(map) : undefined
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
    if (box) cities = new RoomsLayer({ pieces, bounds: boundsOfBox(box), minZoom: 3, keepBuffer: 2, zIndex: 3 }).addTo(map)
  }

  // Writes the names of the continent on show: its regions, its towns, its points
  // of interest and the areas of its zones. A city has a map of its own but is not a region:
  // its name comes with the towns.
  function writeNames(): void {
    labels.clearLayers()
    named = []
    const name = (tier: NameTier, text: string, at: L.LatLng): void => {
      const html = `<span>${text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`
      named.push({ tier, at, sizes: {}, marker: L.marker(at, { interactive: false, keyboard: false, icon: L.divIcon({ className: `place ${tier}`, html, iconSize: [0, 0] }) }).addTo(labels) })
    }
    const zones = maps.filter((m) => m.level === 'zone' && m.continent === continent && m.rect)
    // ponytail: a city is told from a region by the size of its map (Stormwind, the largest, is 2.0 million
    // square yards; Moonglade, the smallest region, 3.5). Read the kind of area from the game if a city ever outgrows this.
    for (const m of zones) if ((m.rect!.maxX - m.rect!.minX) * (m.rect!.maxY - m.rect!.minY) > CITY_UNDER) name('region', m.name, boundsOf(m).getCenter())
    for (const p of places) if (p.continent === continent) name(p.kind, p.name, at(p))
    named.sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
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
    if (labelled && labelled.continent !== which) labelled = null
    showRooms([])
    under = ''
    pins.clearLayers()
    continent = which
    writeNames()
    showCities()
    const whole = maps.find((m) => m.level === 'continent' && m.continent === which && m.parent !== 0)
    // At once: a zoom still running would end by putting this view back over whatever came after it.
    if (fit && whole?.rect) map.fitBounds(boundsOf(whole), { animate: false })
  }

  // Puts a dungeon or a raid on the map: its ground dimmed, its rooms, its bosses and its entrance.
  function showInside(m: InteriorMap): void {
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
    levels = Math.max(0, ...m.pieces.map((p) => p.level))
    upTo = levels
    showRooms(m.pieces)
    // The dungeons of this map: one, or its wings.
    const dungeons = DUNGEON_PINS.filter((d) => d.map === m.id)
    pinned = dungeons.length > 0
    const dot = (u: number, v: number, color: string, name: string): void => {
      L.circleMarker(atYards({ u, v }), { radius: 6, color: '#000', weight: 1.5, fillColor: color, fillOpacity: 1 }).bindTooltip(name, { direction: 'top', offset: [0, -6], className: 'tip' }).addTo(pins)
    }
    for (const d of dungeons) {
      for (const [name, u, v] of d.bosses) dot(u, v, '#ff5a4d', name)
      if (d.entrance)
        L.marker(atYards({ u: d.entrance[0], v: d.entrance[1] }), { keyboard: false, icon: L.divIcon({ className: 'door', iconSize: [16, 16], html: pin('dungeon') }) })
          .bindTooltip(dungeons.length > 1 ? `Entrance: ${d.name}` : 'Entrance', { direction: 'top', offset: [0, -8], className: 'tip' })
          .addTo(pins)
    }
    const box = dungeons.length
      ? dungeons.reduce<Box>((all, d) => [Math.min(all[0], d.bounds[0]), Math.min(all[1], d.bounds[1]), Math.max(all[2], d.bounds[2]), Math.max(all[3], d.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity])
      : boxOf(m.pieces)
    if (box) map.fitBounds(boundsOfBox(box), { animate: false }) // at once: the arrow is placed against this view
  }

  // Shows the rooms up to a level: the ones above are taken off, to see what they cover.
  function showUpTo(level: number): void {
    if (!inside) return
    upTo = level
    showRooms(inside.pieces.filter((p) => p.level <= level))
  }

  function choose(which: Continent): void {
    following = false
    show(which, true)
  }

  /**
   * Takes the map to a place and opens the label on it: for a row chosen in the panel, for a
   * result of the search. zoom: how near to look, when the map is farther than that.
   */
  export function goTo(to: { continent: Continent; at: Point; title: string; where?: string; zoom?: number; whole?: GameMap }): void {
    if (!map || !maps.length) return
    following = false
    if (inside || continent !== to.continent) show(to.continent, false)
    const view = map
    // whole: a zone was asked for, and all of it is put in view.
    if (to.whole?.rect) view.fitBounds(boundsOf(to.whole), { animate: false })
    else view.setView(at(to.at), Math.max(view.getZoom(), to.zoom ?? 5), { animate: false })
    const found = zoneAt(maps, to.continent, to.at)
    labelled = {
      units: to.at,
      continent: to.continent,
      title: to.title,
      // The caller may know the zone better: where two maps overlap, the point alone does not tell.
      where: to.where ?? (found ? `${found.zone.name} ${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : ''),
      spot: view.latLngToContainerPoint(at(to.at)),
      box: { width: holder.clientWidth, height: holder.clientHeight },
      pin: found ? { m: found.zone.id, ...found.place } : null,
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
    if (following) place(true)
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

  onMount(() => {
    const made = L.map(holder, { zoomControl: false, crs: L.CRS.Simple, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, attributionControl: false, zoomAnimation: !still(), fadeAnimation: !still(), maxBounds: WORLD_BOUNDS.pad(0.2) })
    map = made
    made.setView([-128, 128], 2)
    pins.addTo(made)
    made.on('dragstart', () => (following = false))
    made.on('zoomend', layout)
    made.on('moveend', layoutSoon)
    made.on('zoomstart', () => (zooming = true))
    made.on('zoomend', () => (zooming = false))
    made.on('zoomend', () => (zoom = made.getZoom()))
    // A window made wider or narrower: the map that follows puts the character back in its middle.
    made.on('resize', () => {
      if (following) place(true)
    })
    // Names are measured as they are drawn: once the typefaces are in, they are measured again.
    void document.fonts.ready.then(() => {
      for (const n of named) n.sizes = {}
      layout()
    })
    // A click on the world map puts the label on that point. Inside a dungeon there is nothing to say of a point yet.
    made.on('click', (e) => {
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
        box: { width: holder.clientWidth, height: holder.clientHeight },
        pin: found ? { m: found.zone.id, ...found.place } : null,
      }
    })
    // The label stays on its point while the map moves under it.
    made.on('move zoom resize', () => {
      if (labelled) Object.assign(labelled, { spot: made.latLngToContainerPoint(at(labelled.units)), box: { width: holder.clientWidth, height: holder.clientHeight } })
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
    return () => {
      clearTimeout(laying)
      cancelAnimationFrame(gliding)
      map = undefined
      made.remove()
    }
  })


  // The quests Questie shows, on the zones of the continent in view: where to take one, where to hand
  // one in, where what is still to find is. Each kind is a layer of its own.
  const questLayers = { available: L.layerGroup(), turnin: L.layerGroup(), objectives: L.layerGroup() }
  const QUEST_PINS = { available: ['quest', 'available', 500], turnin: ['turnin', 'turnin', 1000], objective: ['objective', 'objectives', 0] } as const
  $effect(() => {
    for (const group of Object.values(questLayers)) group.clearLayers()
    const zones = new Map(maps.filter((m) => m.level === 'zone' && m.rect && m.area && m.continent === continent).map((m) => [m.area, m]))
    for (const p of quests) {
      const zone = zones.get(p.area)
      if (!zone?.rect) continue
      const [drawing, layer, above] = QUEST_PINS[p.type]
      // Names come from the player's QuestieDB: written as text, never as markup.
      const tip = document.createElement('span')
      tip.append(Object.assign(document.createElement('b'), { textContent: p.name }))
      for (const quest of p.quests) if (quest !== p.name) tip.append(document.createElement('br'), quest)
      const size = drawing === 'objective' ? 9 : 20
      L.marker(at(unitsOfPlace(zone.rect, p.x, p.y)), { keyboard: false, zIndexOffset: above, icon: L.divIcon({ className: 'door', iconSize: [size, size], html: pin(drawing) }) })
        .bindTooltip(tip, { direction: 'top', offset: [0, -size / 2], className: 'tip' })
        .addTo(questLayers[layer])
    }
  })
  // Not inside a dungeon, whose map is another; not from far, where they would cover the land.
  $effect(() => {
    for (const [id, group] of Object.entries(questLayers) as [keyof typeof questLayers, L.LayerGroup][]) {
      if (map && layers[id] && !inside && zoom >= PIN_ZOOM) group.addTo(map)
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
      const ctx = this._renderer._ctx, { x, y } = this._point, picture = this.options.picture
      if (picture.naturalWidth) {
        const size = this.options.lozenge ? 20 : 24
        ctx.imageSmoothingQuality = 'high'
        return void ctx.drawImage(picture, x - size / 2, y - size / 2, size, size)
      }
      ctx.beginPath()
      if (this.options.lozenge) {
        ctx.moveTo(x, y - 5.1)
        ctx.lineTo(x + 5.1, y)
        ctx.lineTo(x, y + 5.1)
        ctx.lineTo(x - 5.1, y)
        ctx.closePath()
      } else ctx.rect(x - 6.25, y - 6.25, 12.5, 12.5)
      ctx.fillStyle = this.options.fillColor
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#000'
      ctx.stroke()
    },
  }) as unknown as new (at: L.LatLng, options: L.CircleMarkerOptions & { lozenge: boolean; picture: HTMLImageElement }) => L.CircleMarker
  const fixedGroup = L.layerGroup()
  let laid: { pin: FixedPin; at: L.LatLng }[] = []
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
    const view = map.getBounds().pad(0.5), far = map.getZoom()
    drawnFor = { view, far }
    // Ore and herbs first, so that who offers a service is painted over them.
    for (const service of [false, true]) {
      for (const { pin: p, at: where } of laid) {
        const shown = (layer: FixedLayer): boolean => layers[layer] && far >= FIXED_ZOOM[layer]
        if ((p.side !== undefined) !== service || !p.layers.some(shown) || !view.contains(where)) continue
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
          .addTo(fixedGroup)
      }
    }
  }
  $effect(() => {
    const zones = new Map(maps.filter((m) => m.level === 'zone' && m.rect && m.area && m.continent === continent).map((m) => [m.area, m]))
    laid = fixed.flatMap((p) => {
      const zone = zones.get(p.area)
      return zone?.rect && serves(p, side) ? [{ pin: p, at: at(unitsOfPlace(zone.rect, p.x, p.y)) }] : []
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
  $effect(() => {
    for (const group of Object.values(travelLayers)) group.clearLayers()
    for (const door of travel.doors) {
      if (door.continent !== continent) continue
      L.marker(at(door), { keyboard: false, zIndexOffset: 200, icon: L.divIcon({ className: 'door', iconSize: [16, 16], html: pin('dungeon') }) })
        .bindTooltip(door.names.join(', '), { direction: 'top', offset: [0, -8], className: 'tip' })
        .addTo(travelLayers.dungeons)
    }
    for (const [a, b] of travel.routes) {
      const from = travel.nodes[a], to = travel.nodes[b]
      if (!from || !to || from.continent !== continent || !serves(from, side) || !serves(to, side)) continue
      L.polyline([at(from), at(to)], { color: '#7fc8ff', weight: 1.5, opacity: 0.6, interactive: false }).addTo(travelLayers.routes)
    }
  })
  $effect(() => {
    for (const [id, group] of Object.entries(travelLayers) as [keyof typeof travelLayers, L.LayerGroup][]) {
      if (map && layers[id] && !inside && zoom >= 2) group.addTo(map)
      else group.remove()
    }
  })

  // My pins: a small flag on each saved point of this continent. A click opens its label.
  const myPinsLayer = L.layerGroup()
  $effect(() => {
    myPinsLayer.clearLayers()
    for (const saved of myPins) {
      if (saved.continent !== continent) continue
      L.marker(at(saved.at), { keyboard: false, zIndexOffset: 400, icon: L.divIcon({ className: 'door mine', iconSize: [16, 16], html: pin('flag') }) })
        .bindTooltip(Object.assign(document.createElement('span'), { textContent: saved.name }), { direction: 'top', offset: [0, -8], className: 'tip' })
        .on('click', () => {
          if (!map) return
          const found = zoneAt(maps, saved.continent, saved.at)
          labelled = {
            units: { ...saved.at },
            continent: saved.continent,
            title: saved.name,
            where: found ? `${found.zone.name} ${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : '',
            spot: map.latLngToContainerPoint(at(saved.at)),
            box: { width: holder.clientWidth, height: holder.clientHeight },
            pin: saved.pin && { ...saved.pin },
          }
        })
        .addTo(myPinsLayer)
    }
  })
  $effect(() => {
    if (map && layers.mypins && !inside) myPinsLayer.addTo(map)
    else myPinsLayer.remove()
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

  // L opens and closes Layers, F turns Follow on and off, Esc closes the label and then Layers; with the
  // keyboard on the map, the space bar puts the label on its middle. Not while Settings lie over the map.
  function key(e: KeyboardEvent): void {
    if (holder.closest('[inert]')) return
    if (e.ctrlKey || e.altKey || e.metaKey || (e.target instanceof HTMLElement && e.target.matches('input:not([type=checkbox]), textarea'))) return
    if (e.key === 'Escape') {
      if (labelled) labelled = null
      else layersOpen = false
    } else if (e.key === 'l' || e.key === 'L') layersOpen = !layersOpen
    else if (e.key === 'f' || e.key === 'F') follow()
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
        place()
      })
      .catch(() => {})
  })
</script>

<svelte:window onkeydown={key} />

<div class="map" bind:this={holder}></div>
{#if labelled}
  {#key labelled.units}
    <PointLabel
      title={savedIndex >= 0 ? pointName : labelled.title}
      where={labelled.where}
      {way}
      spot={labelled.spot}
      box={labelled.box}
      sending={sendState(live, inbox, !!labelled.pin)}
      acked={inbox?.seq}
      onsend={() => (labelled?.pin ? window.twinmap.sendPin({ ...labelled.pin, name: pointName }) : Promise.resolve({ error: 'There is nothing to send.' }))}
      routed={inRoute(route, labelled.continent, labelled.units)}
      onroute={() => {
        const stop = asStop()
        if (stop) onroute?.(stop)
      }}
      saved={savedIndex >= 0}
      onsave={() => {
        const pin = asStop()
        if (pin) myPins = savePin(myPins, pin)
      }}
      onrename={(name) => (myPins = renamePin(myPins, savedIndex, name))}
      onremove={() => (myPins = removePin(myPins, savedIndex))}
      onclose={() => (labelled = null)}
    />
  {/key}
{/if}
<div class="corner top">
  <div class="line">
    {#if inside}
      <span class="tag">{inside.name}</span>
    {/if}
    {#each [0, 1] as const as which (which)}
      <button class="btn" aria-pressed={!inside && continent === which} onclick={() => choose(which)}>{NAMES[which]}</button>
    {/each}
    <button class="btn" aria-expanded={layersOpen} aria-controls="layers" title="Layers (L)" onclick={() => (layersOpen = !layersOpen)}>Layers</button>
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
        <li>{boss}</li>
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
    bottom: 22px;
    gap: 4px;
  }
  .corner .btn {
    min-width: 32px;
    height: 32px;
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

  /* On a narrow map the buttons go under the zone and its coordinates, which they would cover. */
  @container (max-width: 640px) {
    .corner.top {
      top: 84px;
    }
    .layers {
      max-height: calc(100vh - 312px);
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

  .map :global(.me svg) {
    transition: transform 0.25s linear;
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

  .map :global(.leaflet-container) {
    font: inherit;
  }
  /* The name of a boss over its dot: ours, like a menu. */
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