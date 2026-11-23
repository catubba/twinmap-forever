<script lang="ts">
  // The search of the top row: zones from the game's own maps, NPCs, quests and items from the
  // player's QuestieDB, dungeons and raids from the doors of the world map, and My pins. The results open under
  // the field; one chosen takes the map to its place and opens its label there, a dungeon's on its door.
  import { TILES } from './web'
  import { unitsOfPlace, type Point } from '../../shared/geo'
  import type { Continent, GameMap } from '../../shared/maps'
  import { wayOf, whereIs } from '../../shared/now'
  import { best, dungeonsOf, fold, type Dungeon } from '../../shared/search'
  import { placeText, zoneAt } from '../../shared/point-label'
  import { num, t } from '../../shared/i18n'
  import type { Travel } from '../../shared/services'
  import { serves } from '../../shared/services'
  import { nearestOnFoot } from '../../shared/walk'
  import Glyph from './Glyph.svelte'
  import { kept as keptByApp } from './kept.svelte'
  import { savedFrom } from '../../shared/saved'

  export interface Place { continent: Continent; at: Point; title: string; where?: string; whole?: GameMap; dungeon?: { id: number; wing?: string }; item?: number }
  let { ready, onpick, pos, side }: { ready: boolean; onpick: (place: Place) => void; pos?: { map?: number; x?: number; y?: number }; side?: string } = $props()

  const MOST = 14 // results under the field
  const DOERS = 8 // of which found by what they do, the nearest, at most
  const ZONES = 4 // of which zones, at most
  const DUNGEONS = 4 // of which dungeons and raids, at most
  const PINS = 4 // of which My pins, at most
  const REACH = 2500 // the yards the search for the ways on foot walks at most, as it prices them: a quarter of a second, after the results are shown
  const ENDS = 200 // the places it is asked the way to, at most: the nearest as the crow flies

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let zones = $state.raw<(GameMap & { lower: string })[]>([])
  $effect(() => {
    if (!ready || zones.length) return
    void fetch(`${TILES}/maps.json`)
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (zones = list.filter((m) => m.level === 'zone' && m.rect && m.continent !== null).map((m) => ({ ...m, lower: fold(m.name) }))))
      .catch(() => {})
  })
  // My pins, the saved ones: found by the names the player gave them.
  const keptPins = keptByApp('pins', savedFrom)
  const myPins = $derived(keptPins.value.filter((p) => !p.temp).map((p) => ({ ...p, lower: fold(p.name) })))
  // The dungeons and raids, by the names of their maps, behind the doors of the world map.
  let dungeons = $state.raw<(Dungeon & { lower: string })[]>([])
  $effect(() => {
    if (!ready || dungeons.length) return
    void fetch(`${TILES}/travel.json`)
      .then((answer) => answer.json() as Promise<Travel>)
      .then((told) => (dungeons = dungeonsOf(told.doors).map((d) => ({ ...d, lower: fold(d.name) }))))
      .catch(() => {})
  })

  interface Result extends Place { note: string; yards?: number }
  let typed = $state('')
  let results = $state.raw<Result[]>([])
  let open = $state(false)
  let chosen = $state(0)
  let asked = 0
  // How long the last answer took, for the trials: read from outside the window.
  let took = $state(0)

  async function look(): Promise<void> {
    const mine = ++asked, started = performance.now()
    const wanted = typed.trim()
    if (!wanted) return void ((results = []), (open = false))
    const places: Result[] = best(zones, wanted, ZONES).map((zone) => ({ continent: zone.continent!, at: unitsOfPlace(zone.rect!, 50, 50), title: zone.name, where: '', whole: zone, note: t('map.search.zone') }))
    const byArea = new Map(zones.filter((z) => z.area).map((z) => [z.area, z]))
    const found = await window.twinmap.search(wanted)
    if (mine !== asked) return // something else was typed while this was being looked for
    const me = whereIs(zones, pos)
    // My pins first, then a dungeon, told by the zone of its door and how far that door is.
    places.unshift(
      ...best(myPins, wanted, PINS).map((p): Result => {
        const zone = zoneAt(zones, p.continent, p.at)?.zone.name
        const yards = me && me.continent === p.continent ? wayOf(me.at, p.at).yards : undefined
        return { continent: p.continent, at: p.at, title: p.name, note: zone ? t('map.search.myPinIn', { zone }) : t('map.search.myPin'), yards }
      }),
      ...best(dungeons, wanted, DUNGEONS).map((d): Result => {
        const zone = zoneAt(zones, d.continent, d.at)?.zone.name
        const yards = me && me.continent === d.continent ? wayOf(me.at, d.at).yards : undefined
        return { continent: d.continent, at: d.at, title: d.name, where: zone ?? '', note: d.raid ? (zone ? t('map.search.raidIn', { zone }) : t('map.search.raid')) : zone ? t('map.search.dungeonIn', { zone }) : t('map.search.dungeon'), yards, dungeon: { id: d.id, ...(d.wing ? { wing: d.wing } : {}) } }
      }),
    )
    const named: Result[] = [], doers: Result[] = []
    for (const f of found) {
      const zone = byArea.get(f.area) // a place in a zone the app has no map of cannot be shown
      if (!zone || (f.does && !serves(f, side))) continue
      const at = unitsOfPlace(zone.rect!, f.x, f.y)
      // How far, when the character is on the same continent: there is no walking to the other.
      const yards = me && me.continent === zone.continent ? wayOf(me.at, at).yards : undefined
      ;(f.does ? doers : named).push({ continent: zone.continent!, at, title: f.name, where: placeText(f, zone.name), note: t('map.search.foundIn', { what: f.note, zone: zone.name }), yards, ...(f.item && { item: f.item }) })
    }
    // Who does what was typed comes first, the nearest first; then what is called so, unless it is one of them.
    // A result with a way on foot known tells its yards, the others those of the crow.
    const foot = new Map<Result, number>()
    const show = (): void => {
      const first = nearestOnFoot(doers, (d) => foot.get(d), (d) => d.yards ?? Infinity).slice(0, DOERS)
      results = [...places, ...first, ...named.filter((n) => !first.some((d) => d.title === n.title && d.where === n.where))].slice(0, MOST).map((r) => (foot.has(r) ? { ...r, yards: foot.get(r) } : r))
    }
    show()
    chosen = 0
    open = true
    took = performance.now() - started
    // The results are there as the crow flies; the ways on foot come a moment later, and put the nearest by them first.
    const near = [...doers, ...named].filter((r) => r.yards !== undefined).sort((a, b) => a.yards! - b.yards!).slice(0, ENDS)
    if (!me || !near.length) return
    const far = await window.twinmap.walkFar({ continent: me.continent, from: { ...me.at }, to: near.map((r) => ({ ...r.at })), reach: REACH }).catch(() => [])
    if (mine !== asked) return
    near.forEach((r, i) => typeof far[i] === 'number' && foot.set(r, far[i]))
    show()
  }

  function pick(result: Result | undefined): void {
    if (!result) return
    onpick({ continent: result.continent, at: result.at, title: result.title, where: result.where, whole: result.whole, dungeon: result.dungeon, item: result.item })
    open = false
  }

  function key(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open && results.length) return void (open = true)
      chosen = (chosen + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % Math.max(1, results.length)
    } else if (e.key === 'Enter') pick(results[chosen])
    else if (e.key === 'Escape') {
      if (open) open = false
      else typed = ''
    }
  }
</script>

<div class="search" data-took={took.toFixed(1)}>
  <span class="glass"><Glyph name="search" /></span>
  <input
    class="field"
    type="search"
    placeholder={t('map.search.placeholder')}
    aria-label={t('map.search.field')}
    role="combobox"
    aria-expanded={open}
    aria-controls="search-results"
    aria-activedescendant={open && results.length ? `search-result-${chosen}` : undefined}
    autocomplete="off"
    spellcheck="false"
    bind:value={typed}
    oninput={look}
    onkeydown={key}
    onfocus={() => (open = results.length > 0)}
    onblur={() => (open = false)}
  />
  {#if open}
    <!-- A press on a result must not take the keyboard from the field first: the list would close under the pointer. -->
    <ul class="menu" id="search-results" role="listbox" aria-label={t('map.search.results')} onpointerdown={(e) => e.preventDefault()}>
      {#each results as result, i (i)}
        <li role="presentation">
          <button class="item" class:is-hover={i === chosen} id="search-result-{i}" role="option" aria-selected={i === chosen} tabindex="-1" onclick={() => pick(result)}>
            <!-- The item's picture, from the player's game; where the game has none the row reads the same without it. -->
            {#if result.item}<img class="pic" src="{TILES}/items/{result.item}.png" alt="" onerror={(e) => e.currentTarget.remove()} />{/if}
            <span class="name">{result.title}</span>
            <span class="num">{result.note}</span>
            {#if result.yards !== undefined}<span class="far">{t('map.search.yards', { yards: num(Math.round(result.yards)) })}</span>{/if}
          </button>
        </li>
      {:else}
        <li class="none">{t('map.search.none')}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    /* Its middle on the middle of the words beside it, which stand on the foot of the row. */
    align-self: flex-end;
    margin: 0 0 3px auto;
    /* As wide as it likes while the top row has the room, and no narrower than a word or two. It gives before the name of the character does: all of what is short is taken off here, down to the least. */
    flex: 0 1000000 240px;
    min-width: 110px;
    -webkit-app-region: no-drag;
  }
  .field {
    width: 100%;
    padding-left: 28px;
  }
  /* The cross a search field draws by itself is not one of ours. */
  .field::-webkit-search-cancel-button {
    display: none;
  }
  .glass {
    position: absolute;
    left: 7px;
    top: 5px;
    display: flex;
    color: var(--text-dim);
    pointer-events: none;
  }
  .menu {
    position: absolute;
    right: 0;
    top: 30px;
    z-index: 2500;
    width: 520px;
    white-space: nowrap;
  }
  .pic {
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 2px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-700);
  }
  .name {
    flex: none;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .num {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .far {
    flex: none;
    min-width: 62px;
    text-align: right;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .none {
    padding: 4px 12px;
    color: var(--text-dim);
  }
  /* On a narrow screen the field takes what the top row has left, and the results the width of the screen. */
  @media (max-width: 760px) {
    .search {
      flex: 1;
      min-width: 0;
      margin-left: 0;
    }
    .menu {
      position: fixed;
      left: 8px;
      right: 8px;
      top: 44px;
      width: auto;
    }
  }
  /* Under a finger: as tall as the top row lets it be. Letters of 16 px, or a phone zooms the page in on the field. */
  @media (pointer: coarse) {
    .search {
      margin-bottom: 0; /* the taller field has the foot of the row */
    }
    .field {
      height: 36px;
      font-size: 16px;
    }
    .glass {
      top: 10px;
    }
  }
</style>
