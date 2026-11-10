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
  import { boxOf, buildingsAt, piecesIn, roomPixels, yardsInside, YARDS_PER_UNIT, type Box, type InteriorMap, type Interiors, type Piece, type Yards } from '../../shared/inside'
  import type { Continent, GameMap } from '../../shared/maps'
  import { pictureOfBlock, tileOfPicture } from '../../shared/pixels'
  import { WORLDS } from '../../shared/world'
  import { LAYER_GROUPS, layersFrom } from '../../shared/layers'
  import { fitNames, tierRank, tierShows, type NameBox, type NameTier, type Place } from '../../shared/places'
  import { wayTo, zoneAt, type Size } from '../../shared/point-label'
  import { fade, fly } from 'svelte/transition'
  import Glyph from './Glyph.svelte'
  import { drop, gone } from './motion'
  import PointLabel from './PointLabel.svelte'
  import { pin } from './marks'

  // insideReady: the rooms of the buildings are converted, and their list can be asked for.
  let { pos, insideReady }: { pos: Position | undefined; insideReady: boolean } = $props()

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
  const FAR = 3 // under this zoom the names of the regions are written small
  const GROUND_INSIDE = 0.45 // how bright the ground of a dungeon is: its rooms are what matters

  let holder: HTMLDivElement
  let map: L.Map | undefined
  let maps = $state<GameMap[]>([])
  let continent = $state<Continent>(0)
  let following = $state(true)
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
  let labelled = $state<{ units: Point; continent: Continent; title: string; where: string; spot: Point; box: Size } | null>(null)
  // Where the character is on the world map, for the distance on the label.
  let me = $state<{ units: Point; continent: Continent } | null>(null)
  const way = $derived(labelled && me && me.continent === labelled.continent ? wayTo(me.units, labelled.units) : null)

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
      if (width) boxes.push({ id, x: p.x, y: p.y, width, height })
      else delete n.sizes[scale] // not drawn yet: measured the next time
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
  // The arrow moves every second: the names make room for it a moment later, once.
  let laying = 0
  const layoutSoon = (): void => {
    clearTimeout(laying)
    laying = window.setTimeout(layout, 150)
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
      L.circleMarker(atYards({ u, v }), { radius: 6, color: '#000', weight: 1.5, fillColor: color, fillOpacity: 1 }).bindTooltip(name, { direction: 'top', offset: [0, -6] }).addTo(pins)
    }
    for (const d of dungeons) {
      for (const [name, u, v] of d.bosses) dot(u, v, '#e0483e', name)
      if (d.entrance) dot(d.entrance[0], d.entrance[1], '#5fd17a', dungeons.length > 1 ? `Entrance: ${d.name}` : 'Entrance')
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

  function follow(): void {
    following = !following
    if (following) place(true)
  }

  // Puts the arrow on a place, turned as the character is.
  function mark(here: L.LatLng): void {
    if (!map) return
    arrow.setLatLng(here)
    if (layers.arrow) arrow.addTo(map)
    else arrow.remove()
    layoutSoon()
    if (pos?.facing !== undefined) turnTo(360 - pos.facing) // the game counts anticlockwise from north
  }

  // The arrow on a place, and the map with it when it follows. loose: the map moves only once the
  // arrow is at its edge, so a dungeon that fits the window stays still.
  function point(here: L.LatLng, jump: boolean, loose = false): void {
    if (!map) return
    mark(here)
    const there = loose ? map.getBounds().pad(-0.05).contains(here) : map.getCenter().equals(here)
    if (following && (jump || !there)) map.panTo(here, { animate: !jump, duration: 0.9, easeLinearity: 1 })
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
      if (entering) mark(atYards(where))
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
    const made = L.map(holder, { zoomControl: false, crs: L.CRS.Simple, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, attributionControl: false, maxBounds: WORLD_BOUNDS.pad(0.2) })
    map = made
    made.setView([-128, 128], 2)
    pins.addTo(made)
    made.on('dragstart', () => (following = false))
    made.on('zoomend moveend', layout)
    // Names are measured as they are drawn: once the typefaces are in, they are measured again.
    void document.fonts.ready.then(() => {
      for (const n of named) n.sizes = {}
      layout()
    })
    // A click on the world map puts the label on that point. Inside a dungeon there is nothing to say of a point yet.
    made.on('click', (e) => {
      if (inside) return
      const units = { x: e.latlng.lng, y: -e.latlng.lat }, found = zoneAt(maps, continent, units)
      labelled = {
        units,
        continent,
        title: found?.zone.name ?? NAMES[continent],
        where: found ? `${found.place.x.toFixed(1)}, ${found.place.y.toFixed(1)}` : '',
        spot: e.containerPoint,
        box: { width: holder.clientWidth, height: holder.clientHeight },
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
    void fetch(`${TILES}/places.json`)
      .then((answer) => (answer.ok ? (answer.json() as Promise<Place[]>) : []))
      .then((list) => {
        places = list
        if (maps.length && !inside) writeNames()
      })
      .catch(() => {})
    return () => made.remove()
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

  // L opens and closes Layers, F turns Follow on and off, Esc closes the label and then Layers.
  function key(e: KeyboardEvent): void {
    if (e.ctrlKey || e.altKey || e.metaKey || (e.target instanceof HTMLElement && e.target.matches('input:not([type=checkbox]), textarea'))) return
    if (e.key === 'Escape') {
      if (labelled) labelled = null
      else layersOpen = false
    } else if (e.key === 'l' || e.key === 'L') layersOpen = !layersOpen
    else if (e.key === 'f' || e.key === 'F') follow()
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
  <PointLabel title={labelled.title} where={labelled.where} {way} spot={labelled.spot} box={labelled.box} onclose={() => (labelled = null)} />
{/if}
<div class="corner top">
  <div class="line">
    {#if inside}
      <span class="tag">{inside.name}</span>
    {/if}
    <button class="btn" aria-expanded={layersOpen} aria-controls="layers" onclick={() => (layersOpen = !layersOpen)}>Layers</button>
    {#each [0, 1] as const as which (which)}
      <button class="btn" aria-pressed={!inside && continent === which} onclick={() => choose(which)}>{NAMES[which]}</button>
    {/each}
  </div>
  {#if layersOpen}
    <div class="menu layers" id="layers" role="group" aria-label="Layers" in:fly={drop()} out:fade={gone}>
      {#each LAYER_GROUPS as group (group.name)}
        <div class="group">{group.name}</div>
        {#each group.layers as layer (layer.id)}
          <label class="item"><input type="checkbox" class="check" bind:checked={layers[layer.id]} disabled={!layer.built} />{layer.name}</label>
        {/each}
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
  <button class="btn" aria-label="Zoom in" onclick={() => map?.zoomIn()}><Glyph name="plus" /></button>
  <button class="btn" aria-label="Zoom out" onclick={() => map?.zoomOut()}><Glyph name="minus" /></button>
  <button class="btn" aria-pressed={following} onclick={follow}>Follow</button>
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
    align-items: center;
    gap: 4px;
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

  /* The bosses of a raid: the game names them but not where they stand. */
  .bosses {
    min-width: 0;
    padding: 8px 12px 8px 32px;
    list-style: decimal;
    font: var(--t-small);
  }

  .map :global(.me),
  .map :global(.place) {
    background: none;
    border: 0;
  }

  .map :global(.me svg) {
    transition: transform 0.4s linear;
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
    text-shadow:
      0 1px 2px #000,
      0 0 3px #000,
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
</style>