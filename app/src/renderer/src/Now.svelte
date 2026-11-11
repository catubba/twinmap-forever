<script lang="ts">
  // The Now column: the next stop of the route, the quests of the log with something to do in this
  // zone, and who is near.
  // Nothing to click to make it work: it composes itself from where the character is.
  import type { Position } from '../../shared/game'
  import type { GameMap } from '../../shared/maps'
  import { nearbyRows, nearest, questsHere, steady, wayOf, whereIs, type NowRow } from '../../shared/now'
  import type { QuestPin } from '../../shared/quests'
  import { bandOf, routeNews, type Route, type Stop } from '../../shared/route'
  import { sendState, type Inbox } from '../../shared/send'
  import type { FixedPin } from '../../shared/services'
  import Glyph from './Glyph.svelte'
  import NextStop from './NextStop.svelte'

  // onpick: a row was chosen, the map should go there. onpoint: the pointer or the keyboard is on
  // a row (or on none: null), the map should show which pin it is.
  // live: the strip is being read. inbox: the way back to the game. route and its callbacks: the stops, and
  // what the band's buttons do. inGame: the game tells it has this route. onsent: the route went to the game, under this number.
  let {
    pos,
    quests,
    fixed,
    side,
    ready,
    live,
    inbox,
    route,
    inGame,
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
    fixed: FixedPin[]
    side?: string
    ready: boolean
    live: boolean
    inbox: Inbox | null
    route: Route
    inGame: boolean
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
    if (!me) return ((here = near = null), { here: [], near: [] })
    const now = Date.now()
    here = steady(here, questsHere(quests, me.zone, me.at), now)
    near = steady(near, nearest(around, me.continent, me.at, NEAR), now)
    return { here: here.rows, near: near.rows }
  })
  // The route as the game takes it: none while a stop lies in no zone, or nothing is left to walk.
  const news = $derived(routeNews(route, maps, 1))
  async function sendRoute(): Promise<string> {
    const t = Date.now(), answer = await window.twinmap.sendRoute(routeNews(route, maps, t) ?? false)
    if ('error' in answer) return answer.error
    onsent(t)
    return ''
  }
  const yards = (n: number): string => `${Math.round(n).toLocaleString('en-US')} yd`
</script>

{#snippet rows(list: NowRow[])}
  <div class="rows">
    {#each list as row (row.key)}
      {@const way = wayOf(me!.at, row.at)}
      <button class="row" onclick={() => onpick?.(row)} onpointerenter={() => onpoint?.(row)} onpointerleave={() => onpoint?.(null)} onfocus={() => onpoint?.(row)} onblur={() => onpoint?.(null)}>
        <span>{row.name}</span>
        <span class="t-{row.tone}">{row.kind}</span>
        <span class="num">{yards(way.yards)}</span>
        <Glyph name="direction" size={12} turn={way.turn} />
      </button>
    {/each}
  </div>
{/snippet}

<div class="now">
  <NextStop {route} band={bandOf(route, me, live)} sending={sendState(live, inbox, news !== null, 'A stop is')} {inGame} onsend={sendRoute} {onskip} {onarrive} {onclear} {onend} {onremove} {onmove} onpick={onstop} />
  {#if lists.here.length}
    <h2 class="band">Quests here <span class="count">{lists.here.length}</span></h2>
    {@render rows(lists.here)}
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
</style>
