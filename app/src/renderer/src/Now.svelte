<script lang="ts">
  // The Now column: the next stop of the route, every quest of the log (the nearest first), and
  // who is near.
  // Nothing to click to make it work: it composes itself from where the character is.
  import type { Position } from '../../shared/game'
  import type { GameMap } from '../../shared/maps'
  import { nearbyRows, nearest, questRows, steady, wayOf, whereIs, type NowRow, type PlacelessRow } from '../../shared/now'
  import type { LogQuest, QuestPin } from '../../shared/quests'
  import { bandOf, routeNews, type Route, type Stop } from '../../shared/route'
  import { sendState, type Inbox } from '../../shared/send'
  import type { FixedPin } from '../../shared/services'
  import Glyph from './Glyph.svelte'
  import NextStop from './NextStop.svelte'
  import { span, startedBy, type Journey } from '../../shared/journey'

  // onpick: a row was chosen, the map should go there. onpoint: the pointer or the keyboard is on
  // a row (or on none: null), the map should show which pin it is.
  // live: the strip is being read. inbox: the way back to the game. route and its callbacks: the stops, and
  // what the band's buttons do. inGame: the game tells it has this route. onsent: the route went to the game, under this number.
  let {
    pos,
    quests,
    log,
    fixed,
    side,
    ready,
    live,
    inbox,
    route,
    inGame,
    journey, // the journey Shortest Path guides in the game, whoever started it
    onpick,
    onpoint,
    onsent,
    onskip,
    onarrive,
    onclear,
    onend,
    onremove,
    onmove,
    onstop,
  }: {
    pos: Position | undefined
    quests: QuestPin[]
    log: LogQuest[]
    fixed: FixedPin[]
    side?: string
    ready: boolean
    live: boolean
    inbox: Inbox | null
    route: Route
    inGame: boolean
    journey: Journey | null
    onsent: (t: number) => void
    onarrive: () => void
    onend: () => void
    onpick?: (row: NowRow) => void
    onpoint?: (row: NowRow | null) => void
    onskip: () => void
    onclear: () => void
    onremove: (index: number) => void
    onmove: (from: number, to: number) => void
    onstop: (stop: Stop) => void
  } = $props()

  const NEAR = 8 // rows of Nearby

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let maps = $state.raw<GameMap[]>([])
  $effect(() => {
    if (!ready || maps.length) return
    void fetch('twinmap://tiles/maps.json')
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (maps = list))
      .catch(() => {})
  })

  // Inside a dungeon the character has no place on a continent: the column is empty there.
  const me = $derived(pos?.inst ? null : whereIs(maps, pos))
  const around = $derived(nearbyRows(maps, quests, fixed, side))

  // The order of the rows holds for a few seconds; how far and which way follow every reading.
  let here: { rows: NowRow[]; at: number } | null = null
  let near: { rows: NowRow[]; at: number } | null = null
  const lists = $derived.by(() => {
    if (!me) return ((here = near = null), { here: [], placeless: [] as PlacelessRow[], near: [] })
    const now = Date.now(), all = questRows(log, quests, maps, me.continent, me.at)
    here = steady(here, all.placed, now)
    near = steady(near, nearest(around, me.continent, me.at, NEAR), now)
    return { here: here.rows, placeless: all.placeless, near: near.rows }
  })
  // The route as the game takes it: none while a stop lies in no zone, or nothing is left to walk.
  const news = $derived(routeNews(route, maps, 1))
  async function sendRoute(): Promise<string> {
    const t = Date.now(), answer = await window.twinmap.sendRoute(routeNews(route, maps, t) ?? false)
    if ('error' in answer) return answer.error
    onsent(t)
    return ''
  }
  // The row chosen last keeps its mark, here and on the map, until another is chosen, it is chosen
  // again, it leaves the lists, or it is let go (clicked, below).
  let chosen = $state<string | null>(null)
  const kept = $derived([...lists.here, ...lists.near].find((row) => row.key === chosen) ?? null)
  let over = $state.raw<NowRow | null>(null) // the row under the pointer or the keyboard: it comes first
  $effect(() => onpoint?.(over ?? kept))
  function pick(row: NowRow): void {
    chosen = chosen === row.key ? null : row.key
    if (chosen) onpick?.(row)
  }
  // The mark goes with Escape (not while typing: there Escape is the field's), with a click on the
  // column beside the rows, and with a click on the map: the eye has gone elsewhere. A drag of the
  // map is not a click.
  let down = { x: 0, y: 0 }
  function clicked(e: MouseEvent): void {
    const on = e.target as Element
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
    if (on.closest('.leaflet-container') || (on.closest('.now') && !on.closest('button'))) chosen = null
  }
  const yards = (n: number): string => `${Math.round(n).toLocaleString('en-US')} yd`
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && !(e.target as Element).closest('input, textarea') && (chosen = null)}
  onpointerdown={(e) => (down = { x: e.clientX, y: e.clientY })}
  onclick={clicked}
/>

{#snippet rows(list: NowRow[])}
  <div class="rows">
    {#each list as row (row.key)}
      <!-- A place on the other continent has no distance to walk: the row still takes the map there. -->
      {@const way = row.continent === me!.continent ? wayOf(me!.at, row.at) : null}
      <button class="row" title={way ? undefined : 'On the other continent'} aria-current={row.key === chosen} onclick={() => pick(row)} onpointerenter={() => (over = row)} onpointerleave={() => (over = null)} onfocus={() => (over = row)} onblur={() => (over = null)}>
        <span>{row.name}</span>
        <span class="t-{row.tone}">{row.kind}</span>
        <span class="num">{way ? yards(way.yards) : ''}</span>
        {#if way}<Glyph name="direction" size={12} turn={way.turn} />{/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="now">
  <NextStop {route} band={bandOf(route, me, live)} sending={sendState(live, inbox, news !== null, 'A stop is')} {inGame} onsend={sendRoute} {onskip} {onarrive} {onclear} {onend} {onremove} {onmove} onpick={onstop} />
  {#if journey}
    <!-- What Shortest Path guides in the game now: its goal and the legs still ahead, as its tracker words them. -->
    <h2 class="band">In game {#if !journey.loading}<span class="count">{span(journey.left)}</span>{/if}</h2>
    <div class="rows placeless legs" role="status">
      {#if journey.loading}
        <div class="row"><span>Finding the way</span></div>
      {:else}
        <div class="row"><span><b>{journey.name}</b></span>{#if startedBy(journey.owner)}<span>{startedBy(journey.owner)}</span>{/if}</div>
        {#each journey.legs as leg, i (i)}
          <div class="row"><span>{leg.text}</span><span class="num">{span(leg.seconds)}</span></div>
        {/each}
      {/if}
    </div>
  {/if}
  {#if lists.here.length + lists.placeless.length}
    <h2 class="band">Quests <span class="count">{lists.here.length + lists.placeless.length}</span></h2>
    {@render rows(lists.here)}
    <!-- In the log, with no place on the map: in a dungeon, or one Questie cannot place. -->
    <div class="rows placeless">
      {#each lists.placeless as row (row.key)}
        <div class="row"><span>{row.name}</span><span class="t-{row.tone}">{row.kind}</span></div>
      {/each}
    </div>
  {/if}
  {#if lists.near.length}
    <h2 class="band">Nearby</h2>
    {@render rows(lists.near)}
  {/if}
</div>

<style>
  .now {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  /* More room above a title than under it: the band belongs to its own rows. */
  .rows {
    padding: 6px 0 16px;
  }
  /* The rows with no place follow the others as one list, and are not for clicking. */
  .rows:has(+ .placeless) {
    padding-bottom: 0;
  }
  .placeless {
    padding-top: 0;
  }
  .placeless .row {
    cursor: default;
  }
  /* A leg of the journey: its words, and its time at the right edge. */
  .legs .row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .legs .row > :last-child:not(:first-child) {
    color: var(--text-dim);
    white-space: nowrap;
  }
  .placeless .row:hover {
    background: none;
  }
</style>
