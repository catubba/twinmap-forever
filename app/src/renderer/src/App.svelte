<script lang="ts">
  // The main screen: the top row with the state of the link, the map in its frame, and the Now panel.
  import { experience, linkStatus, type LinkSnapshot } from '../../shared/link'
  import { groupFrom } from '../../shared/group'
  import { deathFrom, type Place as DeathPlace } from '../../shared/death'
  import { feedbackDetails } from '../../shared/feedback'
  import { tilesHelp, tilesLine, type TilesStatus } from '../../shared/tiles-status'
  import { onMount, tick, untrack } from 'svelte'
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
  import type { SetupStatus } from '../../shared/setup'
  import Feedback from './Feedback.svelte'
  import Participate from './Participate.svelte'
  import LangAsk from './LangAsk.svelte'
  import WhatsNew from './WhatsNew.svelte'
  import { newsFor, type Go } from '../../shared/news'
  import FirstRun from './FirstRun.svelte'
  import Glyph from './Glyph.svelte'
  import { add as addPanel, create as createSpace, edit, frame, layout, mount, move as moveSpace, nameOf, nowOver, open as openSpace, PART_DRAG, reach, remove as removeSpace, rename as renameSpace, reset as resetSpace, restore as restoreSpaces, section, setMapRight, titleOf, unmount } from './frame.svelte'
  import { CHARACTER, MOST, NAME_MOST } from '../../shared/workspaces'
  import Logo from './Logo.svelte'
  import Map from './Map.svelte'
  import { drop, gone, opened, screen } from './motion'
  import Settings from './Settings.svelte'
  import Picker from './Picker.svelte'
  import Items from './Items.svelte'
  import Professions from './Professions.svelte'
  import Spellbook from './Spellbook.svelte'
  import Talents from './Talents.svelte'
  import Auction from './Auction.svelte'
  import { homeOf, houseFrom, houseNumber, houseOf, type Alert, type Home, type House, type PricesTold } from '../../shared/ah'
  import ItemPopup from './ItemPopup.svelte'
  import SpellPopup from './SpellPopup.svelte'
  import NpcPanel from './NpcPanel.svelte'
  import ShoppingList from './ShoppingList.svelte'
  import { addTo, shoppingFrom } from '../../shared/shopping'
  import { firstName, knownOf, shownOf } from '../../shared/characters'
  import type { PortraitsTold } from '../../shared/portrait'
  import type { Sheets } from '../../shared/sheet'
  import { around, langNow, num, t } from '../../shared/i18n'

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
  // How wide the name of the zone is over the map: the buttons in the other corner make room for it (Map.svelte, .line).
  let readoutWidth = $state(0)
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
  // The shopping lists (M10-F4), kept the same way: a + puts a recipe or an item on the list of the character picked.
  const keptShopping = kept('shopping', shoppingFrom)
  const addToList = (item: number, spell?: number): void => {
    if (shown) keptShopping.value = addTo(keptShopping.value, shown.key, item, spell)
  }
  // The vendors of the list whose pins the map shows whatever its filters (M10-F19): turned on, the map comes in view.
  let shopVendors = $state.raw<number[]>([])
  const showVendors = (npcs: number[]): void => {
    if (npcs.length && !shopVendors.length) reach('map')
    shopVendors = npcs
  }
  let tiles = $state<TilesStatus | null>(null)
  window.twinmap.onTiles((status) => {
    tiles = status
  })

  // The first run shows by itself until its steps were all done once; then the app opens on the map.
  let setup = $state<SetupStatus | null>(null)
  // A page loaded again in another language opens where the player chose it: the first run or Settings.
  const keptView = sessionStorage.getItem('view')
  sessionStorage.removeItem('view')
  let onSetup = $state<boolean | null>(keptView === 'setup' ? true : null)
  // Settings lie over the map, which stays as it was underneath.
  let onSettings = $state(keptView === 'settings')
  // Feedback is a small window over whatever is on show.
  let onFeedback = $state(false)
  let answered = $state(false) // Help improve Twinmap was answered in this run: the setup may tell it a moment later
  let langClosed = $state(false) // the same for the language asked after the update
  let newsClosed = $state(false) // the same for What's new
  let newsAll = $state(false) // What's new opened from Settings, with every version
  // The news as the app starts after an update: the versions since the one the player last saw them at (main/setup.ts, newsSinceOf).
  const news = $derived(setup && setup.newsSince != null ? newsFor(langNow(), setup.newsSince, setup.version) : [])
  // Where the link at the end of an entry leads: a tab, Settings, or the Layers menu of the map.
  const go = (to: Go): void => {
    if (to === 'settings') return void (onSettings = true)
    onSettings = false
    reach(to === 'items' ? 'character' : to === 'ah' ? 'search' : 'map')
    if (to === 'layers') void tick().then(() => mapView?.openLayers())
  }
  window.twinmap.onSetup((told) => {
    // Another language chosen (here or on the computer): the page loads again, every text in it.
    if (told.lang && told.lang !== langNow()) {
      sessionStorage.setItem('view', onSetup ? 'setup' : onSettings ? 'settings' : '')
      location.reload()
      return
    }
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
  let wrong = $state('') // what was wrong with the folder the player picked
  // The panel closes at any size: closed, it lies over a corner of the map and shows the next stop
  // and nothing else, and what stands at the foot of the map is lifted by its closed height. On a
  // small screen (a phone, either way up) it lies over the map open too, and starts closed; on a
  // larger one it starts as it was left.
  const SMALL = '(max-width: 760px), (max-height: 500px)'
  let panelOpen = $state(!matchMedia(SMALL).matches && localStorage.getItem('panel') !== 'closed')
  let small = $state(matchMedia(SMALL).matches)
  matchMedia(SMALL).addEventListener('change', (e) => (small = e.matches))
  // The workspaces (M20, frame.svelte.ts): made once the frame and the stash of the sections are there, from what the
  // app's window kept. Closed, or on a small screen, Now lies over the map, as it did before them.
  let frameBox = $state<HTMLElement>()
  let stashBox = $state<HTMLElement>()
  const setupKnown = $derived(setup !== null)
  $effect(() => {
    if (!frameBox || !stashBox || !setupKnown) return
    const [root, held] = [frameBox, stashBox]
    untrack(() => mount(root, held, setup?.workspaces))
    return unmount
  })
  $effect(() => {
    const over = !panelOpen || small
    untrack(() => nowOver(over))
  })
  // Now closes, and lies over the map, only beside it as the app was before the workspaces (frame.paired) and while the
  // layout is locked; in any other layout it is a panel as the others, closed with Edit layout.
  const nowShut = $derived(!panelOpen && frame.paired && !frame.editing)
  const nowAbove = $derived((!panelOpen || small) && frame.paired && !frame.editing)
  // Ctrl with 1 to 6: the workspaces by their place among the tabs. Ctrl and E: Edit layout, on and off.
  function spaceKey(e: KeyboardEvent): void {
    if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || onSetup !== false) return
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault()
      onSettings = false
      edit(!frame.editing)
      return
    }
    const n = Number(e.key)
    if (!Number.isInteger(n) || n < 1 || n > frame.spaces.length) return
    e.preventDefault()
    onSettings = false
    openSpace(n - 1)
  }
  // The bar of Edit layout: the list of Add panel open, the question before Restore default workspaces.
  let adding = $state(false)
  let sure = $state(false)
  // The workspaces at the top, while the layout is unlocked: the one whose name is a field, the one asked about before it
  // is deleted, the one dragged and where it would land (before or after the tab under the pointer).
  let naming = $state<string | null>(null)
  let deleting = $state<string | null>(null)
  let dragged = $state<number | null>(null)
  let landing = $state<{ at: number; after: boolean } | null>(null)
  // The glyph of a default workspace; one the player made has the first letter of its name.
  const SPACE_GLYPHS: Record<string, 'pin' | 'bag' | 'coins'> = { map: 'pin', character: 'bag', ah: 'coins' }
  const letterOf = (name: string): string => ([...name][0] ?? '').toLocaleUpperCase()
  $effect(() => {
    if (frame.editing) return
    deleting = dragged = null
    landing = null
  })
  function named(i: number, value: string | null): void {
    if (naming === null) return
    naming = null
    if (value !== null) renameSpace(i, value)
  }
  function chosen(node: HTMLInputElement): void {
    node.focus()
    node.select()
  }
  function spaceDrag(e: DragEvent, i: number): void {
    if (!frame.editing || !e.dataTransfer) return
    e.dataTransfer.setData('application/x-twinmap-workspace', String(i))
    e.dataTransfer.effectAllowed = 'move'
    dragged = i
  }
  function spaceOver(e: DragEvent, i: number): void {
    if (dragged === null) return
    e.preventDefault()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    landing = { at: i, after: e.clientX > r.left + r.width / 2 }
  }
  function spaceDrop(e: DragEvent): void {
    if (dragged === null || !landing) return
    e.preventDefault()
    const to = landing.at + (landing.after ? 1 : 0)
    moveSpace(dragged, to > dragged ? to - 1 : to)
    dragged = landing = null
  }
  function togglePanel(): void {
    panelOpen = !panelOpen
    if (!matchMedia(SMALL).matches) localStorage.setItem('panel', panelOpen ? 'open' : 'closed')
  }
  let panelHeight = $state(0)
  let peek = $state(0)
  $effect(() => {
    if (nowShut) peek = panelHeight
  })
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

<svelte:window onwheel={wheel} onkeydown={spaceKey} />

{#if opening}
  <div class="opening" out:fade={opened}><Logo size={96} stacked /></div>
{/if}

<!-- The top row is the window's title bar too: it drags the window, a double click maximizes it. -->
<header class="top" class:editing={frame.editing}>
  {#if onSetup === false}
    <Picker known={characters} {shown} {now} onpick={(key) => (picked = key)} onforget={(key) => void window.twinmap.forgetSheet(key)} />
  {/if}
  {#if !onSetup}
    <nav aria-label={t('app.top.sections')} class:editing={frame.editing && frame.spaces.length > 1} class:many={frame.spaces.length > 3}>
      {#each frame.spaces as space, i (space.id)}
        {@const name = nameOf(space)}
        {@const glyph = SPACE_GLYPHS[space.id]}
        {#if naming === space.id}
          <span class="tab naming" aria-current={frame.open === i ? 'page' : undefined}>
            {#if glyph}<Glyph name={glyph} size={18} />{:else}<span class="letter" aria-hidden="true">{letterOf(name)}</span>{/if}
            <input value={name} maxlength={NAME_MOST} aria-label={t('app.layout.rename')} use:chosen onblur={(e) => named(i, e.currentTarget.value)} onkeydown={(e) => (e.key === 'Enter' ? named(i, e.currentTarget.value) : e.key === 'Escape' ? named(i, null) : undefined)} />
          </span>
        {:else}
          <!-- Its name gives first: Auction House, then AH, then the glyph alone with the others. A name the player wrote, or a
               workspace they made, is the first letter of it alone. -->
          <button
            class="tab"
            class:dragged={dragged === i}
            class:before={landing?.at === i && !landing.after}
            class:after={landing?.at === i && landing.after}
            title={name}
            aria-label={name}
            aria-current={frame.open === i ? 'page' : undefined}
            draggable={frame.editing}
            ondragstart={(e) => spaceDrag(e, i)}
            ondragover={(e) => spaceOver(e, i)}
            ondragleave={() => landing?.at === i && (landing = null)}
            ondrop={spaceDrop}
            ondragend={() => (dragged = landing = null)}
            ondblclick={() => frame.editing && (naming = space.id)}
            onclick={() => ((onSettings = false), openSpace(i))}
            >{#if glyph}<Glyph name={glyph} size={18} />{:else}<span class="letter" aria-hidden="true">{letterOf(name)}</span>{/if}{#if space.id === 'ah' && !space.name}<span class="word long">{t('app.top.auctionHouse')}</span><span class="word short">{t('app.top.auctionHouseShort')}</span>{:else}<span class="word">{name}</span>{/if}</button
          >
        {/if}
        {#if frame.editing && frame.spaces.length > 1 && naming !== space.id}
          <button class="unspace" title={t('app.layout.deleteSpace')} aria-label="{t('app.layout.deleteSpace')}: {name}" onclick={() => ((sure = adding = false), (deleting = space.id))}><Glyph name="close" size={12} /></button>
        {/if}
      {/each}
      {#if frame.editing}
        {@const most = frame.spaces.length >= MOST}
        {@const say = most ? t('app.layout.spacesMost', { most: MOST }) : t('app.layout.newSpace')}
        <button class="tab new" title={say} aria-label={say} disabled={most} onclick={() => ((onSettings = false), (naming = createSpace() ?? null))}><Glyph name="plus" size={16} /></button>
      {/if}
    </nav>
    {#if onSetup === false}
      {@const editName = t('app.layout.edit', { ctrl: t('settings.keys.ctrl') })}
      <button class="edit" title={editName} aria-label={editName} aria-pressed={frame.editing} onclick={() => ((onSettings = false), edit(!frame.editing))}><Glyph name="layout" size={18} /></button>
    {/if}
  {/if}
  {#if onSetup === false && mapReady}
    <Search ready={mapReady} {pos} side={char?.side} onadd={shown ? addToList : undefined} onpick={(place) => (reach('map'), mapView?.goTo(place))} />
  {/if}
  {#if status}
    <!-- The state of the link is the Pause button too: two bars to pause, the arrow of play to resume. -->
    <button class="status" class:alone={onSetup !== false || !mapReady} class:paused title={paused ? t('app.top.resume') : t('app.top.pause')} aria-label={paused ? t('app.top.resume') : t('app.top.pause')} aria-pressed={paused} onclick={() => setPause(!paused)}><i class={status.tone}></i><span class="word">{status.word}</span>{#if inbox && !inbox.off && inbox.id === undefined}<span class="left" class:low={inbox.left < 5}>{t('app.top.sendsLeft', { count: inbox.left })}</span>{/if}<span class="toggle"><Glyph name={paused ? 'play' : 'pause'} size={16} /></span></button>
  {/if}
  {#if setup}
    <!-- The bug and the cog say what the words may not, to those who do not know them; in a narrow window they stand alone. The sections have theirs too: the pin of where you are, the bag. -->
    <button class="entry feedback" title={t('app.top.feedbackHint')} aria-label={t('app.top.feedback')} onclick={() => (onFeedback = true)}><Glyph name="bug" size={18} /><span class="word">{t('app.top.feedback')}</span></button>
  {/if}
  {#if onSetup === false}
    <button class="entry" title={t('app.top.settings')} aria-label={t('app.top.settings')} aria-haspopup="dialog" aria-expanded={onSettings} onclick={() => (onSettings = true)}><Glyph name="gear" size={18} /><span class="word">{t('app.top.settings')}</span></button>
  {/if}
</header>

{#if onFeedback && setup}
  <Feedback details={feedbackDetails(setup, tiles, status?.word ?? null)} onclose={() => (onFeedback = false)} />
{/if}
{#if newsAll && setup}
  <WhatsNew releases={newsFor(langNow(), 'all', setup.version)} all onclose={() => (newsAll = false)} ongo={go} />
{/if}
<!-- The language after the update, then What's new, then Help improve Twinmap: each asked once, on this computer only, after the first run and never over another window. -->
{#if inApp && setup?.askLang && !langClosed && onSetup === false && !onFeedback}
  <LangAsk {setup} onclose={() => (langClosed = true)} />
{:else if inApp && news.length && !newsClosed && onSetup === false && !onFeedback}
  <WhatsNew releases={news} since={setup?.newsSince || undefined} onclose={() => (newsClosed = true)} ongo={go} />
{:else if inApp && setup && setup.participate === null && !answered && onSetup === false && !onFeedback}
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
        <h1>{t('app.elsewhere.title')}</h1>
        <p>{t('app.elsewhere.text')}</p>
      </main>
    {/if}
  </div>
{/if}
<!-- Settings is a window over what is on screen: the map, Items or the Auction House stay under it. -->
{#if onSettings && setup && onSetup === false}
  <Settings {setup} {tiles} onback={() => (onSettings = false)} onfeedback={() => (onFeedback = true)} onfirstrun={() => ((onSettings = false), (onSetup = true))} onnews={() => (newsAll = true)} />
{/if}
{#if onSetup === false}
<!-- The workspaces; the sections made once, in the stash until a panel of the open workspace takes them (frame.svelte.ts). -->
{#if frame.editing}
  <!-- Edit layout: what can be done while the open workspace is unlocked. -->
  <div class="editbar" role="toolbar" aria-label={t('app.layout.editKey')} in:fly={drop(8)}>
    {#if deleting !== null}
      {@const gone = frame.spaces.findIndex((s) => s.id === deleting)}
      <span class="hint">{t('app.layout.deleteSure', { name: gone >= 0 ? nameOf(frame.spaces[gone]!) : '' })}</span>
      <button class="btn" onclick={() => (removeSpace(gone), (deleting = null))}>{t('app.layout.deleteYes')}</button>
      <button class="btn" onclick={() => (deleting = null)}>{t('app.layout.deleteNo')}</button>
    {:else if sure}
      <span class="hint">{t('app.layout.restoreSure')}</span>
      <button class="btn" onclick={() => ((sure = false), restoreSpaces())}>{t('app.layout.restoreYes')}</button>
      <button class="btn" onclick={() => (sure = false)}>{t('app.layout.restoreNo')}</button>
    {:else}
      <span class="hint">{t('app.layout.hint')} {t('app.layout.hintSpaces')}</span>
      <span class="adding">
        <button class="btn" title={t('app.layout.addPanel')} aria-expanded={adding} disabled={!frame.missing.length} onclick={() => (adding = !adding)}><Glyph name="plus" /><span>{t('app.layout.addPanel')}</span></button>
        {#if adding && frame.missing.length}
          <ul class="menu" in:fly={drop()}>
            {#each frame.missing as id (id)}
              <li><button class="item" onclick={() => ((adding = false), addPanel(id))}>{titleOf(id)}</button></li>
            {/each}
          </ul>
        {/if}
      </span>
      <button class="btn" title={t('app.layout.reset')} onclick={() => ((adding = false), resetSpace())}><span>{t('app.layout.reset')}</span></button>
      <button class="btn" title={t('app.layout.restore')} onclick={() => ((adding = false), (deleting = null), (sure = true))}><span>{t('app.layout.restore')}</span></button>
    {/if}
    <button class="btn done" onclick={() => ((adding = sure = false), (deleting = null), edit(false))}><Glyph name="check" />{t('app.layout.done')}</button>
  </div>
{/if}
<div class="work" class:editing={frame.editing} class:shut={nowShut} class:map-right={layout.mapRight} in:fade={screen} style:--peek="{peek}px" bind:this={frameBox}></div>
<div class="stash" inert bind:this={stashBox}>
  <div class="mapbox" style:--readout="{readoutWidth}px" use:section={'map'}>
    {#if mapReady}
      <Map {pos} {group} {death} skills={char?.name ? sheets[char.name]?.pieces.skills : undefined} xpLevel={char ? (xp ? char.level : null) : undefined} bind:back kills={live ? link?.state.sections.kills : undefined} bind:looking at={link?.state.updatedAt.pos} bind:this={mapView} {insideReady} {quests} {fixed} side={char?.side} {live} {inbox} removed={live ? goneFrom(link?.state.sections.marks) : []} set={live ? setFrom(link?.state.sections.marks) : []} gameFollows={live ? followFrom(link?.state.sections.follow) : null} {journey} {route} marked={shopVendors} onroute={(stop) => setRoute(addStop(route, stop))} onnpc={(pin) => (npc = pin)} onsettings={(category) => (sessionStorage.setItem('settings', category), (onSettings = true))} />
    {:else if tiles}
      <div class="making" class:failed={tiles.state === 'failed' || tiles.state === 'no-game'}>
        <p>{tilesLine(tiles)}</p>
        {#if tilesHelp(tiles)}<p class="help">{tilesHelp(tiles)}</p>{/if}
        {#if tiles.state === 'no-game' && inApp}
          {#if wrong}<p>{wrong}</p>{/if}
          <button class="btn" onclick={choose}>{t('app.tiles.chooseFolder')}</button>
        {/if}
        {#if tiles.state === 'failed'}
          <button class="btn" onclick={() => window.twinmap.retryTiles()}>{t('app.tiles.retry')}</button>
        {/if}
      </div>
    {/if}
    {#if looking}
      <!-- The map was moved by hand: the zone and the coordinates of its middle. -->
      <div class="readout" bind:clientWidth={readoutWidth}>
        <b>{looking.zone}</b>
        {looking.where}
      </div>
    {:else if pos}
      <div class="readout" bind:clientWidth={readoutWidth}>
        <b>{pos.zone ?? t('app.map.unknownZone')}</b>
        {pos.sub ?? ''}
        {pos.x !== undefined && pos.y !== undefined ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : ''}
      </div>
    {/if}
    {#if setup?.gameFolder && !setup.addon}
      <p class="map-note with-button" role="status">{t('app.map.addonMissing')} <button class="btn" onclick={() => window.twinmap.openCurseForge()}>{t('app.map.getAddon')}</button></p>
    {:else if paused && mapReady}
      <p class="map-note with-button" role="status" in:fly={drop(8)} out:fade={gone}>{t('app.map.paused')} <button class="btn" onclick={() => setPause(false)}>{t('app.map.resume')}</button></p>
    {:else if status?.line && mapReady}
      {#key status.line}<p class="map-note" role="status" in:fly={drop(8)} out:fade={gone}>{status.line}</p>{/key}
    {/if}
  </div>

  <aside class="panel surface" class:closed={nowShut} class:over={nowAbove} aria-label={t('app.top.now')} bind:clientHeight={panelHeight} use:section={'now'}>
    <!-- Its bar only beside the map, locked: closed or open, and the map to the other side. -->
    {#if frame.paired && !frame.editing}
      <div class="head">
        <button class="grip" aria-expanded={panelOpen} onclick={togglePanel}><Glyph name="menu" turn={panelOpen ? 0 : 180} />{panelOpen ? t('app.panel.close') : t('app.panel.open')}</button>
        <!-- On the end of the bar next to the map: the map goes to the other side. -->
        {#if panelOpen}
          {@const to = layout.mapRight ? t('app.panel.mapLeft') : t('app.panel.mapRight')}
          <button class="swap" title={to} aria-label={to} onclick={() => setMapRight(!layout.mapRight)}><Glyph name="swap" /></button>
        {/if}
      </div>
    {/if}
    {#if inGame && shown && !shown.live}
      {@const showing = around('app.panel.showing', 'name')}
      <!-- Another character than the one in game: said where its bags and spells will show, with the way back. -->
      <p class="viewing" role="status">
        <span>{showing[0]}<b style:color={shown.color}>{shown.key}</b>{showing[1]}</span>
        <button class="btn back" onclick={() => (picked = null)}>{t('app.panel.backTo', { name: firstName(inGame) })}</button>
      </p>
    {/if}
    {#if npc}
      {#key npc}<NpcPanel pin={npc} {sheets} {shown} {now} {listing} onclose={() => (npc = null)} onadd={addToList} />{/key}
    {/if}
    <!-- The shopping list (M10-F4), above Now: a block taken out into a panel of its own as the others are. -->
    <div class="block-home"><div class="block surface" use:section={'shopping'}>
      {#if frame.editing}{@const pull = t('app.layout.pull')}<button class="block-pull" draggable="true" title={pull} aria-label="{pull}: {titleOf('shopping')}" ondragstart={(e) => e.dataTransfer?.setData(PART_DRAG, 'shopping')} onclick={() => addPanel('shopping')}><Glyph name="layout" size={14} /></button>{/if}
      <ShoppingList lists={keptShopping.value} onchange={(to) => (keptShopping.value = to)} {sheets} {shown} side={char?.side} {pos} {now} onvendors={showVendors} onroute={(stops) => setRoute(stops.reduce(addStop, route))} />
      {#if !keptShopping.value[shown?.key ?? '']?.length}<p class="block-empty"><b>{t('items.shopping.title')}</b> {t('items.shopping.empty')}</p>{/if}
    </div></div>
    <Now
      {pos}
      {quests}
    {log}
      {fixed}
      side={char?.side}
      xpLevel={char ? (xp ? char.level : null) : undefined}
      ready={mapReady}
      live={!!live}
      {inbox}
      {route}
      inGame={route.sent && gameRoute?.t === route.t}
      {journey}
      back={death ? back : null}
      met={alerts.filter((a) => a.met)}
      onalerts={() => ((onSettings = false), reach('alerts') || reach('search'), showAlerts++)}
      onsent={(t) => setRoute({ ...route, sent: true, t })}
      onskip={skip}
      onarrive={() => setRoute(advance(route))}
      onclear={clear}
      onend={() => setRoute(noRoute())}
      onremove={(index) => setRoute(removeStop(route, index))}
      onmove={(from, to) => setRoute(moveStop(route, from, to))}
      onstop={(stop) => mapView?.goTo({ continent: stop.continent, at: stop.at, title: stop.name })}
      onpick={(row) => mapView?.goTo({ continent: row.continent, at: row.at, title: row.name })} onpoint={(row) => mapView?.pointAt(row)} />
    <!-- Experience, a block of Now that is taken out into a panel of its own as the others are (Now.svelte). -->
    <div class="block-home"><div class="block surface" use:section={'experience'}>
      {#if frame.editing}{@const pull = t('app.layout.pull')}<button class="block-pull" draggable="true" title={pull} aria-label="{pull}: {titleOf('experience')}" ondragstart={(e) => e.dataTransfer?.setData(PART_DRAG, 'experience')} onclick={() => addPanel('experience')}><Glyph name="layout" size={14} /></button>{/if}
      {#if char}
        <footer>
          <p>
            <span>{xp ? t('app.panel.levelPercent', { level: char.level, percent: Math.floor(xp.percent) }) : t('app.panel.level', { level: char.level })}</span>
            {#if xp}<span class="dim">{t('app.panel.xp', { xp: num(char.xp!), max: num(char.max!) })}</span>{/if}
          </p>
          {#if xp}
            <div class="xp" role="progressbar" aria-label={t('app.panel.experience')} aria-valuenow={Math.floor(xp.percent)} style:--v="{xp.percent}%" style:--rest="{xp.rested}%"></div>
          {/if}
        </footer>
      {:else}
        <p class="block-empty"><b>{t('app.panel.experience')}</b> {t('app.panel.emptyExperience')}</p>
      {/if}
    </div></div>
  </aside>
  {#each CHARACTER as part (part)}
    <div class="sec" use:section={part}><Items {part} {sheets} {portraits} {shown} known={characters} {now} {listing} onpick={(key) => (picked = key)} /></div>
  {/each}
  <div class="sec" use:section={'professions'}><Professions {sheets} {shown} ready={mapReady} onadd={shown ? addToList : undefined} /></div>
  <div class="sec" use:section={'spellbook'}><Spellbook {sheets} {shown} ready={mapReady} /></div>
  <div class="sec" use:section={'talents'}><Talents {sheets} {shown} ready={mapReady} /></div>
  <div class="sec" use:section={'search'}><Auction {house} chosen={!!chosenHouse} hints={char ?? null} who={char?.name ?? null} {prices} {listing} {sheets} known={characters} {homes} {now} {alerts} {showAlerts} onchoose={chooseHouse} /></div>
</div>
{/if}

<!-- The popup of the item under the pointer, over everything (M10-F15). -->
<ItemPopup {sheets} known={characters} side={char?.side} {pos} {listing} />
<SpellPopup />

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
  .tab[aria-current] {
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

  /* The workspaces at the top while the layout is unlocked: a cross on each tab, a + after them, a tab dragged faint with a
     gold line where it would land, and the name as a field. A workspace the player made has the first letter of its name. */
  .letter {
    display: inline-grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border: 1.5px solid currentColor;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
  }
  .tab .word {
    max-width: 14em;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  nav.editing .tab {
    padding-right: 32px;
  }
  .unspace {
    flex: none;
    align-self: center;
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    margin: 6px 6px 0 -26px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
    -webkit-app-region: no-drag;
  }
  .unspace:hover {
    background: #0008;
    color: var(--text);
  }
  .tab.new {
    padding: 0 10px;
    border: 1px dashed var(--bronze-600);
    border-bottom: 0;
    color: var(--text-dim);
  }
  .tab.new:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tab.dragged {
    opacity: 0.45;
  }
  .tab.before {
    box-shadow: inset 3px 0 0 var(--gold);
  }
  .tab.after {
    box-shadow: inset -3px 0 0 var(--gold);
  }
  .tab.naming input {
    width: 7em;
    height: 24px;
    padding: 0 4px;
    border: 1px solid var(--gold);
    border-radius: 3px;
    background: var(--stone-950);
    font: var(--t-nav);
    color: var(--gold);
    outline: none;
  }
  /* More than three workspaces: where the row runs short, only the open one keeps its name, then none. While the layout
     is unlocked the search leaves the row to the crosses and the +, and with more than three workspaces only the open
     one keeps its name; where the row runs short, its cross too. */
  @media (max-width: 1500px) {
    :global(html:not(.web)) nav.many .tab:not([aria-current]) .word {
      display: none;
    }
    nav.many.editing .tab:not([aria-current]) {
      padding-right: 14px;
    }
    nav.many.editing .tab:not([aria-current]) + .unspace {
      display: none;
    }
  }
  .top.editing :global(.search) {
    display: none;
  }
  nav.many.editing .tab:not([aria-current]) .word {
    display: none;
  }
  @media (max-width: 1100px) {
    :global(html:not(.web)) nav.many .tab .word {
      display: none;
    }
  }

  /* The workspaces under the top row (frame.svelte.ts): the open one seen, the others laid out and hidden. */
  .work {
    position: absolute;
    inset: 46px 0 0;
  }
  /* Edit layout: the button after the tabs, gold while on; the bar under the top row; every group with a gold edge. */
  .edit {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 33px;
    height: 29px;
    margin: 0 0 2px -12px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: none;
    color: var(--nav-rest);
    cursor: pointer;
    -webkit-app-region: no-drag;
  }
  .edit:hover {
    border-color: var(--bronze-500);
    color: var(--text);
  }
  .edit[aria-pressed='true'] {
    border-color: var(--gold);
    background: #eacba426;
    color: var(--gold);
  }
  .editbar {
    position: absolute;
    inset: 46px 0 auto;
    height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background: var(--stone-950);
    box-shadow: inset 0 -2px 0 var(--gold);
    white-space: nowrap;
  }
  .editbar .hint {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font: var(--t-body);
    color: var(--text-dim);
  }
  /* Narrow, the hint goes first, then the buttons shorten their words; Done keeps its own. */
  .editbar .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }
  .editbar .btn > span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .editbar > .btn,
  .editbar .adding {
    flex: 0 1 auto;
    min-width: 48px;
  }
  .editbar .btn.done {
    flex: none;
  }
  .editbar .adding {
    position: relative;
    display: flex;
  }
  @media (max-width: 1000px) {
    .editbar .hint {
      display: none;
    }
    .editbar .done {
      margin-left: auto;
    }
  }
  .editbar .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 2100;
  }
  .work.editing {
    top: 86px;
  }
  .work.editing :global(.dv-groupview) {
    position: relative;
  }
  .work.editing :global(.dv-groupview::after) {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2000;
    border: 2px solid var(--gold);
    box-shadow: inset 0 0 24px #eacba470;
    pointer-events: none;
  }
  /* The drop zones: a gold veil with a full gold edge (M20-F1, drop B). */
  :global(.dockview-theme-twinmap .dv-drop-target-selection),
  :global(.dockview-theme-twinmap .dv-drop-target-anchor) {
    background-color: #eacba44d !important;
    border: 2px solid var(--gold) !important;
  }
  /* The last panel of a workspace has no cross: a workspace is never empty. */
  :global(.dockview-theme-twinmap .last .dv-default-tab-action) {
    display: none !important;
  }
  .work :global(.space) {
    position: absolute;
    inset: 0;
  }
  /* Hidden all through: dockview shows the cross of a tab with a visibility of its own. */
  .work :global(.space:not(.open)) {
    visibility: hidden;
    opacity: 0;
    pointer-events: none;
  }
  /* The sections no panel of the open workspace holds: out of sight, at the size they had. */
  .stash {
    position: fixed;
    left: -20000px;
    top: 0;
    width: 1600px;
    height: 900px;
    visibility: hidden;
  }
  /* What dockview gives a panel; its own stacking context, so the z-indexes of the map stay inside it. */
  :global(.dv-host) {
    position: relative;
    width: 100%;
    height: 100%;
    isolation: isolate;
  }
  /* Items and the Auction House, made to lie under the top row, fill their panel. */
  .sec {
    position: absolute;
    inset: 0;
  }
  .sec > :global(main) {
    inset: 0;
  }
  :global(.dockview-theme-twinmap) {
    --dv-group-view-background-color: var(--stone-900);
    --dv-tabs-and-actions-container-background-color: var(--stone-950);
    --dv-tabs-and-actions-container-height: 34px;
    --dv-tabs-and-actions-container-font-size: 14px;
    --dv-activegroup-visiblepanel-tab-color: var(--gold);
    --dv-inactivegroup-visiblepanel-tab-color: var(--gold);
    --dv-activegroup-hiddenpanel-tab-color: var(--nav-rest);
    --dv-inactivegroup-hiddenpanel-tab-color: var(--nav-rest);
    --dv-separator-border: transparent;
    --dv-sash-color: transparent;
    --dv-active-sash-color: transparent;
    color-scheme: dark;
  }
  /* A group of more than one panel: its tabs as those of the top row (M20-F1, tabs C). */
  :global(.dockview-theme-twinmap .dv-tabs-and-actions-container) {
    padding: 0 6px;
    box-shadow: inset 0 -1px 0 var(--bronze-600);
  }
  :global(.dockview-theme-twinmap .dv-tab) {
    margin-top: 4px;
    padding: 0 14px;
    border: 1px solid transparent;
    border-bottom: 0;
    border-radius: 5px 5px 0 0;
    background: none !important;
    font: var(--t-label);
    text-shadow: 0 1px 0 #000;
  }
  :global(.dockview-theme-twinmap .dv-tab.dv-active-tab) {
    border-color: var(--bronze-500);
    background: linear-gradient(var(--stone-500), var(--stone-700)) !important;
    box-shadow: inset 0 1px 0 #fff4;
  }
  /* The edge between two panels side by side: a bronze stud with five dots on the seam, the seam gold while the pointer
     is on it or drags it. A double click on the one beside Now puts the panel back to its first width. */
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash) {
    display: grid;
    place-items: center;
    overflow: visible;
    z-index: 1250;
  }
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash:not(.dv-disabled)::after) {
    content: '';
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
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash:not(.dv-disabled):hover::after),
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash:not(.dv-disabled):active::after) {
    background:
      radial-gradient(circle, #fff6dc 1.8px, transparent 2.4px) center 14px / 12px 9px repeat-y,
      linear-gradient(90deg, var(--gold-pale), var(--bronze-300) 55%, var(--bronze-600));
    box-shadow:
      0 0 0 1px #000,
      0 0 10px var(--gold);
  }
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash:not(.dv-disabled):hover::before),
  :global(.dockview-theme-twinmap .dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash:not(.dv-disabled):active::before) {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(50% - 1px);
    width: 2px;
    background: var(--gold);
    box-shadow:
      0 0 10px var(--gold),
      0 0 3px var(--gold-pale);
  }

  .mapbox {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: #000;
    /* What lies over the map asks how wide and how tall it is: on a narrow one things move out of each other's way, on a
       low one the menus scroll inside it. */
    container-type: size;
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
  /* In its own panel, as tall as it; over the map (closed, or a small screen) as tall as it has to be. */
  .panel:not(.over) {
    height: 100%;
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
  .work:not(.map-right) :global(.swap) {
    order: -1;
  }
  .work.map-right :global(.swap) {
    box-shadow:
      inset 0 -1px 0 #000,
      inset 1px 0 0 #000,
      inset 2px 0 0 #ffffff14;
  }
  /* The map on the right: the panel takes the left, and closed it lies over the map's left corner. */
  .work.map-right :global(.panel.closed) {
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
  /* Closed, at any size: the map takes the width, and the panel is a sign over its corner. */
  .work.shut :global(.mapbox) {
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
  .panel.closed :global(.now [data-section]:not([data-section='next'])),
  .panel.closed :global(.now [data-section='next'] > :not(.plate, .none)),
  .panel.closed :global(.plate > :not(h2, .sign, .sheen)) {
    display: none;
  }
  .panel.closed :global(.now) {
    overflow: hidden;
  }

  /* A small screen: a phone upright (narrow) or on its side (low). The map takes it all, and the
     panel lies over it open too, along the foot of the screen. */
  @media (max-width: 760px), (max-height: 500px) {
    /* Over the map, the panel is not sent to the other side. */
    .swap {
      display: none;
    }
    .work.map-right :global(.panel.closed) {
      right: 0;
    }
    .work :global(.mapbox) {
      --lift: var(--peek, 0px);
    }
    /* Only over the map: as a panel of another layout it stays in its place. */
    .panel.over {
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
    .work :global(.mapbox),
    .work.shut :global(.mapbox) {
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
