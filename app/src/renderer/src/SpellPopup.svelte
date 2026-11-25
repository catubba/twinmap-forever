<script lang="ts">
  // The popup of the spell or talent under the pointer or reached with the keyboard (M20-F16, preview
  // design/workspaces/preview16.js): the lines of the game's own tooltip, which the addon reads in the game, as its panel
  // puts them together (Spellbook.svelte, Talents.svelte). The look of the item popup (ItemPopup.svelte).
  import { piecesOf } from '../../shared/tips'
  import { spellHover } from './item-tip.svelte'

  const shown = $derived(spellHover.now)
  // Beside what is pointed at, on the side with room, inside the window.
  let width = $state(0), height = $state(0)
  const place = $derived.by(() => {
    if (!shown) return { left: 0, top: 0 }
    const b = shown.box, gap = 10
    const left = b.right + gap + width <= innerWidth ? b.right + gap : Math.max(4, b.left - gap - width)
    const top = Math.max(4, Math.min(b.top, innerHeight - height - 4))
    return { left, top }
  })
</script>

{#snippet text(line: string, color: string)}
  {#each piecesOf(line, color) as p, i (i)}<span style:color={p.color ? `#${p.color}` : undefined}>{p.text}</span>{/each}
{/snippet}

{#if shown?.lines.length}
  <div class="tip" role="tooltip" style:left="{place.left}px" style:top="{place.top}px" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#each shown.lines as l, i (i)}
      {#if !l[0]}
        <div class="gap"></div>
      {:else}
        <div class="tl" class:name={i === 0}>
          <span>{@render text(l[0], l[1])}</span>
          {#if l.length === 4}<span>{@render text(l[2], l[3])}</span>{/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    z-index: 5000;
    width: max-content;
    max-width: 320px;
    padding: 9px 11px 10px;
    border: 1px solid #9aa3b5;
    border-radius: 4px;
    background: rgb(8 9 22 / 0.96);
    box-shadow: 0 0 0 1px #000, 0 6px 18px #000a;
    font: 400 14px/18px var(--font);
    color: #fff;
    pointer-events: none;
  }
  .tl {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    white-space: pre-line;
  }
  .tl.name {
    font: 500 16px/20px var(--font);
  }
  .gap {
    height: 9px;
  }
</style>
