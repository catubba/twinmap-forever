<script lang="ts">
  // The search of the top row: zones from the game's own maps, NPCs, quests and items from the
  // player's QuestieDB. The results open under the field; one chosen takes the map to its place.
  import { unitsOfPlace, type Point } from '../../shared/geo'
  import type { Continent, GameMap } from '../../shared/maps'
  import { best, fold } from '../../shared/search'
  import Glyph from './Glyph.svelte'

  export interface Place { continent: Continent; at: Point; title: string; where?: string; whole?: GameMap }
  let { ready, onpick }: { ready: boolean; onpick: (place: Place) => void } = $props()

  const MOST = 12 // results under the field
  const ZONES = 4 // of which zones, at most

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let zones = $state.raw<(GameMap & { lower: string })[]>([])
  $effect(() => {
    if (!ready || zones.length) return
    void fetch('twinmap://tiles/maps.json')
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (zones = list.filter((m) => m.level === 'zone' && m.rect && m.continent !== null).map((m) => ({ ...m, lower: fold(m.name) }))))
      .catch(() => {})
  })

  interface Result extends Place { note: string }
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
    for (const f of found) {
      const zone = byArea.get(f.area) // a place in a zone the app has no map of cannot be shown
      if (zone) places.push({ continent: zone.continent!, at: unitsOfPlace(zone.rect!, f.x, f.y), title: f.name, where: `${zone.name} ${f.x.toFixed(1)}, ${f.y.toFixed(1)}`, note: f.note })
    }
    results = places.slice(0, MOST)
    chosen = 0
    open = true
    took = performance.now() - started
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
    width: 420px;
    white-space: nowrap;
  }
  .name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .num {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .none {
    padding: 4px 12px;
    color: var(--text-dim);
  }
</style>
