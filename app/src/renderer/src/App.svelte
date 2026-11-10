<script lang="ts">
  import { lostPercent, type LinkSnapshot } from '../../shared/link'
  import { tilesLine, type TilesStatus } from '../../shared/tiles-status'
  import Map from './Map.svelte'

  let link = $state<LinkSnapshot | null>(null)
  // A listener must give nothing back: what it returns is copied across to the preload script, and a state object cannot be.
  window.twinmap.onLink((snapshot) => {
    link = snapshot
  })
  let tiles = $state<TilesStatus | null>(null)
  window.twinmap.onTiles((status) => {
    tiles = status
  })

  const GAME = { closed: 'Game not found', minimized: 'Game minimized', open: 'Game open' }
  const pos = $derived(link?.state.sections.pos)
  const mapReady = $derived(tiles?.state === 'ready')
  const insideReady = $derived(tiles?.state === 'ready' && !!tiles.interiors && !tiles.interiors.problem)
  const age = $derived(
    link && link.state.updatedAt.pos ? Math.max(0, Math.round((Date.now() - link.state.updatedAt.pos) / 1000)) : null,
  )
</script>

<!-- The top row is the window's title bar: it drags the window, a double click maximizes it. Its entries come later. -->
<header class="top"></header>
<div class="work">
{#if mapReady}
  <Map {pos} {insideReady} />
{/if}
<main class:over={mapReady}>
  <h1>Twinmap</h1>
  {#if !link}
    <p>Starting.</p>
  {:else}
    <p class="status">{GAME[link.game]}</p>
    {#if link.state.protocol}
      <p class="warning">{link.state.protocol.message}</p>
    {/if}

    {#if pos}
      <p class="zone">{pos.zone ?? 'Unknown zone'}{pos.sub ? `, ${pos.sub}` : ''}</p>
      <p class="coords">
        {pos.x !== undefined && pos.y !== undefined ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}` : 'No coordinates here'}
      </p>
      <p>
        Facing {pos.facing ?? '?'}° · map {pos.map ?? '?'} · {age === null ? '' : `${age} s ago`}
      </p>
    {:else}
      <p>No position yet. Is the Twinmap Forever addon on?</p>
    {/if}

    <p class="measures">
      {link.state.blocks} blocks · {link.state.lost} lost ({lostPercent(link.state).toFixed(2)}%) ·
      {link.state.corrupt} unreadable · {link.reads} reads in {Math.round(link.seconds)} s · {link.cpu.toFixed(1)}% of a core
    </p>
    {#if tiles}
      <p class="measures tiles" class:warning={tiles.state === 'failed' || tiles.state === 'no-game'}>{tilesLine(tiles)}</p>
    {/if}
  {/if}
</main>
</div>

<style>
  .top {
    height: 46px;
    /* From the top: the bronze moulding along the bottom, 6 px; the grain; the ground. */
    background:
      linear-gradient(#000, var(--bronze-700) 18%, var(--bronze-300) 42%, var(--bronze-600) 62%, var(--bronze-900) 86%, #000) bottom / 100% 6px no-repeat,
      var(--grain),
      linear-gradient(var(--stone-600), #1b140e 55%, var(--stone-950));
    -webkit-app-region: drag;
  }

  .work {
    position: absolute;
    inset: 46px 0 0;
  }

  main {
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
  }

  /* With the map on, the words move to a corner of it. */
  main.over {
    position: absolute;
    top: 12px;
    left: 56px;
    z-index: 1000;
    height: auto;
    display: block;
    padding: 10px 14px;
    border: 1px solid #5a4a2f;
    border-radius: 4px;
    background: rgb(23 17 12 / 0.9);
    text-align: left;
    pointer-events: none;
  }

  main.over h1 {
    font-size: 15px;
  }

  main.over p {
    margin-top: 4px;
    font-size: 13px;
  }

  main.over .zone {
    margin-top: 8px;
    font-size: 16px;
  }

  main.over .coords {
    font-size: 22px;
  }

  main.over .measures {
    margin-top: 8px;
    font-size: 12px;
  }

  h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #ffd100;
  }

  p {
    margin: 8px 0 0;
    color: #b9a88c;
  }

  .zone {
    margin-top: 24px;
    font-size: 22px;
    color: #f3ead9;
  }

  .coords {
    font-size: 40px;
    font-variant-numeric: tabular-nums;
    color: #f3ead9;
  }

  .warning {
    color: #ff8a5c;
  }

  .tiles {
    margin-top: 8px;
  }

  .measures {
    margin-top: 32px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
</style>
