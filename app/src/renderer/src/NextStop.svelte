<script lang="ts">
  // The band of the next stop: the one full gold of the screen. It says where to go, which way and
  // how long; under it the route is skipped through, edited and cleared. With no route it is a flat line.
  import type { Band, Route, Stop } from '../../shared/route'
  import { slide } from 'svelte/transition'
  import Glyph from './Glyph.svelte'
  import { still } from './motion'

  let {
    route,
    band,
    sending, // whether the route can be sent to the game now, and why not
    inGame, // the game tells it has this very route
    onsend, // sends the route: gives back what went wrong, or nothing
    onskip, // on to the stop after, asked by the player
    onarrive, // on to the stop after: the character has been at the stop for a moment
    onclear, // the route is taken away, asked by the player
    onend, // the route was walked to its end
    onremove,
    onmove,
    onpick, // a stop of the list was chosen: the map should go there
  }: {
    route: Route
    band: Band
    sending: { can: boolean; why: string }
    inGame: boolean
    onsend: () => Promise<string>
    onskip: () => void
    onarrive: () => void
    onclear: () => void
    onend: () => void
    onremove: (index: number) => void
    onmove: (from: number, to: number) => void
    onpick: (stop: Stop) => void
  } = $props()

  const DWELL = 3000 // ms at a stop, or on "Route complete", before moving on
  let editing = $state(false)
  // The band is told afresh with every reading of the position: only the stop reached starts the wait.
  const dwelling = $derived(band.state === 'arrived' ? `at ${band.n}` : band.state === 'complete' ? 'complete' : '')
  $effect(() => {
    if (!dwelling) return
    const timer = setTimeout(() => (dwelling === 'complete' ? onend() : onarrive()), DWELL)
    return () => clearTimeout(timer)
  })
  $effect(() => {
    if (band.state === 'none') editing = false
  })
  const open = { duration: still() ? 0 : 160 }
  let note = $state('') // what went wrong with the last send
  async function send(): Promise<void> {
    note = await onsend()
  }
</script>

{#if band.state === 'none'}
  <p class="none">No route. Click the map to add a stop.</p>
{:else}
  <section class="plate" aria-label="Next stop">
    <h2>Next stop {#if band.state !== 'complete'}<span>{band.n} of {band.of}</span>{/if}</h2>
    <!-- A new stop ahead: a light crosses the band once. -->
    {#key band.state === 'complete' ? 'complete' : band.n + band.name}<i class="sheen"></i>{/key}
    <div class="sign" role="status">
      {#if band.state === 'complete'}
        <div class="square"><Glyph name="check" size={30} /></div>
        <div class="what"><b>Route complete</b></div>
      {:else}
        {#if band.state === 'going' || band.state === 'arrived'}
          <div class="square">
            {#if band.state === 'arrived'}<Glyph name="check" size={30} />{:else}<Glyph name="direction" size={30} turn={band.turn} />{/if}
          </div>
        {/if}
        <div class="what">
          <b>{band.name}</b>
          {#if band.state === 'going' || band.state === 'arrived'}<span>{band.far}</span>{/if}
          {#if band.state === 'elsewhere'}<span>Not on the ground you are on</span>{/if}
        </div>
        {#if band.state === 'arrived'}
          <div class="time"><b>Here</b></div>
        {:else if band.state === 'going'}
          <div class="time"><b>{band.minutes}</b><span>min on foot</span></div>
        {/if}
      {/if}
    </div>
    {#if band.state !== 'complete'}
      <div class="go">
        <button class="btn" onclick={onskip}>Skip</button>
        <button class="btn" aria-expanded={editing} onclick={() => (editing = !editing)}>Edit route</button>
        <button class="btn" onclick={onclear}>Clear</button>
      </div>
      {#if !route.sent}
        <p class="unsent">Not in game yet <button class="btn" disabled={!sending.can} onclick={send}>Send route to game</button></p>
        {#if note || !sending.can}<p class="why" role="status">{note || sending.why}</p>{/if}
      {:else if !inGame && sending.can}
        <p class="why" role="status">On its way to the game.</p>
      {/if}
    {/if}
  </section>
  {#if editing}
    <ol class="stops" transition:slide={open}>
      {#each route.stops as stop, i (`${stop.continent} ${stop.at.x} ${stop.at.y}`)}
        {@const done = i < route.next}
        <li class:done class:next={i === route.next}>
          <span class="n">{#if done}<Glyph name="check" size={12} />{:else}{i + 1}{/if}</span>
          <button class="name" onclick={() => onpick(stop)}>{stop.name}</button>
          {#if !done}
            <button class="tool up" aria-label="Move {stop.name} up" disabled={i <= route.next} onclick={() => onmove(i, i - 1)}><Glyph name="menu" size={14} /></button>
            <button class="tool" aria-label="Move {stop.name} down" disabled={i >= route.stops.length - 1} onclick={() => onmove(i, i + 1)}><Glyph name="menu" size={14} /></button>
          {/if}
          <button class="tool last" aria-label="Remove {stop.name}" onclick={() => onremove(i)}><Glyph name="close" size={14} /></button>
        </li>
      {/each}
    </ol>
  {/if}
{/if}

<style>
  .none {
    margin: 0;
    padding: 12px 16px;
    color: var(--text-dim);
    box-shadow: 0 1px 0 var(--stone-700);
  }
  .plate {
    position: relative;
    flex: none;
    overflow: hidden;
    background: var(--grain), linear-gradient(var(--plate-top), var(--plate-mid) 60%, var(--plate-low));
    box-shadow:
      inset 0 0 0 1px var(--bronze-600),
      inset 0 2px 0 #fff6,
      0 1px 0 #000;
    color: var(--plate-ink);
  }
  h2 {
    display: flex;
    justify-content: space-between;
    margin: 0;
    padding: 0 16px;
    font: var(--t-title);
    line-height: 27px;
    color: var(--gold-pale);
    text-shadow: 0 1px 0 #000;
    background: linear-gradient(var(--plate-band-top), var(--plate-band-low));
    box-shadow: inset 0 -1px 0 #0006;
  }
  h2 span {
    font: var(--t-body);
    line-height: 27px;
  }
  .sheen {
    position: absolute;
    inset: 0;
    background: linear-gradient(100deg, transparent 35%, #fffc 50%, transparent 65%);
    translate: -100% 0;
    pointer-events: none;
    animation: sheen 600ms ease-out;
  }
  @keyframes sheen {
    from {
      translate: -100% 0;
    }
    to {
      translate: 100% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheen {
      animation: none;
    }
  }
  .sign {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 54px;
    padding: 12px 16px 10px;
  }
  .square {
    flex: none;
    display: grid;
    place-content: center;
    width: 54px;
    height: 54px;
    background: var(--plate-ink);
    color: var(--gold);
    box-shadow: 0 1px 0 #fff5;
  }
  .square :global(svg) {
    transition: rotate 400ms linear;
  }
  .what {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .what b {
    overflow: hidden;
    font: var(--t-name);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .time {
    flex: none;
    display: grid;
    justify-items: end;
  }
  .time b {
    font: var(--t-sign);
  }
  .go {
    display: flex;
    gap: 8px;
    padding: 0 16px 12px;
  }
  .unsent {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0;
    padding: 0 16px 12px;
  }
  .why {
    margin: -4px 0 0;
    padding: 0 16px 12px;
  }
  /* On the gold the ring of the keyboard is dark. */
  .plate .btn:focus-visible {
    outline-color: var(--plate-ink);
  }

  .stops {
    flex: none;
    margin: 0;
    padding: 6px 0 10px;
    list-style: none;
    box-shadow: 0 1px 0 var(--stone-700);
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 10px 0 16px;
  }
  li.next .name {
    color: var(--gold);
  }
  li.done,
  li.done .name {
    color: var(--text-dim);
  }
  .n {
    flex: none;
    width: 20px;
    color: var(--text-dim);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    padding: 0;
    border: 0;
    background: none;
    font: var(--t-body);
    color: var(--text);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .name:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .tool {
    flex: none;
    display: grid;
    place-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .tool:hover:not(:disabled) {
    background: #ffffff14;
    color: var(--text);
  }
  .tool:disabled {
    color: var(--text-off);
    cursor: default;
  }
  .tool.up {
    rotate: 180deg;
  }
  .tool.last {
    margin-left: auto;
  }
  .name:focus-visible,
  .tool:focus-visible {
    outline: 2px solid var(--gold-pale);
    outline-offset: -2px;
  }
</style>
