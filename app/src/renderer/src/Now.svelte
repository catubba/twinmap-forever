<script lang="ts">
  // The Now column: the next stop of the route, My pins, every quest of the log (the nearest first),
  // and who is near. A click on the title of a band folds it away, and again opens it.
  // Nothing to click to make it work: it composes itself from where the character is.
  import { TILES } from './web'
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
  import { nearestOnFoot } from '../../shared/walk'
  import { feet } from './feet.svelte'
  import type { Place } from '../../shared/death'
  import { savedFrom } from '../../shared/saved'
  import { kept as keptByApp } from './kept.svelte'
  import type { Alert } from '../../shared/ah'
  import { coins } from '../../shared/items'
  import { num, t } from '../../shared/i18n'

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
    back, // dead: where to walk to live again, the corpse or the door of the dungeon it lies in
    met, // alerts on auction prices that were met (M18-F10), until they are removed
    onalerts, // a met alert was clicked: the Alerts of the auction house
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
    back: (Place & { name: string; door: boolean }) | null
    met: Alert[]
    onalerts: () => void
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
  // ponytail: Nearby is chosen among this many of the nearest as the crow flies, each name on its
  // nearest place so; someone further than all of them as the crow flies and yet nearer on foot is missed.
  const AROUND = 24
  // The yards the one search for the rows walks at most, as it prices them (one and a half off the
  // road): measured at 40 to 60 ms on the thread from Northshire Valley, 80 at 1,500 and 250 at 2,500.
  const REACH = 1200
  const FAR = 20_000 // to the one stop of the band the search is steered, and may go as far as it can

  // The maps of the game, from the folder of the tiles: there once the map is made.
  let maps = $state.raw<GameMap[]>([])
  $effect(() => {
    if (!ready || maps.length) return
    void fetch(`${TILES}/maps.json`)
      .then((answer) => answer.json() as Promise<GameMap[]>)
      .then((list) => (maps = list))
      .catch(() => {})
  })

  // Inside a dungeon the character has no place on a continent: the column is empty there.
  const me = $derived(pos?.inst ? null : whereIs(maps, pos))
  const around = $derived(nearbyRows(maps, quests, fixed, side))

  // The rows are ordered by the way on foot, and tell its yards: asked for all of them at once,
  // the quests of this continent and the nearest around as the crow flies.
  const journal = $derived(me ? questRows(log, quests, maps, me.continent, me.at) : { placed: [], placeless: [] as PlacelessRow[] })
  const crowd = $derived(me ? nearest(around, me.continent, me.at, AROUND) : [])
  const walked = feet(() => (me ? { continent: me.continent, from: me.at, to: [...journal.placed.filter((row) => row.continent === me.continent), ...crowd].map((row) => row.at), reach: REACH } : null))
  // The order of the rows holds for a few seconds; how far and which way follow every reading.
  let here: { rows: NowRow[]; at: number } | null = null
  let near: { rows: NowRow[]; at: number } | null = null
  let knew = false
  const lists = $derived.by(() => {
    if (!me) return ((here = near = null), { here: [], placeless: [] as PlacelessRow[], near: [] })
    // The first answer puts the rows in their order at once, not at the next turn of the few seconds.
    if (walked.known !== knew) (here = near = null), (knew = walked.known)
    const now = Date.now(), from = me.at, continent = me.continent
    const onFoot = (rows: NowRow[]): NowRow[] => nearestOnFoot(rows, (row) => walked.yards(row.at), (row) => wayOf(from, row.at).yards)
    here = steady(here, [...onFoot(journal.placed.filter((row) => row.continent === continent)), ...journal.placed.filter((row) => row.continent !== continent)], now)
    near = steady(near, onFoot(crowd).slice(0, NEAR), now)
    return { here: here.rows, placeless: journal.placeless, near: near.rows }
  })
  // My pins, the saved ones (not the temporary), the nearest first and those of the other continent last.
  // A click takes the map to one, where its label renames it.
  const keptPins = keptByApp('pins', savedFrom)
  const myPins = $derived.by((): NowRow[] => {
    if (!me) return []
    const rows = keptPins.value.flatMap((p, i): NowRow[] => (p.temp ? [] : [{ key: `pin ${i} ${p.name}`, name: p.name, kind: '', tone: 'service', continent: p.continent, at: p.at }]))
    const far = (row: NowRow): number => (row.continent === me.continent ? wayOf(me.at, row.at).yards : Infinity)
    return rows.sort((a, b) => far(a) - far(b))
  })

  // The bands folded away, remembered from one run to the next.
  let folded = $state<Record<string, boolean>>((() => {
    try {
      return JSON.parse(localStorage.getItem('folded') ?? '{}') as Record<string, boolean>
    } catch {
      return {}
    }
  })())
  function fold(band: string): void {
    folded[band] = !folded[band]
    localStorage.setItem('folded', JSON.stringify(folded))
  }

  // The next stop of the route: the way to it alone, asked again every few dozen yards.
  const stop = $derived(route.stops[route.next])
  const toStop = feet(() => (me && stop && stop.continent === me.continent ? { continent: me.continent, from: me.at, to: [stop.at], reach: FAR } : null), 40)
  // The route as the game takes it: none while a stop lies in no zone, or nothing is left to walk.
  const news = $derived(routeNews(route, maps, 1))
  async function sendRoute(): Promise<string> {
    const sentAt = Date.now(), answer = await window.twinmap.sendRoute(routeNews(route, maps, sentAt) ?? false)
    if ('error' in answer) return answer.error
    onsent(sentAt)
    return ''
  }
  // The row chosen last keeps its mark, here and on the map, until another is chosen, it is chosen
  // again, it leaves the lists, or it is let go (clicked, below).
  let chosen = $state<string | null>(null)
  const kept = $derived([...lists.here, ...myPins, ...lists.near].find((row) => row.key === chosen) ?? null)
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
  // Attention: what wants doing first. Its one row for now: dead, the way back to life.
  const attention = $derived<NowRow[]>(back ? [{ key: 'death', name: back.name, kind: back.door ? t('app.now.entrance') : t('app.now.corpse'), tone: 'service', continent: back.continent, at: back.at }] : [])
  const toBack = feet(() => (me && back && back.continent === me.continent ? { continent: me.continent, from: me.at, to: [back.at], reach: FAR } : null), 20)
  const yards = (n: number): string => t('app.now.yards', { yards: num(Math.round(n)) })
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && !(e.target as Element).closest('input, textarea') && (chosen = null)}
  onpointerdown={(e) => (down = { x: e.clientX, y: e.clientY })}
  onclick={clicked}
/>

<!-- The title of a band: a click folds what is under it away, + and - say which way it goes. -->
{#snippet title(band: string, text: string, count?: string | number)}
  <h2 class="band">
    <button class="fold" aria-expanded={!folded[band]} onclick={() => fold(band)}>
      {text}
      {#if count !== undefined}<span class="count">{count}</span>{/if}
      <span class="sign" class:alone={count === undefined}><Glyph name={folded[band] ? 'plus' : 'minus'} size={14} /></span>
    </button>
  </h2>
{/snippet}

{#snippet rows(list: NowRow[])}
  <div class="rows">
    {#each list as row (row.key)}
      <!-- A place on the other continent has no distance to walk: the row still takes the map there. -->
      <!-- The yards are those on foot where a way is known; the arrow points at the place itself. -->
      {@const way = row.continent === me!.continent ? { ...wayOf(me!.at, row.at), ...(walked.yards(row.at) === undefined ? {} : { yards: walked.yards(row.at)! }) } : null}
      <button class="row" title={way ? undefined : t('app.now.otherContinent')} aria-current={row.key === chosen} onclick={() => pick(row)} onpointerenter={() => (over = row)} onpointerleave={() => (over = null)} onfocus={() => (over = row)} onblur={() => (over = null)}>
        <span>{row.name}</span>
        <span class="t-{row.tone}">{row.kind}</span>
        <span class="num">{way ? yards(way.yards) : ''}</span>
        {#if way}<Glyph name="direction" size={12} turn={way.turn} />{/if}
      </button>
    {/each}
  </div>
{/snippet}

<div class="now" data-took={walked.took.toFixed(1)}>
  {#if (attention.length && me) || met.length}
    {@render title('attention', t('app.now.attention'))}
    {#if !folded.attention}<div class="rows attention">
      {#each met as a (a.t)}
        <button class="row alert" onclick={onalerts}>
          <span><Glyph name="coins" size={14} />{a.name}</span>
          <span>{a.when === 'appears' ? t('app.now.onSale') : a.when === 'below' ? t('app.now.cheaper') : t('app.now.dearer')}</span>
          <span class="num">{a.at === null ? '' : coins(a.at).map(([n, c]) => `${n}${c}`).join(' ')}</span>
        </button>
      {/each}
      {#each me ? attention : [] as row (row.key)}
        {@const way = row.continent === me!.continent ? { ...wayOf(me!.at, row.at), ...(toBack.yards(row.at) === undefined ? {} : { yards: toBack.yards(row.at)! }) } : null}
        <button class="row" aria-current={row.key === chosen} onclick={() => pick(row)}>
          <span><img src="{TILES}/icons/{back?.door ? 'dungeon' : 'corpse'}.png" alt="" class:swirl={back?.door} />{row.name}</span>
          <span>{row.kind}</span>
          <span class="num">{way ? yards(way.yards) : ''}</span>
          {#if way}<Glyph name="direction" size={12} turn={way.turn} />{/if}
        </button>
      {/each}
    </div>{/if}
  {/if}
  <NextStop {route} band={bandOf(route, me, live, stop && toStop.yards(stop.at))} sending={sendState(live, inbox, news !== null, 'stop')} {inGame} onsend={sendRoute} {onskip} {onarrive} {onclear} {onend} {onremove} {onmove} onpick={onstop} />
  {#if journey}
    <!-- What Shortest Path guides in the game now: its goal and the legs still ahead, as its tracker words them. -->
    {@render title('game', t('app.now.inGame'), journey.loading ? undefined : span(journey.left))}
    {#if !folded.game}<div class="rows placeless legs" role="status">
      {#if journey.loading}
        <div class="row"><span>{t('app.now.finding')}</span></div>
      {:else}
        <div class="row"><span><b>{journey.name}</b></span>{#if startedBy(journey.owner)}<span>{startedBy(journey.owner)}</span>{/if}</div>
        {#each journey.legs as leg, i (i)}
          <div class="row"><span>{leg.text}</span><span class="num">{span(leg.seconds)}</span></div>
        {/each}
        <!-- Where the legs start and end comes from Shortest Path 1.39 and later, through an addon that tells it: without them a flight or a boat has no line. -->
        {#if journey.legs.some((leg) => leg.mode !== 'walk') && !journey.legs.some((leg) => leg.ends)}
          <div class="row hint"><span>{t('app.now.updateHint')}</span></div>
        {/if}
      {/if}
    </div>{/if}
  {/if}
  {#if myPins.length}
    {@render title('pins', t('app.now.pins'), myPins.length)}
    {#if !folded.pins}{@render rows(myPins)}{/if}
  {/if}
  {#if lists.here.length + lists.placeless.length}
    {@render title('quests', t('app.now.quests'), lists.here.length + lists.placeless.length)}
    {#if !folded.quests}
      {@render rows(lists.here)}
      <!-- In the log, with no place on the map: in a dungeon, or one Questie cannot place. -->
      <div class="rows placeless">
        {#each lists.placeless as row (row.key)}
          <div class="row"><span>{row.name}</span><span class="t-{row.tone}">{row.kind}</span></div>
        {/each}
      </div>
    {/if}
  {/if}
  {#if lists.near.length}
    {@render title('near', t('app.now.nearby'))}
    {#if !folded.near}{@render rows(lists.near)}{/if}
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
  /* The hint is read whole: it goes on to a second line rather than being cut. */
  .legs .hint {
    height: auto;
    padding-block: 3px;
  }
  .legs .hint span {
    color: var(--text-dim);
    white-space: normal;
  }
  .attention img {
    height: 16px;
    margin-right: 6px;
    vertical-align: -3px;
  }
  .attention .alert :global(svg) {
    margin-right: 6px;
    vertical-align: -2px;
    color: var(--gold);
  }
  .attention img.swirl {
    height: 22px;
    margin: -3px 3px -3px -3px;
  }
  .attention .row > :nth-child(2) {
    color: var(--text-dim);
  }
  .placeless .row:hover {
    background: none;
  }
  /* The whole title band is the button that folds it. */
  .fold {
    display: flex;
    flex: 1;
    align-items: center;
    align-self: stretch;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-shadow: inherit;
    text-align: left;
    cursor: pointer;
  }
  .fold:focus-visible {
    outline: 1px solid var(--gold-pale);
    outline-offset: -2px;
  }
  .sign {
    display: flex;
    margin-left: 10px;
    color: var(--text-dim);
  }
  .sign.alone {
    margin-left: auto;
  }
  .fold:hover .sign {
    color: var(--gold);
  }
</style>
