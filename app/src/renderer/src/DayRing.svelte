<script lang="ts">
  // The ring of the hour under the zone's name in the 3D view (M23-F10, design/daynight/panel-preview.html): the 24 hours
  // round it, midnight at the bottom and noon at the top, the sun on it (the moon at night) and the hour inside. Dragging
  // the sun moves the hour of the view's light; a click goes back to the game's hour. Gold while held away from it.
  import { clock, t } from '../../shared/i18n'
  import type { Daylight } from './daylight3d'

  let { daylight }: { daylight: Daylight } = $props()

  const SIZE = 64, BAND = 10
  let minutes = $state<number | null>(null)
  let holding = $state(false)
  // the hour moves by itself: read again every second
  $effect(() => {
    const read = (): void => void ((minutes = daylight.minutes), (holding = daylight.holding))
    read()
    const timer = setInterval(read, 1000)
    return () => clearInterval(timer)
  })

  // where on the ring an hour is, from the middle: noon up, midnight down, morning on the left
  const angle = (m: number): number => (m / 1440) * 2 * Math.PI + Math.PI / 2
  const on = SIZE / 2 - BAND / 2
  const knob = $derived(minutes === null ? null : { x: SIZE / 2 + Math.cos(angle(minutes)) * on, y: SIZE / 2 + Math.sin(angle(minutes)) * on })
  const shown = $derived(minutes === null ? '--:--' : clock(new Date(2000, 0, 1, Math.floor(minutes / 60), Math.floor(minutes) % 60).getTime()))

  let ring: HTMLButtonElement
  let down: { x: number; y: number; moved: boolean } | null = null
  const hourAt = (e: PointerEvent): number => {
    const box = ring.getBoundingClientRect(), a = Math.atan2(e.clientY - box.top - box.height / 2, e.clientX - box.left - box.width / 2)
    return Math.round(((((a - Math.PI / 2) / (2 * Math.PI)) % 1) + 1) % 1 * 1440 / 5) * 5 % 1440
  }
  function press(e: PointerEvent): void {
    down = { x: e.clientX, y: e.clientY, moved: false }
    ring.setPointerCapture(e.pointerId)
  }
  function drag(e: PointerEvent): void {
    if (!down) return
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return
    down.moved = true
    daylight.hold(hourAt(e))
    minutes = daylight.minutes
    holding = true
  }
  function lift(): void {
    // a click without dragging: the game's hour again
    if (down && !down.moved) {
      daylight.hold(null)
      minutes = daylight.minutes
      holding = false
    }
    down = null
  }
</script>

<button
  class="ring"
  class:held={holding}
  bind:this={ring}
  aria-label={t('map.daylight.ring')}
  title={t('map.daylight.ringTip')}
  onpointerdown={press}
  onpointermove={drag}
  onpointerup={lift}
  onpointercancel={() => (down = null)}
  onkeydown={(e) => {
    // arrows move the hour a quarter at a time; Enter or Space go back to the game's
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      daylight.hold(((((minutes ?? 720) + (e.key === 'ArrowRight' ? 15 : -15)) % 1440) + 1440) % 1440)
      minutes = daylight.minutes
      holding = true
    }
  }}
  onclick={(e) => {
    if (e.detail === 0) (daylight.hold(null), (minutes = daylight.minutes), (holding = false))
  }}
>
  <span class="hour">{shown}</span>
  {#if knob && minutes !== null}
    <span class="knob" class:moon={minutes < 300 || minutes >= 1260} style:left="{knob.x}px" style:top="{knob.y}px"></span>
  {/if}
</button>

<style>
  .ring {
    position: absolute;
    left: 24px;
    top: 92px;
    z-index: 1200;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    touch-action: none;
    /* the sky of the day round the ring, from midnight at the bottom: the colours of the game's tables */
    background:
      radial-gradient(circle, #15110ee6 21.5px, transparent 22px),
      conic-gradient(from 180deg, #0b1630 0 14%, #d37f57 20%, #99e3ff 35%, #bcf4ff 50%, #f6c486 70%, #ea9a5c 80%, #0b1630 86% 100%);
    box-shadow:
      0 0 0 1.5px #000,
      0 1px 4px #000;
  }
  .ring:focus-visible {
    outline: 2px solid var(--gold-pale);
    outline-offset: 2px;
  }
  .hour {
    font: 600 14px/1 var(--font);
    color: #fff;
    font-variant-numeric: tabular-nums;
  }
  .held .hour {
    color: var(--gold);
  }
  .knob {
    position: absolute;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, #fff8e0, #ffd27a 60%, #e89a3a);
    box-shadow:
      0 0 0 1.5px #000,
      0 1px 3px #000;
    pointer-events: none;
  }
  .knob.moon {
    background: radial-gradient(circle at 40% 40%, #ffffff, #cfdcf0 60%, #8fa6c8);
  }
  /* On a narrow map the zone goes under the buttons of the map (App.svelte): the ring under it. */
  @container (max-width: 640px) {
    .ring {
      top: 180px;
    }
  }
</style>
