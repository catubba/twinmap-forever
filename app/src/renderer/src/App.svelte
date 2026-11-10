<script lang="ts">
  import { lostPercent, type LinkSnapshot } from '../../shared/link'
  import { tilesLine, type TilesStatus } from '../../shared/tiles-status'

  let link = $state<LinkSnapshot | null>(null)
  window.twinmap.onLink((snapshot) => (link = snapshot))
  let tiles = $state<TilesStatus | null>(null)
  window.twinmap.onTiles((status) => (tiles = status))

  const GAME = { closed: 'Game not found', minimized: 'Game minimized', open: 'Game open' }
  const pos = $derived(link?.state.sections.pos)
  const age = $derived(
    link && link.state.updatedAt.pos ? Math.max(0, Math.round((Date.now() - link.state.updatedAt.pos) / 1000)) : null,
  )
</script>

<main>
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

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    background: #17110c;
    color: #f3ead9;
    font: 15px/1.4 'Segoe UI', system-ui, sans-serif;
  }

  main {
    height: 100vh;
    display: grid;
    place-content: center;
    text-align: center;
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
