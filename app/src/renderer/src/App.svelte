<script lang="ts">
  // The main screen: the top row with the state of the link, the map in its frame, and the Now panel.
  import { experience, linkStatus, PAUSED, type LinkSnapshot } from '../../shared/link'
  import { groupFrom } from '../../shared/group'
  import { deathFrom, type Place as DeathPlace } from '../../shared/death'
  import { feedbackDetails } from '../../shared/feedback'
  import { tilesHelp, tilesLine, type TilesStatus } from '../../shared/tiles-status'
  import { onMount } from 'svelte'
  import { fade, fly } from 'svelte/transition'
  import type { LogQuest, QuestPin } from '../../shared/quests'
  import type { FixedPin } from '../../shared/services'
  import { addStop, advance, followed, gameRouteFrom, moveStop, noRoute, removeStop, routeFrom, type Route } from '../../shared/route'
  import { kept } from './kept.svelte'
  import { inApp } from './web'
  import { followFrom, goneFrom, inboxFrom, setFrom } from '../../shared/send'
  import { journeyFrom } from '../../shared/journey'
  import Now from './Now.svelte'
  import Search from './Search.svelte'
  import { ADDON_MISSING, type SetupStatus } from '../../shared/setup'
  import Feedback from './Feedback.svelte'
  import Participate from './Participate.svelte'
  import FirstRun from './FirstRun.svelte'
  import Glyph from './Glyph.svelte'
  import { PANEL, layout, setMapRight, setWidth } from './layout.svelte'
  import Logo from './Logo.svelte'
  import Map from './Map.svelte'
  import { drop, gone, opened, screen } from './motion'
  import Settings from './Settings.svelte'
  import Picker from './Picker.svelte'
  import Items from './Items.svelte'
  import Auction from './Auction.svelte'
  import { homeOf, houseFrom, houseNumber, houseOf, type Alert, type Home, type House, type PricesTold } from '../../shared/ah'
  import ItemPopup from './ItemPopup.svelte'
  import NpcPanel from './NpcPanel.svelte'
  import { firstName, knownOf, shownOf } from '../../shared/characters'
  import type { PortraitsTold } from '../../shared/portrait'
  import type { Sheets } from '../../shared/sheet'

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
  let looking = $state<{ zone: string; where: string } | null>(null) // what the map shows while moved away from the character
  // The quests of the log, with a pin or without.
  let log = $state.raw<LogQuest[]>([])
  window.twinmap.onQuests((status) => {
    quests = status.pins
    if (status.log) log = status.log
    if (status.fixed) fixed = status.fixed
  })
  // The route: kept by the app, from one run to the next and for every screen that shows it.
  const keptRoute = kept('route', routeFrom)
  const route = $derived(keptRoute.value)
  const setRoute = (to: Route): void => {
    keptRoute.value = to
  }
  let tiles = $state<TilesStatus | null>(null)
  window.twinmap.onTiles((status) => {
    tiles = status
  })

  // The first run shows by itself until its steps were all done once; then the app opens on the map.
  let setup = $state<SetupStatus | null>(null)
  let onSetup = $state<boolean | null>(null)
  // Settings lie over the map, which stays as it was underneath.
  let onSettings = $state(false)
  // Items lies over the map as Settings does, as wide as the window.
  let onItems = $state(false)
  // Auction House lies over the map as Items does.
  let onAh = $state(false)
  // Feedback is a small window over whatever is on show.
  let onFeedback = $state(false)
  let answered = $state(false) // Help improve Twinmap was answered in this run: the setup may tell it a moment later
  window.twinmap.onSetup((told) => {
    setup = told
    // On a phone there are no steps to go through, only the wait for them to be done on the computer: it ends by itself.
    if (inApp) onSetup ??= !told.done
    else onSetup = !told.done
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
  // Paused (the button on the state of the link): the map stays where the character was when it was pressed.
  const paused = $derived(status?.kind === 'paused')
  const setPause = (on: boolean): void => void window.twinmap.setPause(on)
  // The position is shown only while it is coming: an arrow left where the character was an hour ago would lie.
  // Paused, it is the place of the moment the player chose to stop at, and the map says so.
  const live = $derived(status?.kind === 'connected' || status?.kind === 'combat' || paused)
  const pos = $derived(live ? link?.state.sections.pos : undefined)
  // Level and experience stay as last seen.
  const char = $derived(link?.state.sections.char)
  // The way back to the game, as the addon tells it; nothing while the strip is not coming.
  const inbox = $derived(live ? inboxFrom(link?.state.sections.inbox) : null)
  // Where the game is on the route it has: the app's route follows it, and a skip here is told to it.
  const gameRoute = $derived(live ? gameRouteFrom(link?.state.sections.route) : null)
  $effect(() => {
    setRoute(followed(route, gameRoute))
  })
  function skip(): void {
    setRoute(advance(route))
    if (route.sent && route.t) void window.twinmap.sendStep({ t: route.t, at: route.next + 1 })
  }
  function clear(): void {
    if (route.sent) void window.twinmap.sendRoute(false)
    setRoute(noRoute())
  }
  // The journey Shortest Path guides in the game.
  const journey = $derived(live ? journeyFrom(link?.state.sections.journey) : null)
  // The companions of the group, where the game tells: gone with the strip, and with a group no longer told of.
  const group = $derived(live ? groupFrom(link?.state.sections.group, now - (link?.state.updatedAt.group ?? 0)) : [])
  const death = $derived(live ? deathFrom(link?.state.sections.dead, now - (link?.state.updatedAt.dead ?? 0)) : null)
  let back = $state.raw<(DeathPlace & { name: string; door: boolean }) | null>(null) // where the ghost walks to, as the map places it
  const xp = $derived(char ? experience(char) : null)
  // The characters the app keeps a sheet of, and the one shown. Picking another changes what the app
  // keeps of a character (bags, bank, spells), never the map, which is the one in game. A character
  // coming into the game is shown again.
  let sheets = $state.raw<Sheets>({})
  window.twinmap.onSheets((all) => {
    sheets = all
  })
  // The pictures of the characters, and whose is awaited (Retake).
  let portraits = $state.raw<PortraitsTold>({ taken: {}, retake: null })
  window.twinmap.onPortraits((told) => {
    portraits = told
  })
  const inGame = $derived(live ? (char?.name ?? null) : null)
  let picked = $state<string | null>(null)
  let lastInGame: string | null = null
  $effect(() => {
    if (inGame && inGame !== lastInGame) picked = null
    if (inGame) lastInGame = inGame
  })
  const characters = $derived(knownOf(sheets, inGame))
  // The auction house (M18-F7): the one of the character in game, kept for when the game is closed,
  // unless the player chose another; its prices are asked for at once, wherever the window is.
  const stored = (key: string): House | null => {
    try {
      return houseFrom(JSON.parse(localStorage.getItem(key) ?? 'null'))
    } catch {
      return null
    }
  }
  let seenHouse = $state(stored('ahSeen'))
  let chosenHouse = $state(stored('ahChosen'))
  const liveHouse = $derived(live ? houseOf(char) : null)
  $effect(() => {
    if (!liveHouse || JSON.stringify(liveHouse) === JSON.stringify(seenHouse)) return
    seenHouse = liveHouse
    localStorage.setItem('ahSeen', JSON.stringify(liveHouse))
  })
  const house = $derived(chosenHouse ?? seenHouse)
  $effect(() => {
    if (house) void window.twinmap.ahHouse(house.region, houseNumber(house))
  })
  function chooseHouse(h: House | null): void {
    chosenHouse = h
    if (h) localStorage.setItem('ahChosen', JSON.stringify(h))
    else localStorage.removeItem('ahChosen')
  }
  let prices = $state.raw<PricesTold | null>(null)
  window.twinmap.onPrices((told) => {
    prices = told
  })
  // Alerts on prices (M18-F10), every character's: the met ones show in Now under Attention too, and a click there opens them.
  let alerts = $state.raw<Alert[]>([])
  window.twinmap.onAlerts((all) => {
    alerts = all
  })
  let showAlerts = $state(0)
  // The prices of the house on show only: a house changed a moment ago has none until they come.
  const listing = $derived(house && prices?.house === houseNumber(house) && prices.region === house.region ? prices.listing : null)
  // Each character's own house, as the game told it while it was played: whose items count at the house on show (M18-F8).
  let homes = $state.raw<Record<string, Home>>({})
  try {
    homes = JSON.parse(localStorage.getItem('ahHomes') ?? '{}') as Record<string, Home>
  } catch {
    // none kept
  }
  $effect(() => {
    const name = live ? char?.name : undefined, home = homeOf(char)
    if (!name || !home || JSON.stringify(homes[name]) === JSON.stringify(home)) return
    homes = { ...homes, [name]: home }
    localStorage.setItem('ahHomes', JSON.stringify(homes))
  })
  // The vendor or trainer whose label is open on the map: its panel tops the side panel until closed.
  let npc = $state.raw<FixedPin | null>(null)
  const shown = $derived(shownOf(characters, picked))
  const mapReady = $derived(tiles?.state === 'ready')
  const insideReady = $derived(tiles?.state === 'ready' && !!tiles.interiors && !tiles.interiors.problem)
  const count = (n: number): string => n.toLocaleString('en-US')
  let wrong = $state('') // what was wrong with the folder the player picked
  // The panel closes at any size: closed, it lies over a corner of the map and shows the next stop
  // and nothing else, and what stands at the foot of the map is lifted by its closed height. On a
  // small screen (a phone, either way up) it lies over the map open too, and starts closed; on a
  // larger one it starts as it was left.
  const SMALL = '(max-width: 760px), (max-height: 500px)'
  let panelOpen = $state(!matchMedia(SMALL).matches && localStorage.getItem('panel') !== 'closed')
  function togglePanel(): void {
    panelOpen = !panelOpen
    if (!matchMedia(SMALL).matches) localStorage.setItem('panel', panelOpen ? 'open' : 'closed')
  }
  let panelHeight = $state(0)
  let peek = $state(0)
  $effect(() => {
    if (!panelOpen) peek = panelHeight
  })
  // The edge between map and open panel: dragged with the pointer, moved with the arrows, put back
  // with a double click. While it is dragged the width is not kept: only where it is let go.
  let work = $state<HTMLElement>()
  let dragging = $state(false)
  let wide = $state(innerWidth)
  function drag(e: PointerEvent): void {
    if (e.button !== 0 || !work) return
    e.preventDefault()
    const edge = e.currentTarget as HTMLElement
    const box = work.getBoundingClientRect()
    edge.setPointerCapture(e.pointerId)
    dragging = true
    edge.onpointermove = (m) => setWidth(layout.mapRight ? m.clientX - box.left : box.right - m.clientX, false)
    edge.onpointerup = edge.onpointercancel = () => {
      edge.onpointermove = edge.onpointerup = edge.onpointercancel = null
      dragging = false
      setWidth(layout.width)
    }
  }
  function nudge(e: KeyboardEvent): void {
    const step = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0
    if (!step) return
    e.preventDefault()
    setWidth(layout.width + (layout.mapRight ? step : -step))
  }
  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }
  // Ctrl and the wheel make the whole window bigger or smaller, a step for each turn of a wheel. A touchpad's many
  // small moves add up to one. On the map the wheel stays the map's: it never comes here, or comes taken.
  let turned = 0
  function wheel(e: WheelEvent): void {
    if (!inApp || !e.ctrlKey || e.defaultPrevented) return
    turned += e.deltaY
    if (Math.abs(turned) < 50) return
    void window.twinmap.zoomBy(turned < 0 ? 1 : -1)
    turned = 0
  }
</script>

<svelte:window bind:innerWidth={wide} onwheel={wheel} />

{#if opening}
  <div class="opening" out:fade={opened}><Logo size={96} stacked /></div>
{/if}

<!-- The top row is the window's title bar too: it drags the window, a double click maximizes it. -->
<header class="top">
  {#if onSetup === false}
    <Picker known={characters} {shown} {now} onpick={(key) => (picked = key)} onforget={(key) => void window.twinmap.forgetSheet(key)} />
  {/if}
  {#if !onSetup}
    <nav aria-label="Sections">
      <button class="tab" title="Now" aria-label="Now" aria-current={onSettings || onItems || onAh ? undefined : 'page'} onclick={() => ((onSettings = false), (onItems = false), (onAh = false))}><Glyph name="pin" size={18} /><span class="word">Now</span></button>
      <button class="tab" title="Items" aria-label="Items" aria-current={onItems && !onSettings ? 'page' : undefined} onclick={() => ((onSettings = false), (onItems = true), (onAh = false))}><Glyph name="bag" size={18} /><span class="word">Items</span></button>
      <!-- Its name gives first: Auction House, then AH, then the glyph alone with the others. -->
      <button class="tab" title="Auction House" aria-label="Auction House" aria-current={onAh && !onSettings ? 'page' : undefined} onclick={() => ((onSettings = false), (onItems = false), (onAh = true))}><Glyph name="coins" size={18} /><span class="word long">Auction House</span><span class="word short">AH</span></button>
    </nav>
  {/if}
  {#if onSetup === false && !onSettings && mapReady}
    <Search ready={mapReady} {pos} side={char?.side} onpick={(place) => ((onItems = false), (onAh = false), mapView?.goTo(place))} />
  {/if}
  {#if status}
    <!-- The state of the link is the Pause button too: two bars to pause, the arrow of play to resume. -->
    <button class="status" class:alone={onSetup !== false || onSettings || !mapReady} class:paused title={paused ? 'Resume Twinmap' : 'Pause Twinmap'} aria-label={paused ? 'Resume Twinmap' : 'Pause Twinmap'} aria-pressed={paused} onclick={() => setPause(!paused)}><i class={status.tone}></i><span class="word">{status.word}</span>{#if inbox && !inbox.off && inbox.id === undefined}<span class="left" class:low={inbox.left < 5}>{inbox.left} sends left</span>{/if}<span class="toggle"><Glyph name={paused ? 'play' : 'pause'} size={16} /></span></button>
  {/if}
  {#if setup}
    <!-- The bug and the cog say what the words may not, to those who do not know them; in a narrow window they stand alone. The sections have theirs too: the pin of where you are, the bag. -->
    <button class="entry feedback" title="Report a bug or an idea" aria-label="Feedback" onclick={() => (onFeedback = true)}><Glyph name="bug" size={18} /><span class="word">Feedback</span></button>
  {/if}
  {#if onSetup === false}
    <button class="entry" title="Settings" aria-label="Settings" aria-current={onSettings ? 'page' : undefined} onclick={() => (onSettings = !onSettings)}><Glyph name="gear" size={18} /><span class="word">Settings</span></button>
  {/if}
</header>

{#if onFeedback && setup}
  <Feedback details={feedbackDetails(setup, tiles, status?.word ?? null)} onclose={() => (onFeedback = false)} />
{/if}
<!-- Help improve Twinmap is asked once, on this computer only, after the first run and never over another window. -->
{#if inApp && setup && setup.participate === null && !answered && onSetup === false && !onFeedback}
  <Participate onclose={() => (answered = true)} />
{/if}
{#if onSetup && setup}
  <div class="whole" out:fade={gone}>
    {#if inApp}
      <FirstRun {setup} {tiles} link={status} onclose={() => (onSetup = false)} />
    {:else}
      <!-- The game folder, the map and the addon are the computer's to set up: here there is only the wait. -->
      <main class="elsewhere surface">
        <span class="mark"><Logo size={72} /></span>
        <h1>Finish the setup on your computer</h1>
        <p>Twinmap on the computer is still being set up: it shows what is left to do. The map opens here by itself when it is done.</p>
      </main>
    {/if}
  </div>
{/if}
{#if onSettings && setup && onSetup === false}
  <div class="over" in:fade={screen} out:fade={gone}>
    <Settings {setup} {tiles} onback={() => (onSettings = false)} onfeedback={() => (onFeedback = true)} onfirstrun={() => ((onSettings = false), (onSetup = true))} />
  </div>
{/if}
{#if onItems && onSetup === false && !onSettings}
  <div class="over" in:fade={screen} out:fade={gone}>
    <Items {sheets} {portraits} {shown} known={characters} {now} {listing} onpick={(key) => (picked = key)} />
  </div>
{/if}
{#if onAh && onSetup === false && !onSettings}
  <div class="over" in:fade={screen} out:fade={gone}>
    <Auction {house} chosen={!!chosenHouse} hints={char ?? null} who={char?.name ?? null} {prices} {listing} {sheets} known={characters} {homes} {now} {alerts} {showAlerts} onchoose={chooseHouse} />
  </div>
{/if}
{#if onSetup === false}
<div class="work" class:shut={!panelOpen} class:map-right={layout.mapRight} in:fade={screen} inert={onSettings || onItems || onAh} style:--peek="{peek}px" style:--panel-w="{layout.width}px" bind:this={work}>
  <div class="mapbox">
    {#if mapReady}
      <Map {pos} {group} {death} bind:back kills={live ? link?.state.sections.kills : undefined} bind:looking at={link?.state.updatedAt.pos} bind:this={mapView} {insideReady} {quests} {fixed} side={char?.side} {live} {inbox} removed={live ? goneFrom(link?.state.sections.marks) : []} set={live ? setFrom(link?.state.sections.marks) : []} gameFollows={live ? followFrom(link?.state.sections.follow) : null} {journey} {route} onroute={(stop) => setRoute(addStop(route, stop))} onnpc={(pin) => (npc = pin)} />
    {:else if tiles}
      <div class="making" class:failed={tiles.state === 'failed' || tiles.state === 'no-game'}>
        <p>{tilesLine(tiles)}</p>
        {#if tilesHelp(tiles)}<p class="help">{tilesHelp(tiles)}</p>{/if}
        {#if tiles.state === 'no-game' && inApp}
          {#if wrong}<p>{wrong}</p>{/if}
          <button class="btn" onclick={choose}>Choose the game folder</button>
        {/if}
        {#if tiles.state === 'failed'}
          <button class="btn" onclick={() => window.twinmap.retryTiles()}>Try again</button>
        {/if}
      </div>
    {/if}
    {#if looking}
      <!-- The map was moved by hand: the zone and the coordinates of its middle. -->
      <div class="readout">
        <b>{looking.zone}</b>
        {looking.where}
      </div>
    {:else if pos}
      <div class="readout">
        <b>{pos.zone ?? 'Unknown zone'}</b>
        {pos.sub ?? ''}
        {pos.x !== undefined && pos.y !== undefined ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : ''}
      </div>
    {/if}
    {#if setup?.gameFolder && !setup.addon}
      <p class="map-note with-button" role="status">{ADDON_MISSING} <button class="btn" onclick={() => window.twinmap.openCurseForge()}>Get it on CurseForge</button></p>
    {:else if paused && mapReady}
      <p class="map-note with-button" role="status" in:fly={drop(8)} out:fade={gone}>{PAUSED} <button class="btn" onclick={() => setPause(false)}>Resume</button></p>
    {:else if status?.line && mapReady}
      {#key status.line}<p class="map-note" role="status" in:fly={drop(8)} out:fade={gone}>{status.line}</p>{/key}
    {/if}
  </div>

  <aside class="panel surface" class:closed={!panelOpen} aria-label="Now" bind:clientHeight={panelHeight}>
    <div class="head">
      <button class="grip" aria-expanded={panelOpen} onclick={togglePanel}><Glyph name="menu" turn={panelOpen ? 0 : 180} />{panelOpen ? 'Close' : 'Quests and nearby'}</button>
      <!-- On the end of the bar next to the map: the map goes to the other side. -->
      {#if panelOpen}
        {@const to = layout.mapRight ? 'Map on the left (M)' : 'Map on the right (M)'}
        <button class="swap" title={to} aria-label={to} onclick={() => setMapRight(!layout.mapRight)}><Glyph name="swap" /></button>
      {/if}
    </div>
    {#if inGame && shown && !shown.live}
      <!-- Another character than the one in game: said where its bags and spells will show, with the way back. -->
      <p class="viewing" role="status">
        <span>Showing <b style:color={shown.color}>{shown.key}</b></span>
        <button class="btn back" onclick={() => (picked = null)}>Back to {firstName(inGame)}</button>
      </p>
    {/if}
    {#if npc}
      {#key npc}<NpcPanel pin={npc} {sheets} {shown} {now} {listing} onclose={() => (npc = null)} />{/key}
    {/if}
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
      {journey}
      back={death ? back : null}
      met={alerts.filter((a) => a.met)}
      onalerts={() => ((onSettings = false), (onItems = false), (onAh = true), showAlerts++)}
      onsent={(t) => setRoute({ ...route, sent: true, t })}
      onskip={skip}
      onarrive={() => setRoute(advance(route))}
      onclear={clear}
      onend={() => setRoute(noRoute())}
      onremove={(index) => setRoute(removeStop(route, index))}
      onmove={(from, to) => setRoute(moveStop(route, from, to))}
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
  {#if panelOpen}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div class="edge" class:dragging role="separator" tabindex="0" aria-orientation="vertical" aria-label="Panel width" aria-valuemin={PANEL.least} aria-valuemax={Math.round(wide / 2)} aria-valuenow={layout.width} title="Drag to resize. Double-click to reset." onpointerdown={drag} onkeydown={nudge} ondblclick={() => setWidth(PANEL.start)}><i></i></div>
  {/if}
</div>
{/if}

<!-- The popup of the item under the pointer, over everything (M10-F15). -->
<ItemPopup {sheets} known={characters} side={char?.side} {pos} {listing} />

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
  /* Each with its glyph before the word. */
  .tab,
  .entry {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 33px; /* the line of the entries, also when the glyph stands alone */
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
  /* The sections and the entries keep their width: the search and the name of the character give (Search, Picker). */
  nav,
  .entry {
    flex: none;
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
  /* The state of the link is a button: pause and resume. Quiet until the pointer is on it. */
  button.status {
    height: 27px;
    margin-top: 2px;
    padding: 0 6px 0 10px;
    line-height: 1;
    border: 1px solid transparent;
    border-radius: 5px;
    background: none;
    font: var(--t-nav);
    color: var(--nav-rest);
    text-shadow: 0 1px 0 #000;
    cursor: pointer;
    -webkit-app-region: no-drag;
  }
  button.status:hover {
    border-color: var(--bronze-500);
    color: var(--text);
  }
  button.status .toggle {
    display: inline-flex;
    margin-left: 4px;
    padding-left: 7px;
    border-left: 1px solid #fff2;
    color: var(--text-dim);
  }
  button.status:hover .toggle,
  button.status.paused .toggle {
    color: var(--gold);
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
    /* The panel as wide as it was dragged, never under 260 px nor over half the window. */
    --panel-side: clamp(260px, var(--panel-w, 340px), 50%);
    grid-template-columns: minmax(0, 1fr) var(--panel-side);
    /* One row, as tall as the window and no taller: a panel with much to say scrolls, it does not push the map's foot out of sight. */
    grid-template-rows: minmax(0, 1fr);
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
  /* On a narrow map the zone goes under the buttons of the map, which keep the top (Map.svelte). */
  @container (max-width: 640px) {
    .readout {
      top: 108px;
    }
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
    max-width: min(60ch, 100% - 32px);
    margin: 0;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .making.failed p {
    color: var(--objective);
  }
  /* A note that carries a button takes the pointer, which a plain note lets through to the map. */
  .mapbox :global(.map-note.with-button) {
    pointer-events: auto;
  }
  .mapbox :global(.map-note.with-button .btn) {
    margin-left: 8px;
  }
  .making p.help {
    max-width: 46ch;
    padding: 0 16px;
    color: var(--text-dim);
    text-align: center;
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

  /* In place of the first run, in a browser: one thing said, in the middle of the screen. */
  .elsewhere {
    position: absolute;
    inset: 46px 0 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
  }
  .elsewhere .mark {
    color: var(--gold);
  }
  .elsewhere h1 {
    margin: 0;
    font: var(--t-zone);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  .elsewhere p {
    max-width: 44ch;
    margin: 0;
    text-wrap: pretty;
    color: var(--text-dim);
  }

  /* Outside the app's own window no buttons of Windows lie over the top row. */
  :global(html.web) .top {
    padding-right: 16px;
  }
  /* What opens and closes the panel, along its top. */
  .grip {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 28px;
    border: 0;
    background: linear-gradient(var(--stone-600), var(--stone-800));
    box-shadow: inset 0 -1px 0 #000;
    font: var(--t-label);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
    cursor: pointer;
  }
  .grip:hover {
    color: var(--gold-pale);
  }
  .head {
    flex: none;
    display: flex;
  }
  .head .grip {
    flex: 1;
  }
  /* The map to the other side: on the end of the bar that touches the map. */
  .swap {
    flex: none;
    display: grid;
    place-items: center;
    width: 34px;
    border: 0;
    background: linear-gradient(var(--stone-600), var(--stone-800));
    box-shadow:
      inset 0 -1px 0 #000,
      inset -1px 0 0 #000,
      inset -2px 0 0 #ffffff14;
    color: var(--gold);
    cursor: pointer;
  }
  .swap:hover {
    color: var(--gold-pale);
  }
  .work:not(.map-right) .swap {
    order: -1;
  }
  .work.map-right .swap {
    box-shadow:
      inset 0 -1px 0 #000,
      inset 1px 0 0 #000,
      inset 2px 0 0 #ffffff14;
  }
  /* The map on the right: the panel takes the left, and closed it lies over the map's left corner. */
  .work.map-right {
    grid-template-columns: var(--panel-side) minmax(0, 1fr);
  }
  .work.map-right .panel {
    order: -1;
  }
  .work.map-right .panel.closed {
    right: auto;
    left: 0;
    box-shadow:
      0 -1px 0 #000,
      0 -3px 0 var(--bronze-600),
      0 -4px 0 #000,
      1px 0 0 #000,
      3px 0 0 var(--bronze-600),
      4px 0 0 #000,
      0 -10px 24px #000a;
  }
  /* The edge between map and panel: a bronze stud with five dots on the seam, the seam gold while
     the pointer is on it or drags it. */
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(100% - var(--panel-side));
    z-index: 1250;
    display: grid;
    place-items: center;
    width: 14px;
    margin-left: -7px;
    cursor: col-resize;
    touch-action: none;
    outline: none;
  }
  .work.map-right .edge {
    left: var(--panel-side);
  }
  .edge i {
    position: relative;
    z-index: 1;
    width: 12px;
    height: 56px;
    border: 1px solid #000;
    border-radius: 6px;
    background:
      radial-gradient(circle, var(--gold) 1.6px, transparent 2.2px) center 14px / 12px 9px repeat-y,
      linear-gradient(90deg, var(--bronze-300), var(--bronze-600) 55%, var(--bronze-900));
    box-shadow:
      0 0 0 1px #0008,
      0 2px 6px #000c;
  }
  .edge:hover i,
  .edge.dragging i,
  .edge:focus-visible i {
    background:
      radial-gradient(circle, #fff6dc 1.8px, transparent 2.4px) center 14px / 12px 9px repeat-y,
      linear-gradient(90deg, var(--gold-pale), var(--bronze-300) 55%, var(--bronze-600));
    box-shadow:
      0 0 0 1px #000,
      0 0 10px var(--gold);
  }
  .edge:hover::before,
  .edge.dragging::before,
  .edge:focus-visible::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 6px;
    width: 2px;
    background: var(--gold);
    box-shadow:
      0 0 10px var(--gold),
      0 0 3px var(--gold-pale);
  }
  /* Closed, at any size: the map takes the width, and the panel is a sign over its corner. */
  .work.shut {
    grid-template-columns: minmax(0, 1fr);
  }
  .work.shut .mapbox {
    --lift: var(--peek, 0px);
  }
  .panel.closed {
    position: absolute;
    right: 0;
    bottom: 0;
    z-index: 1300;
    width: 340px;
    box-shadow:
      0 -1px 0 #000,
      0 -3px 0 var(--bronze-600),
      0 -4px 0 #000,
      -1px 0 0 #000,
      -3px 0 0 var(--bronze-600),
      -4px 0 0 #000,
      0 -10px 24px #000a;
  }
  /* Another character shown: a band of the blue of what is on, along the top of the panel. */
  .viewing {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 7px 12px 7px 16px;
    background: linear-gradient(var(--disc-low), #072a40);
    box-shadow:
      inset 0 -1px 0 #000,
      inset 0 1px 0 #ffffff1f;
    font: var(--t-small);
  }
  .viewing b {
    font-weight: 600;
  }
  .viewing .back {
    margin-left: auto;
    padding: 0 10px;
    height: 24px;
    font: 400 13px/20px var(--display);
    white-space: nowrap;
  }
  /* Closed: the next stop, as a sign reads it, and nothing to press but the way to open. */
  .panel.closed .viewing,
  .panel.closed :global(.npc),
  .panel.closed footer,
  .panel.closed :global(.now > :not(.plate, .none)),
  .panel.closed :global(.plate > :not(h2, .sign, .sheen)) {
    display: none;
  }
  .panel.closed :global(.now) {
    overflow: hidden;
  }

  /* A small screen: a phone upright (narrow) or on its side (low). The map takes it all, and the
     panel lies over it open too, along the foot of the screen. */
  @media (max-width: 760px), (max-height: 500px) {
    .work,
    .work.map-right {
      grid-template-columns: minmax(0, 1fr);
    }
    /* Over the map, the panel is not dragged wider nor sent to the other side. */
    .edge,
    .swap {
      display: none;
    }
    .work.map-right .panel.closed {
      right: 0;
    }
    .work .mapbox {
      --lift: var(--peek, 0px);
    }
    .panel,
    .panel.closed {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1300;
      width: auto;
      max-height: min(62dvh, 100%);
      box-shadow:
        0 -1px 0 #000,
        0 -3px 0 var(--bronze-600),
        0 -4px 0 #000,
        0 -10px 24px #000a;
    }
  }
  /* The name of the Auction House gives before the others: AH where the row runs short, then the
     glyph alone, before the row would reach under the three buttons of Windows. */
  .word.short {
    display: none;
  }
  @media (max-width: 1280px) {
    :global(html:not(.web)) .word.long {
      display: none;
    }
  }
  @media (max-width: 1280px) and (min-width: 801px) {
    :global(html:not(.web)) .word.short {
      display: inline;
    }
  }
  /* The app's window narrower than its top row at full size: nothing may go under the three buttons of Windows.
     The entries are their glyphs alone first; then the state of the link is its light alone. */
  @media (max-width: 1100px) {
    :global(html:not(.web)) .entry .word {
      display: none;
    }
    :global(html:not(.web)) .entry {
      margin-left: 0;
      padding: 0 8px;
    }
  }
  @media (max-width: 900px) {
    :global(html:not(.web)) .status .word {
      display: none;
    }
    :global(html:not(.web)) .status {
      height: 33px; /* the light alone keeps the line of the words it stands for */
    }
  }
  /* The top row of a narrow screen: the search between the section and the state of the link. */
  @media (max-width: 760px) {
    /* Feedback leaves the row to the search: on a narrow screen it is reached from the settings. */
    .entry.feedback {
      display: none;
    }
    .top {
      gap: 8px;
      padding-left: 8px;
    }
    :global(html.web) .top {
      padding-right: 8px;
    }
    .tab,
    .entry {
      padding: 0 8px;
    }
    .entry {
      margin-left: 0;
    }
    /* The sections and Settings are their glyphs alone, on a phone too. */
    .tab .word,
    .entry .word {
      display: none;
    }
    .status .left {
      display: none;
    }
  }
  /* Narrower still, the state of the link is its light alone: when there is something to do, the map says it in words. */
  @media (max-width: 480px) {
    .status .word {
      display: none;
    }
    .status {
      height: 33px; /* the light alone keeps the line of the words it stands for */
    }
  }
  /* A phone on its side: the panel stands on the left, as wide as on a desk, and nothing is lifted. */
  @media (max-height: 500px) and (min-width: 560px) {
    .work .mapbox,
    .work.shut .mapbox {
      --lift: 0px;
    }
    .panel,
    .panel.closed {
      right: auto;
      width: 340px;
      max-height: 100%;
    }
    .panel:not(.closed) {
      top: 0;
    }
    /* The line at the foot of the map keeps clear of the closed panel. */
    .mapbox :global(.map-note) {
      left: 362px;
    }
  }
  /* Under a finger the entries of the top row are pressed on the whole height of the row. */
  @media (pointer: coarse) {
    .grip {
      height: 44px;
    }
    .tab,
    .entry {
      position: relative;
    }
    .tab::after,
    .entry::after {
      content: '';
      position: absolute;
      inset: -9px -4px -6px;
    }
  }
</style>
