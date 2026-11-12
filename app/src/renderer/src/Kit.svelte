<script lang="ts">
  // Trial page: every basic control in every state, side by side. Opened with TWINMAP_KIT=1, never from the app's own screens.
  import { onMount } from 'svelte'
  import { unitsOfRect } from '../../shared/geo'
  import type { GameMap } from '../../shared/maps'
  import { WORLDS } from '../../shared/world'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'
  import { GLYPHS, pin, PIN_NAMES, pinSize, type GlyphName } from './marks'

  // Three grounds to read the pins on: grass, sand, snow. In the app each is a tile of the game's
  // own map, at its true size; in a browser, where there are no tiles, a flat colour stands in.
  let grounds = $state([
    { zone: 'Elwynn Forest', color: '#4f6b2c', tile: '' },
    { zone: 'Tanaris', color: '#b59a5b', tile: '' },
    { zone: 'Dun Morogh', color: '#dfe6ea', tile: '' },
  ])
  onMount(() => {
    let tries = 0
    const look = (): void => {
      fetch('twinmap://tiles/maps.json')
        .then((answer) => answer.json() as Promise<GameMap[]>)
        .then((maps) => {
          grounds = grounds.map((g) => {
            const m = maps.find((z) => z.name === g.zone && z.rect && z.continent !== null)
            if (!m) return g
            const [a, b] = unitsOfRect(m.rect!), world = WORLDS.find((w) => w.continent === m.continent)!.name
            // Zoom 5: a tile is 8 units of the map wide.
            return { ...g, tile: `twinmap://tiles/${world}/5/${Math.floor((a.x + b.x) / 16)}/${Math.floor((a.y + b.y) / 16)}.png` }
          })
        })
        .catch(() => void (++tries < 8 && setTimeout(look, 1000))) // the tiles are not ready in the first moments
    }
    look()
  })
  const STONE = ['stone-950', 'stone-900', 'stone-800', 'stone-700', 'stone-600', 'stone-500']
  const BRONZE = ['bronze-900', 'bronze-700', 'bronze-600', 'bronze-500', 'bronze-400', 'bronze-300']
  const GOLD = ['gold', 'gold-pale', 'plate-top', 'plate-mid', 'plate-low', 'plate-ink']
  const MEANING = ['quest', 'objective', 'service', 'resource', 'done', 'xp-top', 'rested', 'route']
  const TYPE = [
    ['small', 'Stonesplinter Trogg 6/10'],
    ['body', 'Innkeeper Hearthstove, 32 yd'],
    ['label', 'Send to game'],
    ['title', 'Quests here'],
    ['nav', 'Character'],
    ['name', 'Stonesplinter Valley'],
    ['zone', 'Loch Modan'],
    ['sign', '1:05'],
  ]
  let follow = $state(true)

</script>

{#snippet arrow(turn: number)}
  <Glyph name="direction" size={12} {turn} />
{/snippet}

{#snippet swatches(names: string[])}
  <div class="swatches">
    {#each names as name (name)}
      <span><i style:background="var(--{name})"></i>{name}</span>
    {/each}
  </div>
{/snippet}

<main class="surface">
  <h1>Twinmap: basic controls</h1>

  <h2 class="band">Map pins</h2>
  <div class="lands">
    {#each grounds as ground (ground.zone)}
      <figure style:background-color={ground.color} style:background-image={ground.tile ? `url(${ground.tile})` : 'none'}>
        {#each PIN_NAMES as name (name)}<span style:color="#c79c6e">{@html pin(name)}</span>{/each}
        <figcaption>{ground.zone}</figcaption>
      </figure>
    {/each}
  </div>
  <ul class="legend">
    {#each PIN_NAMES as name (name)}
      <li><span style:color="#c79c6e">{@html pin(name)}</span>{name}, {pinSize(name)} px</li>
    {/each}
  </ul>

  <h2 class="band">Glyphs</h2>
  <section class="states">
    {#each Object.keys(GLYPHS) as GlyphName[] as name (name)}
      <span><Glyph {name} />{name}</span>
    {/each}
    <span><button class="btn" aria-label="Zoom in"><Glyph name="plus" /></button>in a button</span>
    <span class="dim"><Glyph name="search" />dim</span>
  </section>

  <h2 class="band">Logo and wordmark</h2>
  <div class="grounds">
    <div class="dark"><Logo /></div>
    <div class="paper"><Logo flat /></div>
    <div class="plate"><Logo flat /></div>
    <div class="stone"><Logo forever /></div>
    <div class="dark"><Logo stacked size={96} /></div>
    <div class="dark sizes">
      {#each [64, 48, 32, 24, 16] as size (size)}
        <span><Logo {size} word={false} />{size}</span>
      {/each}
    </div>
  </div>

  <h2 class="band">Colours</h2>
  <section>
    {@render swatches(STONE)}
    {@render swatches(BRONZE)}
    {@render swatches(GOLD)}
    {@render swatches(MEANING)}
  </section>

  <h2 class="band">Type</h2>
  <section>
    {#each TYPE as [name, sample] (name)}
      <p class="type"><span>{name}</span><span style:font="var(--t-{name})">{sample}</span></p>
    {/each}
    <p class="type"><span>text</span><span>Text</span><span class="dim">Dim text</span><span class="off">Off, disabled only</span></p>
  </section>

  <h2 class="band">Button</h2>
  <section class="states">
    <span><button class="btn">Skip</button>rest</span>
    <span><button class="btn is-hover">Skip</button>hover</span>
    <span><button class="btn is-pressed">Skip</button>pressed</span>
    <span><button class="btn is-focus">Skip</button>focus</span>
    <span><button class="btn" aria-pressed={follow} onclick={() => (follow = !follow)}>Follow</button>on (click)</span>
    <span><button class="btn" disabled>Send to game</button>disabled</span>
    <span><button class="btn" aria-busy="true">Sending</button>waiting</span>
    <span><button class="btn">Sent</button>done, 2 s</span>
  </section>

  <h2 class="band">Title band <span class="count">3</span></h2>
  <section>
    <p class="dim">The band above, with a count on the right. Below, one without.</p>
  </section>
  <h2 class="band">Nearby</h2>

  <div class="rows">
    <button class="row"><span>Innkeeper Hearthstove</span><span class="t-service">Inn</span><span class="num">32 yd</span>{@render arrow(0)}</button>
    <button class="row is-hover"><span>Mountaineer Kadrell, hover</span><span class="t-quest">Quest</span><span class="num">96 yd</span>{@render arrow(45)}</button>
    <button class="row" aria-current="true"><span>Thorgrum Borrelson, chosen</span><span class="t-service">Flight</span><span class="num">118 yd</span>{@render arrow(90)}</button>
    <button class="row is-focus"><span>Vidra Hearthstove, focus</span><span class="t-service">Vendor</span><span class="num">150 yd</span>{@render arrow(45)}</button>
    <button class="row"><span>Copper Vein</span><span class="t-resource">Ore</span><span class="num">1,210 yd</span>{@render arrow(180)}</button>
    <button class="row"><span>A very long name that does not fit in the cell it has been given</span><span class="t-service">Repair</span><span class="num">240 yd</span>{@render arrow(225)}</button>
    <button class="row done"><span>The Trogg Threat, done</span><span></span><span class="num">140 yd</span>{@render arrow(45)}</button>
    <div class="row small"><span>Stonesplinter Trogg</span><span></span><span class="num">6/10</span></div>
    <div class="row small done"><span>Stonesplinter Scout</span><span></span><span class="num">10/10</span></div>
  </div>

  <h2 class="band">Text field</h2>
  <section class="states">
    <span><input class="field" placeholder="Search NPCs, items, quests, zones" aria-label="Search, empty" />empty</span>
    <span><input class="field" value="Kadrell" aria-label="Search, filled" />filled</span>
    <span><input class="field is-focus" value="Thelsamar" aria-label="Search, focus" />focus</span>
    <span><input class="field" disabled value="Not available" aria-label="Search, disabled" />disabled</span>
    <span class="tall">
      <input class="field" aria-invalid="true" aria-describedby="kit-error" value="D:\Games" aria-label="Game folder" />
      <p class="field-note" id="kit-error">No game in this folder. Pick the one that holds _forever_.</p>
      error
    </span>
  </section>

  <h2 class="band">Checkbox</h2>
  <section class="states">
    <label class="choice"><input type="checkbox" class="check" />Off</label>
    <label class="choice"><input type="checkbox" class="check" checked />On</label>
    <label class="choice"><input type="checkbox" class="check is-hover" />Hover</label>
    <label class="choice"><input type="checkbox" class="check is-focus" checked />Focus</label>
    <label class="choice"><input type="checkbox" class="check" disabled />Disabled</label>
    <label class="choice"><input type="checkbox" class="check" disabled checked />Disabled, on</label>
  </section>

  <h2 class="band">Menu</h2>
  <section class="states top">
    <div class="menu">
      <div class="group">Quests</div>
      <label class="item"><input type="checkbox" class="check" checked />Available</label>
      <label class="item is-hover"><input type="checkbox" class="check" checked />Turn in, hover</label>
      <label class="item"><input type="checkbox" class="check" />Objectives</label>
      <div class="group">Services</div>
      <label class="item"><input type="checkbox" class="check" checked />Flight</label>
      <label class="item"><input type="checkbox" class="check" disabled />Auction, disabled</label>
    </div>
    <ul class="menu">
      <li><button class="item">Mountaineer Kadrell<span class="num">NPC</span></button></li>
      <li><button class="item is-hover">Kadrell's Sword, hover<span class="num">Item</span></button></li>
      <li><button class="item is-focus">Rat Catching, focus<span class="num">Quest</span></button></li>
      <li><button class="item">Loch Modan<span class="num">Zone</span></button></li>
    </ul>
  </section>

  <h2 class="band">Bars</h2>
  <section class="bars">
    <span>Experience, 62%</span>
    <div class="xp" role="progressbar" aria-label="Experience" aria-valuenow="62" style:--v="62%"></div>
    <span>Experience, 35% and rested</span>
    <div class="xp" role="progressbar" aria-label="Experience with rest" aria-valuenow="35" style:--v="35%" style:--rest="30%"></div>
    <span>Experience, empty</span>
    <div class="xp" role="progressbar" aria-label="Experience, empty" aria-valuenow="0"></div>
    <span>Experience, full</span>
    <div class="xp" role="progressbar" aria-label="Experience, full" aria-valuenow="100" style:--v="100%"></div>
    <span>Mining, 75 of 150</span>
    <progress class="bar" value="75" max="150" aria-label="Mining"></progress>
    <span>Empty</span>
    <progress class="bar" value="0" max="150" aria-label="Empty"></progress>
    <span>Full</span>
    <progress class="bar" value="150" max="150" aria-label="Full"></progress>
  </section>
</main>

<style>
  main {
    max-width: 860px;
    min-height: 100%;
    margin: 0 auto;
    padding-bottom: 48px;
  }
  h1 {
    margin: 0;
    padding: 20px 16px 16px;
    font: var(--t-zone);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  section {
    padding: 12px 16px 24px;
  }
  .rows {
    width: 340px;
    padding: 12px 0 24px;
  }
  .dim {
    margin: 0;
    color: var(--text-dim);
  }
  .off {
    color: var(--text-off);
  }

  .grounds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 12px 16px 24px;
  }
  .grounds > div {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 150px;
    padding: 20px;
  }
  .dark {
    background: var(--stone-950);
    color: var(--gold);
  }
  .stone {
    background: linear-gradient(var(--stone-600), #1b140e);
    color: var(--gold);
  }
  .paper {
    background: #efe9dc;
    color: var(--plate-ink);
  }
  .plate {
    background: linear-gradient(var(--plate-top), var(--plate-mid));
    color: var(--plate-ink);
  }
  .grounds .sizes {
    align-items: flex-end;
    gap: 18px;
  }
  .sizes span {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font: var(--t-small);
  }

  .lands {
    display: flex;
    gap: 12px;
    padding: 12px 16px;
  }
  .lands figure {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    align-items: center;
    gap: 22px 26px;
    width: 256px;
    height: 256px;
    margin: 0;
    padding: 34px;
  }
  .lands span,
  .legend span {
    display: grid;
    place-content: center;
  }
  .lands figcaption {
    position: absolute;
    left: 8px;
    bottom: 6px;
    font: var(--t-small);
    color: #fff;
    text-shadow:
      0 1px 3px #000,
      0 0 2px #000;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin: 0;
    padding: 0 16px 24px;
    list-style: none;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend span {
    width: 28px;
    height: 28px;
  }

  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    margin-bottom: 12px;
  }
  .swatches span {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 120px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .swatches i {
    width: 24px;
    height: 24px;
    border: 1px solid #000;
  }

  .type {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin: 0 0 8px;
  }
  .type > :first-child {
    width: 56px;
    font: var(--t-small);
    color: var(--text-dim);
  }

  .states {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 24px;
  }
  .states.top {
    align-items: flex-start;
  }
  .states > span {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .states > .tall {
    gap: 0;
  }
  .tall .field-note {
    margin-bottom: 6px;
  }

  .bars {
    display: grid;
    grid-template-columns: 200px 308px;
    align-items: center;
    gap: 12px 16px;
  }
</style>
