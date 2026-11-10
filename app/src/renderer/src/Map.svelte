<script lang="ts">
  // The map: the game's own pictures of the two continents, the names of the zones, and the
  // character as an arrow. It follows the character until the player drags the map away.
  import L from 'leaflet'
  import 'leaflet/dist/leaflet.css'
  import { onMount } from 'svelte'
  import type { Position } from '../../shared/game'
  import { unitsOfPlace, unitsOfRect, type Point } from '../../shared/geo'
  import type { Continent, GameMap } from '../../shared/maps'
  import { tileOfBlock } from '../../shared/pixels'
  import { WORLDS } from '../../shared/world'

  let { pos }: { pos: Position | undefined } = $props()

  const TILES = 'twinmap://tiles'
  const TOP_ZOOM = 7 // the game's own detail: a block's picture is four tiles
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
  const NAMES: Record<Continent, string> = { 0: 'Eastern Kingdoms', 1: 'Kalimdor' }

  let holder: HTMLDivElement
  let map: L.Map | undefined
  let maps = $state<GameMap[]>([])
  let continent = $state<Continent>(0)
  let following = $state(true)
  let offMap = $state(false)

  // Leaflet's plain coordinates: a map unit is a pixel of zoom 0, north is up.
  const at = (p: Point): L.LatLng => L.latLng(-p.y, p.x)
  const boundsOf = (m: GameMap): L.LatLngBounds => {
    const [a, b] = unitsOfRect(m.rect!)
    return L.latLngBounds(at(a), at(b))
  }
  const WORLD_BOUNDS = L.latLngBounds([-256, 0], [0, 256])

  // The pictures of the blocks, inflated, for the tiles of the two top levels. The last few are
  // kept: the four tiles of a block ask for the same file.
  const blocks = new Map<string, Promise<Uint8Array | null>>()
  function block(url: string): Promise<Uint8Array | null> {
    let wanted = blocks.get(url)
    if (!wanted) {
      wanted = fetch(url)
        .then(async (answer) => (answer.ok && answer.body ? new Uint8Array(await new Response(answer.body.pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()) : null))
        .catch(() => null)
      blocks.set(url, wanted)
      if (blocks.size > 48) blocks.delete(blocks.keys().next().value!)
    }
    return wanted
  }

  // Zoom 6 and 7 are drawn from the game's own blocks; past 7 Leaflet stretches them.
  const BlockLayer = L.GridLayer.extend({
    createTile(this: L.GridLayer & { options: { world: string } }, coords: L.Coords, done: L.DoneCallback) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const top = coords.z === TOP_ZOOM
      const column = top ? coords.x >> 1 : coords.x, row = top ? coords.y >> 1 : coords.y
      void block(`${TILES}/${this.options.world}/blocks/${column}/${row}.dxt`).then((dxt) => {
        if (dxt) {
          const rgb = tileOfBlock(dxt, top ? (coords.x & 1) + (coords.y & 1) * 2 : undefined)
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

  let shown: L.Layer[] = []
  const labels = L.layerGroup()
  const arrow = L.marker([0, 0], {
    zIndexOffset: 2000,
    interactive: false,
    icon: L.divIcon({
      className: 'me',
      iconSize: [28, 28],
      html: '<svg viewBox="-12 -12 24 24" width="28" height="28"><path d="M0-11 8 9 0 4-8 9Z" fill="#ffd100" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    }),
  })
  let turned = 0
  function turnTo(degrees: number): void {
    turned += ((((degrees - turned) % 360) + 540) % 360) - 180 // the short way round
    const svg = arrow.getElement()?.firstElementChild as SVGElement | null
    if (svg) svg.style.transform = `rotate(${turned}deg)`
  }

  // Puts a continent on the map: its tiles and the names of its zones.
  function show(which: Continent, fit: boolean): void {
    if (!map) return
    const world = WORLDS.find((w) => w.continent === which)!.name
    for (const layer of shown) layer.remove()
    shown = [
      L.tileLayer(`${TILES}/${world}/{z}/{x}/{y}.png`, { minZoom: 0, maxZoom: TOP_ZOOM - 2, bounds: WORLD_BOUNDS, errorTileUrl: BLANK }).addTo(map),
      new BlockLayer({ world, minZoom: TOP_ZOOM - 1, maxNativeZoom: TOP_ZOOM, bounds: WORLD_BOUNDS }).addTo(map),
    ]
    labels.clearLayers()
    for (const m of maps) {
      if (m.level !== 'zone' || m.continent !== which || !m.rect) continue
      L.marker(boundsOf(m).getCenter(), { interactive: false, icon: L.divIcon({ className: 'zone-name', html: `<span>${m.name}</span>`, iconSize: [0, 0] }) }).addTo(labels)
    }
    continent = which
    const whole = maps.find((m) => m.level === 'continent' && m.continent === which && m.parent !== 0)
    if (fit && whole?.rect) map.fitBounds(boundsOf(whole))
  }

  function choose(which: Continent): void {
    following = false
    show(which, true)
  }

  function follow(): void {
    following = !following
    if (following && placed) place(true)
  }

  // Where the character is on the map, or nothing: a place with no map, or one outside the two continents.
  let placed = false
  function place(jump = false): void {
    if (!map || !maps.length) return
    const zone = pos?.map === undefined ? undefined : maps.find((m) => m.id === pos!.map)
    if (!zone?.rect || zone.continent === null || pos?.x === undefined || pos.y === undefined) {
      offMap = pos !== undefined
      arrow.remove()
      return
    }
    offMap = false
    const here = at(unitsOfPlace(zone.rect, pos.x, pos.y))
    if (zone.continent !== continent) {
      if (!following && placed) return void arrow.remove() // the player is looking at the other continent
      show(zone.continent, false)
    }
    arrow.setLatLng(here).addTo(map)
    if (pos.facing !== undefined) turnTo(360 - pos.facing) // the game counts anticlockwise from north
    if (!placed) {
      placed = true
      map.fitBounds(boundsOf(zone))
    } else if (following && (jump || !map.getCenter().equals(here))) {
      map.panTo(here, { animate: !jump, duration: 0.9, easeLinearity: 1 })
    }
  }

  onMount(() => {
    const made = L.map(holder, { crs: L.CRS.Simple, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, attributionControl: false, maxBounds: WORLD_BOUNDS.pad(0.2) })
    map = made
    made.setView([-128, 128], 2)
    made.on('dragstart', () => (following = false))
    // The names of the zones are for looking at a continent, not at a street.
    made.on('zoomend', () => (made.getZoom() >= 2 && made.getZoom() <= 5.5 ? labels.addTo(made) : labels.remove()))
    void fetch(`${TILES}/maps.json`)
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => {
        maps = list
        show(continent, true)
        place()
      })
    return () => made.remove()
  })

  $effect(() => {
    void pos // each new position moves the arrow
    place()
  })
</script>

<div class="map" bind:this={holder}></div>
<div class="buttons">
  {#each [0, 1] as const as which (which)}
    <button aria-pressed={continent === which} onclick={() => choose(which)}>{NAMES[which]}</button>
  {/each}
  <button aria-pressed={following} onclick={follow}>Follow</button>
</div>
{#if offMap}
  <p class="off">This place is not on the map.</p>
{/if}

<style>
  .map {
    position: absolute;
    inset: 0;
    background: #000; /* the sea of the game's own pictures ends in black */
  }

  .buttons {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1000;
    display: flex;
    gap: 6px;
  }

  button {
    padding: 6px 12px;
    border: 1px solid #5a4a2f;
    border-radius: 4px;
    background: rgb(23 17 12 / 0.9);
    color: #b9a88c;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    border-color: #ffd100;
    color: #ffd100;
  }

  .off {
    position: absolute;
    bottom: 12px;
    left: 50%;
    z-index: 1000;
    margin: 0;
    padding: 6px 12px;
    transform: translateX(-50%);
    border-radius: 4px;
    background: rgb(23 17 12 / 0.9);
    color: #ff8a5c;
  }

  .map :global(.me),
  .map :global(.zone-name) {
    background: none;
    border: 0;
  }

  .map :global(.me svg) {
    transition: transform 0.3s;
  }

  .map :global(.zone-name span) {
    position: absolute;
    transform: translate(-50%, -50%);
    white-space: nowrap;
    color: #f3ead9;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-shadow: 0 0 3px #000, 0 0 3px #000, 0 1px 2px #000;
  }

  .map :global(.leaflet-container) {
    font: inherit;
  }
</style>
