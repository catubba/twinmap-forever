<script lang="ts">
  // The main screen: the top row with the state of the link, the map in its frame, and the Now panel.
  import { experience, linkStatus, type LinkSnapshot } from '../../shared/link'
  import { tilesLine, type TilesStatus } from '../../shared/tiles-status'
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import type { LogQuest, QuestPin } from '../../shared/quests'
  import type { FixedPin } from '../../shared/services'
  import { addStop, advance, followed, gameRouteFrom, moveStop, noRoute, removeStop, routeFrom } from '../../shared/route'
  import { followFrom, goneFrom, inboxFrom, setFrom } from '../../shared/send'
  import { journeyFrom } from '../../shared/journey'
  import Now from './Now.svelte'
  import Search from './Search.svelte'
  import type { SetupStatus } from '../../shared/setup'
  import FirstRun from './FirstRun.svelte'
  import Logo from './Logo.svelte'
  import Map from './Map.svelte'
  import { drop, gone, opened, screen } from './motion'
  import Settings from './Settings.svelte'

  let link = $state<LinkSnapshot | null>(null)
  let now = $state(Date.now())
  // A listener must give nothing back: what it returns is copied across to the preload script, and a state object cannot be.
  window.twinmap.onLink((snapshot) => {
    link = snapshot
    now = Date.now()
  })
  // The pins of the quests Questie shows: they come when they change, not with every reading.
  let quests = $state.raw<QuestPin[]>([])
  // Services, ore and herbs: they come once.
  let fixed = $state.raw<FixedPin[]>([])
  // The map on show: the panel sends it to the place of a row.
  let mapView = $state<Map>()
  // The quests of the log, with a pin or without.
  let log = $state.raw<LogQuest[]>([])
  window.twinmap.onQuests((status) => {
    quests = status.pins
    if (status.log) log = status.log
    if (status.fixed) fixed = status.fixed
  })
  // The route: kept from one run of the app to the next.
  let route = $state.raw(routeFrom(localStorage.getItem('route')))
  $effect(() => localStorage.setItem('route', JSON.stringify(route)))
  let tiles = $state<TilesStatus | null>(null)
  window.twinmap.onTiles((status) => {
    tiles = status
  })

  // The first run shows by itself until its steps were all done once; then the app opens on the map.
  let setup = $state<SetupStatus | null>(null)
  let onSetup = $state<boolean | null>(null)
  // Settings lie over the map, which stays as it was underneath.
  let onSettings = $state(false)
  window.twinmap.onSetup((told) => {
    setup = told
    onSetup ??= !told.done
  })

  // The opening screen: the mark on the ground of the app, until the first screen is known and drawn
  // under it, and for long enough to see the mark and read the name. Meanwhile the map lays its
  // first tiles, so it is never seen coming in.
  const SETTLE = 1500 // ms
  let opening = $state(true)
  // The window is see-through until the mark is on it, in its own letters and drawn: then it is told to show.
  let seen = $state(false)
  onMount(() => {
    const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => done()))
    void document.fonts.load('40px Marcellus').catch(() => {}).then(frame).then(frame).then(() => {
      window.twinmap.drawn()
      seen = true
    })
  })
  // Told afresh many times a second: only the change from unknown to known may start the wait.
  const known = $derived(seen && !!setup && !!tiles && tiles.state !== 'looking')
  $effect(() => {
    if (!opening || !known) return
    const timer = setTimeout(() => (opening = false), SETTLE)
    return () => clearTimeout(timer)
  })

  const status = $derived(link ? linkStatus(link, now) : null)
  // The position is shown only while it is coming: an arrow left where the character was an hour ago would lie.
  const live = $derived(status?.kind === 'connected' || status?.kind === 'combat')
  const pos = $derived(live ? link?.state.sections.pos : undefined)
  // Level and experience stay as last seen.
  const char = $derived(link?.state.sections.char)
  // The way back to the game, as the addon tells it; nothing while the strip is not coming.
  const inbox = $derived(live ? inboxFrom(link?.state.sections.inbox) : null)
  // Where the game is on the route it has: the app's route follows it, and a skip here is told to it.
  const gameRoute = $derived(live ? gameRouteFrom(link?.state.sections.route) : null)
  $effect(() => {
    route = followed(route, gameRoute)
  })
  function skip(): void {
    route = advance(route)
    if (route.sent && route.t) void window.twinmap.sendStep({ t: route.t, at: route.next + 1 })
  }
  function clear(): void {
    if (route.sent) void window.twinmap.sendRoute(false)
    route = noRoute()
  }
  const xp = $derived(char ? experience(char) : null)
  const mapReady = $derived(tiles?.state === 'ready')
  const insideReady = $derived(tiles?.state === 'ready' && !!tiles.interiors && !tiles.interiors.problem)
  const count = (n: number): string => n.toLocaleString('en-US')
  let wrong = $state('') // what was wrong with the folder the player picked
  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }
</script>

{#if opening}
  <div class="opening" out:fade={opened}><Logo size={96} stacked /></div>
{/if}

<!-- The top row is the window's title bar too: it drags the window, a double click maximizes it. -->
<header class="top">
  {#if !onSetup}
    <nav aria-label="Sections">
      <button class="tab" aria-current={onSettings ? undefined : 'page'} onclick={() => (onSettings = false)}>Now</button>
    </nav>
  {/if}
  {#if onSetup === false && !onSettings && mapReady}
    <Search ready={mapReady} {pos} side={char?.side} onpick={(place) => mapView?.goTo(place)} />
  {/if}
  {#if status}
    <p class="status" class:alone={onSetup !== false || onSettings || !mapReady}><i class={status.tone}></i>{status.word}{#if inbox && !inbox.off}<span class="left" class:low={inbox.left < 5}>{inbox.left} sends left</span>{/if}</p>
  {/if}
  {#if onSetup === false}
    <button class="entry" aria-current={onSettings ? 'page' : undefined} onclick={() => (onSettings = !onSettings)}>Settings</button>
  {/if}
</header>

{#if onSetup && setup}
  <div class="whole" out:fade={gone}><FirstRun {setup} {tiles} link={status} onclose={() => (onSetup = false)} /></div>
{/if}
{#if onSettings && setup && onSetup === false}
  <div class="over" in:fade={screen} out:fade={gone}>
    <Settings {setup} {tiles} link={status} onback={() => (onSettings = false)} onfirstrun={() => ((onSettings = false), (onSetup = true))} />
  </div>
{/if}
{#if onSetup === false}
<div class="work" in:fade={screen} inert={onSettings}>
  <div class="mapbox">
    {#if mapReady}
      <Map {pos} at={link?.state.updatedAt.pos} bind:this={mapView} {insideReady} {quests} {fixed} side={char?.side} {live} {inbox} removed={live ? goneFrom(link?.state.sections.marks) : []} set={live ? setFrom(link?.state.sections.marks) : []} gameFollows={live ? followFrom(link?.state.sections.follow) : null} journey={live ? journeyFrom(link?.state.sections.journey) : null} {route} onroute={(stop) => (route = addStop(route, stop))} />
    {:else if tiles}
      <div class="making" class:failed={tiles.state === 'failed' || tiles.state === 'no-game'}>
        <p>{tilesLine(tiles)}</p>
        {#if tiles.state === 'no-game'}
          {#if wrong}<p>{wrong}</p>{/if}
          <button class="btn" onclick={choose}>Choose the game folder</button>
        {/if}
        {#if tiles.state === 'failed'}
          <button class="btn" onclick={() => window.twinmap.retryTiles()}>Try again</button>
        {/if}
      </div>
    {/if}
    {#if pos}
      <div class="readout">
        <b>{pos.zone ?? 'Unknown zone'}</b>
        {pos.sub ?? ''}
        {pos.x !== undefined && pos.y !== undefined ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : ''}
      </div>
    {/if}
    {#if status?.line && mapReady}
      {#key status.line}<p class="map-note" role="status" in:fly={drop(8)} out:fade={gone}>{status.line}</p>{/key}
    {/if}
  </div>

  <aside class="panel surface" aria-label="Now">
    <Now
      {pos}
      {quests}
    {log}
      {fixed}
      side={char?.side}
      ready={mapReady}
      live={!!live}
      {inbox}
      {route}
      inGame={route.sent && gameRoute?.t === route.t}
      journey={live ? journeyFrom(link?.state.sections.journey) : null}
      onsent={(t) => (route = { ...route, sent: true, t })}
      onskip={skip}
      onarrive={() => (route = advance(route))}
      onclear={clear}
      onend={() => (route = noRoute())}
      onremove={(index) => (route = removeStop(route, index))}
      onmove={(from, to) => (route = moveStop(route, from, to))}
      onstop={(stop) => mapView?.goTo({ continent: stop.continent, at: stop.at, title: stop.name })}
      onpick={(row) => mapView?.goTo({ continent: row.continent, at: row.at, title: row.name })} onpoint={(row) => mapView?.pointAt(row)} />
    {#if char}
      <footer>
        <p>
          <span>Level {char.level}{xp ? `, ${Math.floor(xp.percent)}%` : ''}</span>
          {#if xp}<span class="dim">{count(char.xp!)} of {count(char.max!)} xp</span>{/if}
        </p>
        {#if xp}
          <div class="xp" role="progressbar" aria-label="Experience" aria-valuenow={Math.floor(xp.percent)} style:--v="{xp.percent}%" style:--rest="{xp.rested}%"></div>
        {/if}
      </footer>
    {/if}
  </aside>
</div>
{/if}

<style>
  /* Over everything, the top row too; it drags the window as the top row does. */
  .opening {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: grid;
    place-content: center;
    background: var(--stone-900);
    color: var(--gold);
    -webkit-app-region: drag;
  }

  .top {
    display: flex;
    align-items: flex-end;
    gap: 24px;
    height: 46px;
    /* Room on the right for the three buttons Windows draws; the moulding takes the last 6 px. */
    padding: 0 154px 6px 16px;
    /* From the top: the bronze moulding along the bottom, 6 px; the grain; the ground. */
    background:
      linear-gradient(#000, var(--bronze-700) 18%, var(--bronze-300) 42%, var(--bronze-600) 62%, var(--bronze-900) 86%, #000) bottom / 100% 6px no-repeat,
      var(--grain),
      linear-gradient(var(--stone-600), var(--stone-900) 55%, var(--stone-950));
    white-space: nowrap;
    -webkit-app-region: drag;
  }

  /* An entry of the top row. The section on show is a tab that touches the moulding. */
  .tab,
  .entry {
    padding: 0 14px;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: 5px 5px 0 0;
    background: none;
    font: var(--t-nav);
    color: var(--nav-rest);
    text-shadow: 0 1px 0 #000;
    cursor: pointer;
    -webkit-app-region: no-drag;
  }
  .tab:hover,
  .entry:hover {
    color: var(--text);
  }
  .tab[aria-current],
  .entry[aria-current] {
    border-color: var(--bronze-500);
    background: linear-gradient(var(--stone-500), var(--stone-700));
    box-shadow:
      inset 0 1px 0 #fff4,
      0 0 0 1px #000;
    color: var(--gold);
  }
  /* Settings sit at the far end, after the state of the link. */
  .entry {
    margin-left: 12px;
  }
  .over {
    position: absolute;
    inset: 0;
    z-index: 2000;
    pointer-events: none;
  }
  .over :global(main) {
    pointer-events: auto;
  }
  nav {
    display: flex;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    line-height: 31px; /* on the line of the entries beside it */
    padding-bottom: 2px;
  }
  /* Without the search before it, the state of the link is what goes to the right. */
  .status.alone {
    margin-left: auto;
  }
  .status .left {
    margin-left: 6px;
    color: var(--text-dim);
  }
  .status .left.low {
    color: var(--objective);
  }
  .status i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 0 1px #000;
  }
  .status .done {
    background: var(--done);
  }
  .status .gold {
    background: var(--gold);
  }
  .status .objective {
    background: var(--objective);
  }
  .status .dim {
    background: var(--text-off);
  }

  .work {
    position: absolute;
    inset: 46px 0 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .mapbox {
    position: relative;
    overflow: hidden;
    background: #000;
    /* What lies over the map asks how wide it is: on a narrow one things move out of each other's way. */
    container-type: inline-size;
  }
  /* The bronze frame, 10 px all round, and a vignette that keeps the eye in the middle. */
  .mapbox::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1100;
    pointer-events: none;
    box-shadow:
      inset 0 0 0 1px #000,
      inset 0 0 0 3px var(--bronze-700),
      inset 0 0 0 5px var(--bronze-300),
      inset 0 0 0 7px var(--bronze-600),
      inset 0 0 0 9px var(--bronze-900),
      inset 0 0 0 10px #000,
      inset 0 0 90px 10px #000c;
  }
  /* The map's keyboard ring is drawn just inside the frame: around its own box it would lie under the moulding. */
  .mapbox:has(:global(.map:focus-visible))::after {
    box-shadow:
      inset 0 0 0 1px #000,
      inset 0 0 0 3px var(--bronze-700),
      inset 0 0 0 5px var(--bronze-300),
      inset 0 0 0 7px var(--bronze-600),
      inset 0 0 0 9px var(--bronze-900),
      inset 0 0 0 11px #000,
      inset 0 0 0 14px var(--gold-pale),
      inset 0 0 0 15px #000,
      inset 0 0 90px 10px #000c;
  }
  /* A round stud on each corner, a small brother of the mark: bronze ring with notches, blue disc. */
  .mapbox::before {
    --stud: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23cfb08a'/%3E%3Cstop offset='.5' stop-color='%2385613f'/%3E%3Cstop offset='1' stop-color='%233a2819'/%3E%3C/linearGradient%3E%3CradialGradient id='b' cx='.4' cy='.35' r='.75'%3E%3Cstop stop-color='%232798ba'/%3E%3Cstop offset='.55' stop-color='%23105171'/%3E%3Cstop offset='1' stop-color='%23062235'/%3E%3C/radialGradient%3E%3Ccircle cx='13' cy='13' r='11.5' fill='url(%23g)' stroke='%23000'/%3E%3Ccircle cx='13' cy='13' r='9.2' fill='none' stroke='%23fff2dd' stroke-opacity='.5' stroke-dasharray='.8 2.09'/%3E%3Ccircle cx='13' cy='13' r='6.5' fill='url(%23b)' stroke='%23000' stroke-width='.8'/%3E%3C/svg%3E");
    content: '';
    position: absolute;
    inset: -3px;
    z-index: 1101;
    pointer-events: none;
    background:
      var(--stud) 0 0 / 26px no-repeat,
      var(--stud) 100% 0 / 26px no-repeat,
      var(--stud) 0 100% / 26px no-repeat,
      var(--stud) 100% 100% / 26px no-repeat;
  }

  /* Zone and coordinates, written on the map with no box. */
  .readout {
    position: absolute;
    left: 24px;
    top: 20px;
    z-index: 1200;
    pointer-events: none;
    color: #fff;
    /* A real edge under the letters, as on the names hung over the map: a blur alone gives way on snow. */
    -webkit-text-stroke: 3px #000;
    paint-order: stroke fill;
    text-shadow:
      0 1px 2px #000,
      0 4px 12px #000c;
  }
  .readout b {
    display: block;
    font: var(--t-zone);
    color: var(--gold);
  }

  .making {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    color: var(--text-dim);
  }
  .making p {
    margin: 0;
  }
  .making.failed p {
    color: var(--objective);
  }

  .panel {
    display: flex;
    flex-direction: column;
  }
  footer {
    margin-top: auto;
    padding: 12px 16px;
    box-shadow:
      0 -1px 0 var(--bronze-600),
      0 -2px 0 #000;
  }
  footer p {
    display: flex;
    justify-content: space-between;
    margin: 0 0 7px;
  }
  .dim {
    color: var(--text-dim);
  }
</style>
