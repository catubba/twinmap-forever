<script lang="ts">
  // The label on a point of the map: its name, where it is, how far and how long on foot. It opens
  // on the side with the most room and a thin line ties it to the point. Send to game marks the point
  // in the game, and says Sent once the addon tells it has it; Add to route puts it at the end of the route. Save keeps the point among My pins; a saved one is
  // renamed by writing over its name, and Remove takes it away.
  import type { Point } from '../../shared/geo'
  import { labelPlace, type Size } from '../../shared/point-label'
  import { fade, scale } from 'svelte/transition'
  import Glyph from './Glyph.svelte'
  import { gone, pop } from './motion'

  let {
    title,
    where, // zone coordinates, or nothing
    way, // distance, direction and time from the character, when it is on this map
    spot, // the point, in pixels of the map's box
    box, // the map's box
    sending, // whether the point can be sent to the game now, and why not
    acked, // the number of the last send the game has, as the addon tells it
    onsend, // sends the point: gives back the number of the send, or what went wrong
    routed, // the point is already a stop of the route
    onroute, // adds the point to the route
    saved, // the point is one of My pins
    onsave,
    onrename,
    onremove,
    onclose,
  }: {
    title: string
    where: string
    way: { far: string; time: string } | null
    spot: Point
    box: Size
    sending: { can: boolean; why: string }
    acked: number | undefined
    onsend: () => Promise<{ seq: number } | { error: string }>
    routed: boolean
    onroute: () => void
    saved: boolean
    onsave: () => void
    onrename: (name: string) => void
    onremove: () => void
    onclose: () => void
  } = $props()

  const SENT_FOR = 2000 // ms the button says Sent
  const GIVE_UP = 20_000 // ms without a word from the game: it reads nothing in combat
  let phase = $state<'rest' | 'sending' | 'sent'>('rest')
  let awaited = $state<number | null>(null)
  let note = $state('')
  async function go(): Promise<void> {
    if (phase !== 'rest') return
    phase = 'sending'
    note = ''
    const answer = await onsend()
    if ('error' in answer) {
      phase = 'rest'
      note = answer.error
    } else awaited = answer.seq
  }
  $effect(() => {
    if (phase === 'sending' && awaited !== null && acked === awaited) phase = 'sent'
  })
  $effect(() => {
    if (phase === 'rest') return
    const sent = phase === 'sent'
    const timer = setTimeout(() => {
      phase = 'rest'
      awaited = null
      if (!sent) note = 'No answer from the game yet. It takes the pin once you are out of combat.'
    }, sent ? SENT_FOR : GIVE_UP)
    return () => clearTimeout(timer)
  })

  let width = $state(0), height = $state(0)
  const at = $derived(labelPlace(spot, box, { width, height }))
  // The line ends on the label's edge nearest to the point.
  const end = $derived({ x: Math.max(at.left, Math.min(spot.x, at.left + width)), y: Math.max(at.top, Math.min(spot.y, at.top + height)) })
</script>

<svg class="tie" aria-hidden="true" in:fade={gone} out:fade={gone}>
  <line x1={spot.x} y1={spot.y} x2={end.x} y2={end.y} />
  <circle cx={spot.x} cy={spot.y} r="3.5" />
</svg>
<div class="label" data-side={at.side} role="dialog" in:scale={pop()} out:fade={gone} aria-label={title} style:left="{at.left}px" style:top="{at.top}px" style:visibility={width ? 'visible' : 'hidden'} bind:offsetWidth={width} bind:offsetHeight={height}>
  <button class="close" aria-label="Close" onclick={onclose}><Glyph name="close" size={14} /></button>
  {#if saved}
    <input class="name" aria-label="Name of the pin" value={title} maxlength="60" spellcheck="false" onchange={(e) => onrename(e.currentTarget.value)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  {:else}
    <h3>{title}</h3>
  {/if}
  {#if where}<p class="dim">{where}</p>{/if}
  {#if way}<p>{way.far}, {way.time}</p>{/if}
  <div class="go">
    <button class="btn" disabled={!sending.can} aria-busy={phase === 'sending'} onclick={go}>{phase === 'sending' ? 'Sending' : phase === 'sent' ? 'Sent' : 'Send to game'}</button>
    <button class="btn" disabled={routed} onclick={onroute}>{routed ? 'In route' : 'Add to route'}</button>
    {#if saved}<button class="btn" onclick={onremove}>Remove</button>{:else}<button class="btn" onclick={onsave}>Save</button>{/if}
  </div>
  {#if note || !sending.can}<p class="dim why" role="status">{note || sending.why}</p>{/if}
</div>

<style>
  .tie {
    position: absolute;
    inset: 0;
    z-index: 1150;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  line {
    stroke: #fff;
    stroke-width: 1;
    filter: drop-shadow(0 0 1px #000);
  }
  circle {
    fill: #fff;
    stroke: #000;
    stroke-width: 1.5;
  }

  .label {
    position: absolute;
    z-index: 1150;
    min-width: 236px;
    max-width: 344px;
    padding: 10px 12px;
    border: 2px solid var(--float-edge);
    border-radius: 7px;
    background: var(--grain), var(--float);
    box-shadow:
      0 0 0 1px #000,
      0 6px 16px #000000b3;
  }
  h3 {
    margin: 0 20px 0 0;
    font: 400 18px/22px var(--display);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  /* The name of a saved pin is written over: it looks like the title until it is pointed at or held. */
  .name {
    display: block;
    width: calc(100% - 24px);
    margin: -3px 0 -1px -5px;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    font: 400 18px/22px var(--display);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  .name:hover {
    border-color: var(--bronze-600);
  }
  .name:focus {
    border-color: var(--gold-pale);
    background: #0008;
    outline: none;
  }
  p {
    margin: 0;
  }
  .dim {
    color: var(--text-dim);
  }
  /* Sending and Sent are shorter words: the button keeps its width, so the one beside it stays put. */
  .go .btn:first-child {
    min-width: 112px;
  }
  .why {
    margin-top: 7px;
    max-width: 296px;
  }
  .go {
    display: flex;
    gap: 8px;
    margin-top: 9px;
  }
  .close {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .close:hover {
    color: var(--text);
  }
</style>
