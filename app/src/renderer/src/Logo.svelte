<script lang="ts">
  // The mark (two screens in a compass ring), alone or with the wordmark. On dark grounds it wears its
  // own materials: bronze ring, blue disc, ivory screens. With `flat` it is one colour, the text colour
  // of where it sits: for paper and for the gold plate. Never rotated or shadowed.
  let {
    size = 72, // height of the mark, in px
    word = true,
    forever = false, // the addon's name: FOREVER under TWINMAP
    stacked = false, // mark above, word below
    flat = false,
  }: { size?: number; word?: boolean; forever?: boolean; stacked?: boolean; flat?: boolean } = $props()
  const id = $props.id()
  // Proportions of the approved sheet: beside, the word is the mark over 1.8; stacked, 30 px under a 96 px mark.
  const w = $derived(stacked ? size * 0.3125 : size / 1.8)
  const gap = $derived(stacked ? size * 0.146 : size * 0.28)
  const one = 'currentColor'
  // The paints of the big drawing and of the small one: bronze, the disc, ivory, and the dark line round the pieces.
  const big = $derived(flat ? { bronze: one, ivory: one, edge: 'none' } : { bronze: `url(#${id}-br)`, ivory: `url(#${id}-iv)`, edge: '#342218' })
  const small = $derived(flat ? { point: one, ring: one, disc: 'none', back: one, front: one } : { point: '#85613f', ring: '#a9845a', disc: '#105171', back: '#eacba4', front: '#fff2dd' })
</script>

<span class="logo" class:stacked style:gap="{gap}px" role="img" aria-label={forever ? 'Twinmap Forever' : 'Twinmap'}>
  {#if size < 24}
    <!-- Redrawn for small sizes: heavier ring, north and south points only, bigger arrow, flat colours. -->
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true">
      <path fill={small.point} d="M8 0 9.5 1.7H6.5ZM8 16 9.5 14.3H6.5Z" />
      <circle cx="8" cy="8" r="6.25" fill={small.disc} stroke={small.ring} stroke-width="1.5" />
      <mask id="{id}-s"><rect width="16" height="16" fill="#fff" /><rect x="5" y="5.5" width="8" height="7" fill="#000" /></mask>
      <rect x="4.5" y="4.5" width="5.5" height="4" rx=".5" stroke={small.back} mask="url(#{id}-s)" />
      <path fill={small.front} fill-rule="evenodd" d="M5.75 6.25h6v4.75h-6ZM10.7 6.9 9.8 10.4 8.9 9.1 7.2 9.1Z" />
    </svg>
  {:else}
    <!-- A compass ring with six points: north, south and four diagonals, 48.5 degrees from north. -->
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      {#if !flat}
        <defs>
          <linearGradient id="{id}-br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfb08a" /><stop offset=".45" stop-color="#85613f" /><stop offset="1" stop-color="#583e2a" /></linearGradient>
          <radialGradient id="{id}-bl" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#2798ba" /><stop offset=".55" stop-color="#105171" /><stop offset="1" stop-color="#062235" /></radialGradient>
          <linearGradient id="{id}-iv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2dd" /><stop offset=".6" stop-color="#eacba4" /><stop offset="1" stop-color="#cfb08a" /></linearGradient>
        </defs>
      {/if}
      <g fill={big.bronze} stroke={big.edge} stroke-width=".8">
        <path d="M32 0 37.5 6.5H26.5ZM32 64 37.5 57.5H26.5Z" />
        {#each [48.5, 131.5, 228.5, 311.5] as turn (turn)}
          <path d="M32 1.3 35.9 6.5H28.1Z" transform="rotate({turn} 32 32)" />
        {/each}
      </g>
      {#if flat}
        <circle cx="32" cy="32" r="25" stroke={one} stroke-width="4" />
      {:else}
        <circle cx="32" cy="32" r="23" fill="url(#{id}-bl)" />
        <circle cx="32" cy="32" r="24.6" stroke={big.bronze} stroke-width="5" />
        <!-- Thirty-five notches round the ring. -->
        <circle cx="32" cy="32" r="24.6" stroke="#fff2dd" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="1 3.416" />
        <circle cx="32" cy="32" r="22.1" stroke={big.edge} stroke-width=".8" />
        <circle cx="32" cy="32" r="27.1" stroke={big.edge} stroke-width=".8" />
      {/if}
      <!-- Back screen: outline, cut away where the front screen passes. Front screen: solid, the arrow knocked out. -->
      <g transform="translate(13.4 13.7) scale(.58)">
        <mask id="{id}-l"><rect width="64" height="64" fill="#fff" /><rect x="18" y="22" width="46" height="37" rx="5.5" fill="#000" /></mask>
        <rect x="5" y="9" width="38" height="29" rx="3.5" stroke={big.ivory} stroke-width="3.5" mask="url(#{id}-l)" />
        <path fill={big.ivory} stroke={big.edge} stroke-width=".9" stroke-linejoin="round" paint-order="stroke" fill-rule="evenodd" d="M24.5 25h31a3.5 3.5 0 0 1 3.5 3.5v22a3.5 3.5 0 0 1-3.5 3.5h-31a3.5 3.5 0 0 1-3.5-3.5v-22a3.5 3.5 0 0 1 3.5-3.5ZM48.6 29 44.8 50 40.7 41.6 31.4 41.6Z" />
      </g>
    </svg>
  {/if}
  {#if word}
    <span class="wordmark" style:--w="{w}px" aria-hidden="true">Twinmap{#if forever}<small>Forever</small>{/if}</span>
  {/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
  }
  .stacked {
    flex-direction: column;
  }
  svg {
    flex: none;
  }
</style>
