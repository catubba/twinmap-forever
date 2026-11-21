<script lang="ts">
  // The popup of the item under the pointer (M10-F15, mockup design/vendors/mockup/popups.html): the
  // lines of the game's own tooltip where the addon sent them, what the game's files say otherwise,
  // and under a line what the app adds: who holds it, who sells it and where (the nearest first), who drops it.
  import { keyOfLink, lowestOf, type Listing } from '../../shared/ah'
  import { firstName, type Known } from '../../shared/characters'
  import { coins, QUALITY_COLORS, typeOf, type ItemFacts } from '../../shared/items'
  import type { Position } from '../../shared/game'
  import { unitsOfPlace } from '../../shared/geo'
  import type { GameMap } from '../../shared/maps'
  import { whereIs } from '../../shared/now'
  import { serves } from '../../shared/services'
  import type { Sheets } from '../../shared/sheet'
  import { holdersOf, piecesOf, shownLines, tipKey, type ItemSources } from '../../shared/tips'
  import { hover, kept } from './item-tip.svelte'
  import { TILES } from './web'

  // listing: the prices of the auction house on show (M18-F8): under the vendor's price, what one of its kind costs there.
  let { sheets, known, side, pos, listing = null }: { sheets: Sheets; known: Known[]; side?: string; pos?: Position; listing?: Listing | null } = $props()

  // What the game says of every item, and the names of the zones: read once, when an item is first shown.
  let facts = $state.raw<ItemFacts>({})
  let zones = $state.raw<Map<number, GameMap>>(new Map())
  let maps = $state.raw<GameMap[]>([])
  let read = false
  $effect(() => {
    if (!hover.now || read) return
    read = true
    void fetch(`${TILES}/items.json`).then((r) => (r.ok ? r.json() : {})).then((f: ItemFacts) => (facts = f)).catch(() => {})
    void fetch(`${TILES}/maps.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: GameMap[]) => ((maps = list), (zones = new Map(list.filter((m) => m.level === 'zone' && m.area).map((m) => [m.area, m])))))
      .catch(() => {})
  })
  // Who sells and drops each item, asked once.
  const asked = new Map<number, ItemSources>()
  let sources = $state.raw<ItemSources | null>(null)
  $effect(() => {
    const item = hover.now?.item
    sources = item ? (asked.get(item) ?? null) : null
    if (!item || asked.has(item)) return
    void window.twinmap.itemSources(item).then((s) => {
      asked.set(item, s)
      if (hover.now?.item === item) sources = s
    })
  })

  const shown = $derived(hover.now)
  const fact = $derived(shown ? facts[shown.item] : undefined)
  const lines = $derived(shown ? kept.tips[tipKey(shown.item, shown.key)] : undefined)
  const holders = $derived(shown ? holdersOf(sheets, shown.item) : [])
  // The vendors of the character's side, the nearest first where it is on a map; the others after, as QuestieDB lists them.
  const here = $derived(whereIs(maps, pos))
  const far = (s: { area: number; x: number; y: number }): number => {
    const zone = zones.get(s.area)
    if (!here || !zone?.rect || zone.continent !== here.continent) return Infinity
    const at = unitsOfPlace(zone.rect, s.x, s.y)
    return Math.hypot(at.x - here.at.x, at.y - here.at.y)
  }
  const sellers = $derived((sources?.sold ?? []).filter((s) => serves(s, side)).map((s) => ({ ...s, far: far(s) })).sort((a, b) => a.far - b.far))
  const sold = $derived(sellers.slice(0, 2))
  const where = (area: number): string => zones.get(area)?.name ?? ''
  const colorOf = (key: string): string | undefined => known.find((k) => k.key === key)?.color
  const held = (h: { bags: number; bank: number; worn: number }): string =>
    [h.worn && 'wears it', h.bags && `${h.bags} in the bags`, h.bank && `${h.bank} in the bank`].filter(Boolean).join(', ')

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

<!-- A line of the game in its colours: some carry colours inside ("Made by"). -->
{#snippet text(line: string, color: string)}
  {#each piecesOf(line, color) as p, i (i)}<span style:color={p.color ? `#${p.color}` : undefined}>{p.text}</span>{/each}
{/snippet}

{#snippet money(copper: number)}
  {#each coins(copper) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{/each}
{/snippet}

{#if shown && (lines || fact)}
  <div class="tip" role="tooltip" style:left="{place.left}px" style:top="{place.top}px" bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if lines}
      {#each shownLines(lines, shown.wear) as l, i (i)}
        <div class="tl" class:name={i === 0}>
          <span>{@render text(l[0], l[1])}</span>
          {#if l.length === 4}<span>{@render text(l[2], l[3])}</span>{/if}
        </div>
      {/each}
    {:else if fact}
      <div class="tl name"><span style:color={QUALITY_COLORS[fact[1]] ?? undefined}>{fact[0]}</span></div>
      <div class="tl"><span>{typeOf(fact[3], fact[4])}</span></div>
    {/if}
    {#if fact && fact[2] > 0}<div class="tl"><span>Sell Price: {@render money(fact[2] * (shown.n ?? 1))}</span></div>{/if}
    {#if listing}
      {@const ah = lowestOf(listing, keyOfLink(shown.item, shown.key))}
      {@const n = shown.n ?? 1}
      <div class="tl ah"><span>Auction House: {#if ah}{@render money(ah * n)}{#if n > 1}&nbsp;({@render money(ah)} each){/if}{:else}not on sale{/if}</span></div>
    {/if}
    {#if holders.length || sold.length || sources?.drops.length || sources?.found.length}
      <div class="ours">
        {#each holders as h (h.key)}
          <div><span class="who" style:color={colorOf(h.key)}>{firstName(h.key)}</span> {held(h)}</div>
        {/each}
        {#if !holders.length && fact}<div>None of your characters has it</div>{/if}
        {#each sold as s (s.npc)}
          <div>Sold by <span class="npc">{s.name}</span>{where(s.area) && `, ${where(s.area)}`}{#if fact && fact[5] > 0}{' · '}{@render money(fact[5])}{#if fact[6] > 1}&nbsp;for {fact[6]}{/if}{/if}</div>
        {/each}
        {#if sellers.length > sold.length}<div class="more">and {sellers.length - sold.length} more vendors</div>{/if}
        {#each (sources?.drops ?? []).slice(0, 2) as d, i (i)}
          <div>Drops from {d.name}{where(d.area) && `, ${where(d.area)}`}</div>
        {/each}
        {#if (sources?.drops.length ?? 0) > 2}<div class="more">and {(sources?.drops.length ?? 0) - 2} more</div>{/if}
        {#if !sold.length && !sources?.drops.length}
          {#each (sources?.found ?? []).slice(0, 2) as f, i (i)}<div>Found in {f.name}{where(f.area) && `, ${where(f.area)}`}</div>{/each}
        {/if}
      </div>
    {/if}
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
    margin: 0;
    padding: 0;
    white-space: normal;
  }
  .tl.name {
    font: 500 16px/20px var(--font);
  }
  .ours {
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid #9aa3b555;
    font: 400 13.5px/18px var(--font);
    color: #cfc6b6;
  }
  .ours .npc {
    color: var(--service);
  }
  .ours .more {
    color: var(--text-dim);
  }
  .tip .coin {
    margin-right: 3px;
  }
  /* What the auction house asks, under what a vendor gives: the game's own line is the one above. */
  .tl.ah {
    color: var(--text-dim);
  }
</style>
