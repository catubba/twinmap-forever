<script lang="ts">
  // The main screen: the top row with the state of the link, the map in its frame, and the Now panel.
  import { experience, linkStatus, type LinkSnapshot } from '../../shared/link'
  import { tilesLine, type TilesStatus } from '../../shared/tiles-status'
  import { fade, fly } from 'svelte/transition'
  import type { SetupStatus } from '../../shared/setup'
  import FirstRun from './FirstRun.svelte'
  import Map from './Map.svelte'
  import { drop, gone, screen } from './motion'
  import Settings from './Settings.svelte'

  let link = $state<LinkSnapshot | null>(null)
  let now = $state(Date.now())
  // A listener must give nothing back: what it returns is copied across to the preload script, and a state object cannot be.
  window.twinmap.onLink((snapshot) => {
    link = snapshot
    now = Date.now()
  })
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

  const status = $derived(link ? linkStatus(link, now) : null)
  // The position is shown only while it is coming: an arrow left where the character was an hour ago would lie.
  const live = $derived(status?.kind === 'connected' || status?.kind === 'combat')
  const pos = $derived(live ? link?.state.sections.pos : undefined)
  // Level and experience stay as last seen.
  const char = $derived(link?.state.sections.char)
  const xp = $derived(char ? experience(char) : null)
  const mapReady = $derived(tiles?.state === 'ready')
  const insideReady = $derived(tiles?.state === 'ready' && !!tiles.interiors && !tiles.interiors.problem)
  const count = (n: number): string => n.toLocaleString('en-US')
</script>

<!-- The top row is the window's title bar too: it drags the window, a double click maximizes it. -->
<header class="top">
  {#if !onSetup}
    <nav aria-label="Sections">
      <button class="tab" aria-current={onSettings ? undefined : 'page'} onclick={() => (onSettings = false)}>Now</button>
    </nav>
  {/if}
  {#if status}
    <p class="status"><i class={status.tone}></i>{status.word}</p>
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
      <Map {pos} {insideReady} />
    {:else if tiles}
      <div class="making" class:failed={tiles.state === 'failed' || tiles.state === 'no-game'}>
        <p>{tilesLine(tiles)}</p>
        {#if tiles.state === 'no-game'}<button class="btn" onclick={() => window.twinmap.chooseGameFolder()}>Choose the game folder</button>{/if}
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
      linear-gradient(var(--stone-600), #1b140e 55%, var(--stone-950));
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
    color: #c9b48a;
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
    border-color: #a8843a;
    background: linear-gradient(#6a5238, var(--stone-700));
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
    margin: 0 0 0 auto;
    line-height: 31px; /* on the line of the entries beside it */
    padding-bottom: 2px;
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
  /* A lozenge stud on each corner: bronze, with a dark red heart. */
  .mapbox::before {
    --stud: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 26'%3E%3ClinearGradient id='g' x2='1' y2='1'%3E%3Cstop stop-color='%23f6e09a'/%3E%3Cstop offset='.55' stop-color='%238a6a2c'/%3E%3Cstop offset='1' stop-color='%233a2a10'/%3E%3C/linearGradient%3E%3Cpath d='M13 1 25 13 13 25 1 13Z' fill='url(%23g)' stroke='%23000'/%3E%3Cpath d='M13 8 18 13 13 18 8 13Z' fill='%23701008' stroke='%23000' stroke-width='.7'/%3E%3C/svg%3E");
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
    text-shadow:
      0 1px 3px #000,
      0 0 2px #000;
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
