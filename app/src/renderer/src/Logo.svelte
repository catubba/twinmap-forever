<script lang="ts">
  // The Two screens mark, alone or with the wordmark. One colour, the text colour of where it sits:
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
    <!-- Redrawn for small sizes: heavier outline, bigger arrow, edges on whole pixels. -->
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden="true">
      <mask id="{id}-s"><rect width="16" height="16" fill="#fff" /><rect x="4" y="5" width="12" height="11" fill="#000" /></mask>
      <rect x="1.75" y="2.75" width="9.5" height="7.5" rx="1" stroke="currentColor" stroke-width="1.5" mask="url(#{id}-s)" />
      <path fill="currentColor" fill-rule="evenodd" d="M6 6h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM12.6 7.2 11.5 12.9 10.3 10.5 7.6 10.5Z" />
    </svg>
  {:else}
    <!-- Back screen: outline, cut away where the front screen passes. Front screen: solid, the arrow knocked out. -->
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" aria-hidden="true">
      <mask id="{id}-l"><rect width="64" height="64" fill="#fff" /><rect x="18" y="22" width="46" height="37" rx="5.5" fill="#000" /></mask>
      <rect x="5" y="9" width="38" height="29" rx="3.5" stroke="currentColor" stroke-width="3" mask="url(#{id}-l)" />
      <path fill="currentColor" fill-rule="evenodd" d="M24.5 25h31a3.5 3.5 0 0 1 3.5 3.5v22a3.5 3.5 0 0 1-3.5 3.5h-31a3.5 3.5 0 0 1-3.5-3.5v-22a3.5 3.5 0 0 1 3.5-3.5ZM48.6 29 44.8 50 40.7 41.600 31.4 41.6Z" />
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
