<script lang="ts">
  // The mark (two screens in a compass ring), alone or with the wordmark. One colour, the text colour of where it sits:
  // gold on dark, plate-ink on light and on the gold plate. Never rotated, shadowed or in two colours.
  let {
    size = 72, // height of the mark, in px
    word = true,
    forever = false, // the addon's name: FOREVER under TWINMAP
    stacked = false, // mark above, word below
  }: { size?: number; word?: boolean; forever?: boolean; stacked?: boolean } = $props()
  const id = $props.id()
  // Proportions of the approved sheet: beside, the word is the mark over 1.8; stacked, 30 px under a 96 px mark.
  const w = $derived(stacked ? size * 0.3125 : size / 1.8)
  const gap = $derived(stacked ? size * 0.146 : size * 0.28)
</script>

<span class="logo" class:stacked style:gap="{gap}px" role="img" aria-label={forever ? 'Twinmap Forever' : 'Twinmap'}>
  {#if size < 24}
    <!-- Redrawn for small sizes: heavier ring, north and south points only, bigger arrow. -->
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
      <path fill="currentColor" d="M8 0 9.5 1.7H6.5ZM8 16 9.5 14.3H6.5Z" />
      <mask id="{id}-s"><rect width="16" height="16" fill="#fff" /><rect x="5" y="5.5" width="8" height="7" fill="#000" /></mask>
      <rect x="4.5" y="4.5" width="5.5" height="4" rx=".5" stroke="currentColor" mask="url(#{id}-s)" />
      <path fill="currentColor" fill-rule="evenodd" d="M5.75 6.25h6v4.75h-6ZM10.7 6.9 9.8 10.4 8.9 9.1 7.2 9.1Z" />
    </svg>
  {:else}
    <!-- A compass ring with six points: north, south and four diagonals, 48.5 degrees from north. -->
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="25" stroke="currentColor" stroke-width="4" />
      <path fill="currentColor" d="M32 0 37.5 6.5H26.5ZM32 64 37.5 57.5H26.5Z" />
      {#each [48.5, 131.5, 228.5, 311.5] as turn (turn)}
        <path fill="currentColor" d="M32 1.3 35.9 6.5H28.1Z" transform="rotate({turn} 32 32)" />
      {/each}
      <!-- Back screen: outline, cut away where the front screen passes. Front screen: solid, the arrow knocked out. -->
      <g transform="translate(13.4 13.7) scale(.58)">
        <mask id="{id}-l"><rect width="64" height="64" fill="#fff" /><rect x="18" y="22" width="46" height="37" rx="5.5" fill="#000" /></mask>
        <rect x="5" y="9" width="38" height="29" rx="3.5" stroke="currentColor" stroke-width="3.5" mask="url(#{id}-l)" />
        <path fill="currentColor" fill-rule="evenodd" d="M24.5 25h31a3.5 3.5 0 0 1 3.5 3.5v22a3.5 3.5 0 0 1-3.5 3.5h-31a3.5 3.5 0 0 1-3.5-3.5v-22a3.5 3.5 0 0 1 3.5-3.5ZM48.6 29 44.8 50 40.7 41.6 31.4 41.6Z" />
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
