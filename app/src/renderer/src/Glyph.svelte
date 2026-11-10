<script lang="ts">
  // One glyph of the interface, in the colour of the text around it. It says nothing to a screen
  // reader: the control it sits in carries the name.
  import { GLYPHS, type GlyphName } from './marks'

  // turn: degrees clockwise, for the direction arrow.
  let { name, size = 16, turn = 0 }: { name: GlyphName; size?: number; turn?: number } = $props()
</script>

<svg viewBox="0 0 16 16" width={size} height={size} class:filled={name === 'direction'} style:rotate="{turn}deg" aria-hidden="true">
  <path d={GLYPHS[name]} />
</svg>

<style>
  svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .filled {
    fill: currentColor;
    stroke: none;
  }
</style>
