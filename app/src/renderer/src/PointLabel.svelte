<script lang="ts">
  // The label on a point of the map: its name, where it is, how far and how long on foot. It opens
  // on the side with the most room and a thin line ties it to the point. Its two buttons stay off
  // until the app can send to the game.
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
    onclose,
  }: { title: string; where: string; way: { far: string; time: string } | null; spot: Point; box: Size; onclose: () => void } = $props()

  let width = $state(0), height = $state(0)
  const at = $derived(labelPlace(spot, box, { width, height }))
  // The line ends on the label's edge nearest to the point.
  const end = $derived({ x: Math.max(at.left, Math.min(spot.x, at.left + width)), y: Math.max(at.top, Math.min(spot.y, at.top + height)) })
</script>

<svg class="tie" aria-hidden="true" in:fade={gone} out:fade={gone}>
  <line x1={spot.x} y1={spot.y} x2={end.x} y2={end.y} />
  <circle cx={spot.x} cy={spot.y} r="3.5" />
</svg>
<div class="label" data-side={at.side} role="dialog" in:scale={pop} out:fade={gone} aria-label={title} style:left="{at.left}px" style:top="{at.top}px" style:visibility={width ? 'visible' : 'hidden'} bind:offsetWidth={width} bind:offsetHeight={height}>
  <button class="close" aria-label="Close" onclick={onclose}><Glyph name="close" size={14} /></button>
  <h3>{title}</h3>
  {#if where}<p class="dim">{where}</p>{/if}
  {#if way}<p>{way.far}, {way.time}</p>{/if}
  <div class="go">
    <button class="btn" disabled title="Not yet">Send to game</button>
    <button class="btn" disabled title="Not yet">Add to route</button>
  </div>
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
    max-width: 320px;
    padding: 10px 12px;
    border: 2px solid var(--float-edge);
    border-radius: 7px;
    background: var(--grain), var(--float);
    box-shadow: 0 0 0 1px #000;
  }
  h3 {
    margin: 0 20px 0 0;
    font: 400 18px/22px var(--display);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  p {
    margin: 0;
  }
  .dim {
    color: var(--text-dim);
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
