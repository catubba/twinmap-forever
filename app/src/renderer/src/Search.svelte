<script lang="ts">
  // The search of the top row: zones from the game's own maps, NPCs, quests and items from the
  // player's QuestieDB. The results open under the field; one chosen takes the map to its place.
  import { unitsOfPlace, type Point } from '../../shared/geo'
  import type { Continent, GameMap } from '../../shared/maps'
  import { wayOf, whereIs } from '../../shared/now'
  import { best, fold } from '../../shared/search'
  import { serves } from '../../shared/services'
  import { nearestOnFoot } from '../../shared/walk'
  import Glyph from './Glyph.svelte'

  export interface Place { continent: Continent; at: Point; title: string; where?: string; whole?: GameMap }
  let { ready, onpick, pos, side }: { ready: boolean; onpick: (place: Place) => void; pos?: { map?: number; x?: number; y?: number }; side?: string } = $props()

  const MOST = 14 // results under the field
  const DOERS = 8 // of which found by what they do, the nearest, at most
  const ZONES = 4 // of which zones, at most
  const REACH = 2500 // the yards the search for the ways on foot walks at most, as it prices them: a quarter of a second, after the results are shown
  const ENDS = 200 // the places it is asked the way to, at most: the nearest as the crow flies

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let zones = $state.raw<(GameMap & { lower: string })[]>([])
  $effect(() => {
    if (!ready || zones.length) return
    void fetch('twinmap://tiles/maps.json')
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (zones = list.filter((m) => m.level === 'zone' && m.rect && m.continent !== null).map((m) => ({ ...m, lower: fold(m.name) }))))
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
    const places: Result[] = best(zones, wanted, ZONES).map((zone) => ({ continent: zone.continent!, at: unitsOfPlace(zone.rect!, 50, 50), title: zone.name, where: '', whole: zone, note: 'Zone' }))
    const byArea = new Map(zones.filter((z) => z.area).map((z) => [z.area, z]))
    const found = await window.twinmap.search(wanted)
    if (mine !== asked) return // something else was typed while this was being looked for
    const me = whereIs(zones, pos)
    const named: Result[] = [], doers: Result[] = []
    for (const f of found) {
      const zone = byArea.get(f.area) // a place in a zone the app has no map of cannot be shown
      if (!zone || (f.does && !serves(f, side))) continue
      const at = unitsOfPlace(zone.rect!, f.x, f.y)
      // How far, when the character is on the same continent: there is no walking to the other.
      const yards = me && me.continent === zone.continent ? wayOf(me.at, at).yards : undefined
      ;(f.does ? doers : named).push({ continent: zone.continent!, at, title: f.name, where: `${zone.name} ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`, note: `${f.note}, ${zone.name}`, yards })
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
    onpick({ continent: result.continent, at: result.at, title: result.title, where: result.where, whole: result.whole })
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
    placeholder="Search NPCs, items, quests, zones"
    aria-label="Search"
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
    <ul class="menu" id="search-results" role="listbox" aria-label="Results" onpointerdown={(e) => e.preventDefault()}>
      {#each results as result, i (i)}
        <li role="presentation">
          <button class="item" class:is-hover={i === chosen} id="search-result-{i}" role="option" aria-selected={i === chosen} tabindex="-1" onclick={() => pick(result)}>
            <span class="name">{result.title}</span>
            <span class="num">{result.note}</span>
            {#if result.yards !== undefined}<span class="far">{Math.round(result.yards).toLocaleString('en-US')} yd</span>{/if}
          </button>
        </li>
      {:else}
        <li class="none">Nothing by that name.</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    align-self: center;
    margin: 0 0 0 auto;
    -webkit-app-region: no-drag;
  }
  .field {
    width: 240px;
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
</style>
