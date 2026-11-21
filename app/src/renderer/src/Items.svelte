<script lang="ts">
  // Items: bags, bank, keyring and what is worn by the character shown, as wide as the window, from
  // the sheet the app keeps (shared/items.ts). It reads the same with the game closed, and says how
  // old it is. What is typed in the filter is looked for in every other character's sheet too.
  // Two views (M10-F14, mockup design/vendors/mockup/items2.html): Slots, what is worn as the game's
  // character window lays it and the bags and the bank as grids; Table, a row for each item.
  import { ago, type Known } from '../../shared/characters'
  import { coins, filterRows, gridsOf, itemMatches, itemRows, othersHolding, PLACES, QUALITY_COLORS, QUALITY_TEXT, sortRows, wornOf, WORN_LEFT, WORN_RIGHT, WORN_WEAPONS, type Cell, type Column, type Grid, type ItemFacts, type ItemRow, type Place } from '../../shared/items'
  import type { PortraitsTold } from '../../shared/portrait'
  import type { Sheets } from '../../shared/sheet'
  import { statsOf } from '../../shared/stats'
  import { lowestOf, type Listing } from '../../shared/ah'
  import { itemTip } from './item-tip.svelte'
  import { columns } from './columns'
  import { inApp, TILES } from './web'

  // listing: the prices of the auction house on show (M18-F8), for what each item fetches there; null without them.
  let { sheets, portraits, shown, known, now, listing = null, onpick }: { sheets: Sheets; portraits: PortraitsTold; shown: Known | null; known: Known[]; now: number; listing?: Listing | null; onpick: (key: string) => void } = $props()

  // What the game says of each item, made beside the map (tiles-worker.ts). Without it the items have their numbers and no prices.
  let facts = $state.raw<ItemFacts>({})
  $effect(() => {
    void fetch(`${TILES}/items.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((read: ItemFacts) => (facts = read))
      .catch(() => {})
  })

  let typed = $state('')
  let view = $state<'slots' | 'table'>(localStorage.getItem('itemsView') === 'table' ? 'table' : 'slots')
  $effect(() => localStorage.setItem('itemsView', view))
  let place = $state<Place | null>(null)
  let column = $state<Column>('value')
  let up = $state(false)
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const lowest = $derived((key: string) => lowestOf(listing, key))
  const all = $derived(sheet ? itemRows(sheet, facts, lowest) : [])
  const rows = $derived(sortRows(filterRows(all, typed).filter((r) => !place || r.place === place), column, up))
  const others = $derived(shown ? othersHolding(sheets, shown.key, facts, typed, lowest).flatMap((o) => o.rows.map((r) => ({ ...r, who: known.find((k) => k.key === o.key) }))) : [])
  const othersSorted = $derived(sortRows(others, column, up) as typeof others)
  const worn = $derived(sheet ? wornOf(sheet) : new Map())
  const grids = $derived(sheet ? gridsOf(sheet) : null)
  const worth = $derived(all.reduce((n, r) => n + r.value, 0))
  const auction = $derived(all.reduce((n, r) => n + r.auction, 0))
  const money = $derived(typeof sheet?.pieces.money === 'number' ? sheet.pieces.money : null)
  const places = $derived(PLACES.map((p) => ({ p, n: all.filter((r) => r.place === p).length })).filter(({ p, n }) => n > 0 || p !== 'Keyring'))

  const COLUMNS = $derived<[Column, string][]>([['name', 'Item'], ['type', 'Type'], ['place', 'Where'], ['n', 'Qty'], ['value', 'Value'], ...(listing ? [['auction', 'At the AH'] as [Column, string]] : [])])
  // A click sorts by the column; another click turns it round. Names and types start from A, numbers from the most.
  function sortBy(c: Column): void {
    if (c === column) up = !up
    else ((column = c), (up = c === 'name' || c === 'type' || c === 'place'))
  }
  // The character's picture, taken off the game's character window (shared/portrait.ts): the address changes with each new one.
  const portrait = $derived(shown ? portraits.taken[shown.key] : undefined)
  const portraitUrl = $derived(shown && portrait ? `${TILES}/portraits/${encodeURIComponent(shown.key)}.png?${portrait.at}` : null)
  // The statistics of the game's character window, as the addon read them last.
  const stats = $derived(statsOf(sheet?.pieces.stats))
  const when = $derived.by(() => {
    if (!sheet || !shown) return ''
    const bags = shown.live ? 'Bags as they are now' : `Bags as of ${ago(shown.seen, now)}`
    const bank = sheet.at.bank ? `bank ${ago(sheet.at.bank, now)}, when it was last open` : 'bank not seen yet: open it in game once'
    return `${bags} · ${bank[0]!.toUpperCase()}${bank.slice(1)}`
  })
</script>

{#snippet money_(copper: number)}
  {#each coins(copper) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{:else}<span class="none">-</span>{/each}
{/snippet}

{#snippet item(r: ItemRow)}
  <span class="it">
    <span class="ico"><img src="{TILES}/items/{r.id}.png" alt="" onerror={(e) => e.currentTarget.remove()} /></span>
    <span class="nm" style:color={QUALITY_TEXT[r.quality] ?? 'var(--text)'}>{r.name}</span>
  </span>
{/snippet}

<!-- A slot: an item with its picture, the edge in its quality's colour, how many, and its wear; or a free one, with the word of what goes there. -->
{#snippet cell(c: Cell, label = '', wear?: { now?: number; most?: number })}
  {#if c}
    {@const q = facts[c.item]?.[1] ?? 1}
    {@const name = facts[c.item]?.[0] ?? `Item ${c.item}`}
    {@const left = wear?.most ? (wear.now ?? 0) / wear.most : 1}
    <span class="cell" use:itemTip={{ item: c.item, key: c.key, n: c.n, wear }} class:off={!itemMatches(c.item, facts, typed)} style:--q={q > 1 ? (QUALITY_COLORS[q] ?? null) : null}>
      <img src="{TILES}/items/{c.item}.png" alt={name} onerror={(e) => e.currentTarget.remove()} />
      {#if c.n > 1}<span class="n">{c.n}</span>{/if}
      {#if left < 0.5}<span class="wear" class:broken={left === 0} style:width="{Math.max(3, 36 * left)}px"></span>{/if}
    </span>
  {:else}
    <span class="cell free" class:off={!!typed.trim() && !label}>{#if label}<span class="slot">{label}</span>{/if}</span>
  {/if}
{/snippet}

{#snippet wornSlot([slot, label]: [number, string])}
  {@const w = worn.get(slot)}
  {@render cell(w ? { item: w.item, n: 1, key: w.key } : null, label, w)}
{/snippet}

{#snippet grid(name: string, g: Grid)}
  <div class="box">
    <h3>{name}<small>{g.used ? `${g.used} of ${g.slots} used` : `empty · ${g.slots} slots`}</small></h3>
    {#if g.used}<div class="grid">{#each g.cells as c, i (i)}{@render cell(c)}{/each}</div>{/if}
  </div>
{/snippet}

{#snippet heads(columns: [Column | null, string][])}
  <thead>
    <tr>
      {#each columns as [c, label] (label)}
        <th class:num={c === 'n' || c === 'value' || c === 'auction'} class:on={c === column} aria-sort={c === column ? (up ? 'ascending' : 'descending') : undefined}>
          {#if c}
            <button onclick={() => sortBy(c)}>{label}{#if c === column}<svg viewBox="0 0 10 10" aria-hidden="true"><path d={up ? 'M1 7h8L5 2z' : 'M1 3h8L5 8z'} /></svg>{/if}</button>
          {:else}{label}{/if}
        </th>
      {/each}
    </tr>
  </thead>
{/snippet}

<main class="surface">
  {#if !shown || !sheet}
    <p class="empty">No character yet. Play one with the Twinmap Forever addon on and its bags show here, also when the game is closed.</p>
  {:else}
    <div class="tools">
      <input type="search" placeholder="Filter by name or type" aria-label="Filter items" bind:value={typed} />
      <div class="views" role="group" aria-label="View">
        <button aria-pressed={view === 'slots'} onclick={() => (view = 'slots')}>Slots</button>
        <button aria-pressed={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
      {#if view === 'table'}
        <div class="chips" role="group" aria-label="Where">
          <button class="chip" aria-pressed={!place} onclick={() => (place = null)}>All <b>{all.length}</b></button>
          {#each places as { p, n } (p)}
            <button class="chip" aria-pressed={place === p} onclick={() => (place = place === p ? null : p)}>{p} <b>{n}</b></button>
          {/each}
        </div>
      {/if}
      <p class="sum">Worth {@render money_(worth)} at a vendor{#if listing}{' · '}{@render money_(auction)} at the auction house{/if}{#if money !== null}{' · '}Money {@render money_(money)}{/if}</p>
    </div>
    {#if view === 'slots' && grids}
      <div class="page">
        <section class="doll" aria-label="Worn">
          <header><span class="who" style:color={shown.color}>{shown.key}</span><span class="line">{shown.line}</span></header>
          <div class="body">
            <div class="col">{#each WORN_LEFT as s (s[0])}{@render wornSlot(s)}{/each}</div>
            <div>
              <div class="picture" style:background-image={portraitUrl ? `url("${portraitUrl}")` : null}>
                {#if portraits.retake === shown.key}
                  <div class="wait">
                    <p>Open the character window in game<br /><kbd>C</kbd> unless you changed the key</p>
                    <small>The picture is taken as soon as it is open and nothing covers the character.</small>
                    <span><button class="pbtn" onclick={() => void window.twinmap.retakePortrait(null)}>Cancel</button></span>
                  </div>
                {:else if portrait && portraitUrl}
                  <div class="under">
                    <span class="when">Taken {ago(portrait.at, now)}</span>
                    {#if inApp}
                      <button class="pbtn" onclick={() => void window.twinmap.savePortrait(shown.key)}>Save…</button>
                    {:else}
                      <a class="pbtn" href={portraitUrl} download="{shown.key}.png">Save…</a>
                    {/if}
                    {#if shown.live}<button class="pbtn" onclick={() => void window.twinmap.retakePortrait(shown.key)}>Retake</button>{/if}
                  </div>
                {:else}
                  <span>No picture of {shown.key.split(' ')[0]} yet</span>
                  <small>Open the character window in game and it is taken by itself.</small>
                {/if}
              </div>
              <div class="weapons">{#each WORN_WEAPONS as s (s[0])}{@render wornSlot(s)}{/each}</div>
            </div>
            <div class="col">{#each WORN_RIGHT as s (s[0])}{@render wornSlot(s)}{/each}</div>
          </div>
          {#if stats.length}
            <div class="stats">
              {#each stats as group (group.name)}
                <h4>{group.name}</h4>
                {#each group.lines as line (line.label)}
                  <div>{line.label} <b style:color={line.color}>{line.value}</b></div>
                {/each}
                {#if group.lines.length % 2}<div></div>{/if}
              {/each}
            </div>
          {/if}
        </section>
        <section class="held" aria-label="Bags and bank">
          <h2>Bags<span>{shown.live ? 'as they are now' : `as of ${ago(shown.seen, now)}`}</span></h2>
          {@render grid('Backpack and bags', grids.bags)}
          {#if grids.reagents.slots}{@render grid('Reagent bag', grids.reagents)}{/if}
          {#if grids.keyring.slots}{@render grid('Keyring', grids.keyring)}{/if}
          <h2>Bank<span>{sheet.at.bank ? `seen ${ago(sheet.at.bank, now)}` : 'not seen yet: open it in game once'}</span></h2>
          {#if grids.bank.slots}{@render grid('Bank and its bags', grids.bank)}{/if}
        </section>
      </div>
    {:else}
    <table use:columns={'items-table'}>
      {@render heads(COLUMNS)}
      <tbody>
        {#each rows as r (r.place + r.id)}
          <tr use:itemTip={{ item: r.id, n: r.n }}><td>{@render item(r)}</td><td class="dim">{r.type}</td><td>{r.place}</td><td class="num">{r.n}</td><td class="num">{@render money_(r.value)}</td>{#if listing}<td class="num">{@render money_(r.auction)}</td>{/if}</tr>
        {:else}
          <tr><td colspan={COLUMNS.length} class="none">{typed ? `${shown.key} has nothing like "${typed}".` : 'Nothing here.'}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="foot">{when}</p>
    {/if}

    {#if othersSorted.length}
      <h2>Other characters<span>kept on this PC</span></h2>
      <table use:columns={'items-others'}>
        {@render heads([['name', 'Item'], [null, 'Character'], ['type', 'Type'], ['place', 'Where'], ['n', 'Qty'], ['value', 'Value'], ...(listing ? [['auction', 'At the AH'] as [Column, string]] : [])])}
        <tbody>
          {#each othersSorted as r (r.who?.key + r.place + r.id)}
            <tr class="other" onclick={() => r.who && onpick(r.who.key)} title="Show {r.who?.key}">
              <td>{@render item(r)}</td><td style:color={r.who?.color}>{r.who?.key}</td><td class="dim">{r.type}</td><td>{r.place}</td><td class="num">{r.n}</td><td class="num">{@render money_(r.value)}</td>{#if listing}<td class="num">{@render money_(r.auction)}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="foot">{[...new Set(othersSorted.map((r) => r.who))].map((k) => k && `${k.key}: seen ${ago(k.seen, now)}`).filter(Boolean).join(' · ')}</p>
    {/if}
  {/if}
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
    padding: 14px 20px 32px;
    font-variant-numeric: tabular-nums;
  }
  .empty {
    max-width: 520px;
    margin: 64px auto;
    color: var(--text-dim);
    text-align: center;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
    margin: 0 0 12px;
  }
  input {
    width: 280px;
    height: 30px;
    padding: 0 10px;
    border: 0;
    background: var(--stone-950);
    box-shadow: inset 0 0 0 1px var(--bronze-700);
    color: var(--text);
    font: var(--t-body);
  }
  input:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--bronze-400);
  }
  .chips {
    display: flex;
    gap: 6px;
  }
  .chip {
    padding: 3px 10px;
    border: 0;
    border-radius: 13px;
    background: none;
    box-shadow: inset 0 0 0 1px var(--stone-500);
    color: var(--text-dim);
    font: var(--t-body);
    cursor: pointer;
  }
  .chip b {
    margin-left: 3px;
    font-weight: 500;
    color: var(--text-off);
  }
  .chip[aria-pressed='true'] {
    background: var(--stone-600);
    box-shadow: inset 0 0 0 1px var(--bronze-500);
    color: var(--gold);
  }
  .chip[aria-pressed='true'] b {
    color: var(--text-dim);
  }
  .views {
    display: inline-flex;
    border-radius: 15px;
    box-shadow: inset 0 0 0 1px var(--bronze-600);
    overflow: hidden;
  }
  .views button {
    padding: 4px 13px;
    border: 0;
    background: none;
    color: var(--text-dim);
    font: var(--t-body);
    cursor: pointer;
  }
  .views button[aria-pressed='true'] {
    background: var(--bronze-700);
    color: var(--text);
  }
  .page {
    display: grid;
    grid-template-columns: 470px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .doll {
    padding: 12px 14px 14px;
    border-radius: 3px;
    background: linear-gradient(#ffffff08, #00000030);
    box-shadow: inset 0 0 0 1px #ffffff12, 0 0 0 1px #000;
  }
  .doll header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 0 2px 10px;
  }
  .doll .who {
    font: 400 19px/1 var(--display);
  }
  .doll .line {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .body {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) 46px;
    gap: 10px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .picture {
    position: relative;
    display: grid;
    place-content: center;
    place-items: center;
    gap: 6px;
    height: 394px;
    padding: 0 16px;
    overflow: hidden;
    border-radius: 3px;
    background: radial-gradient(circle at 50% 40%, var(--stone-700), var(--stone-950)) center / cover;
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--bronze-700);
    color: var(--text-off);
    font: var(--t-small);
    text-align: center;
  }
  .picture .under {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 18px 8px 7px;
    color: var(--text-dim);
    text-align: left;
    background: linear-gradient(transparent, #000d);
  }
  .picture .when {
    margin-right: auto;
  }
  .pbtn {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border: 0;
    border-radius: 2px;
    font: 500 13px/1 var(--font);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    background: linear-gradient(var(--stone-600), var(--stone-800));
    box-shadow: inset 0 1px 0 #ffffff1f, 0 0 0 1px #000, 0 0 0 2px var(--bronze-600);
  }
  .pbtn:hover {
    color: var(--gold);
  }
  .picture .wait {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 24px;
    background: #0c0a08e6;
  }
  .picture .wait p {
    margin: 0;
    font: var(--t-body);
    color: var(--text);
  }
  .picture .wait kbd {
    display: inline-block;
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 3px;
    font: 600 14px/20px var(--font);
    color: var(--gold);
    box-shadow: 0 0 0 1px var(--bronze-500);
  }
  .picture .wait small {
    color: var(--text-dim);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 22px;
    margin-top: 14px;
    padding-top: 10px;
    box-shadow: 0 -1px 0 #ffffff14;
  }
  .stats h4 {
    grid-column: span 2;
    margin: 6px 0 2px;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .stats div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 22px;
    color: var(--text-dim);
  }
  .stats b {
    font-weight: 500;
    color: var(--text);
  }
  .weapons {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
  }
  .held h2:first-child {
    margin-top: 0;
  }
  .box {
    margin-bottom: 12px;
  }
  h3 {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0 0 6px;
    font: 600 13px/17px var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gold);
  }
  h3 small {
    font: var(--t-small);
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-dim);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .cell {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    background: var(--stone-950);
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--q, var(--stone-600));
    transition: opacity 0.12s;
  }
  .cell img {
    display: block;
    width: 40px;
    height: 40px;
    margin: 2px;
    border-radius: 3px;
  }
  .cell .n {
    position: absolute;
    right: 3px;
    bottom: 1px;
    font: 600 12px/1 var(--font);
    color: #fff;
    text-shadow: 0 0 2px #000, 0 0 2px #000, 0 0 2px #000;
  }
  .cell.free {
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--stone-700);
  }
  .cell .slot {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 500 9.5px/1 var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .cell .wear {
    position: absolute;
    left: 4px;
    bottom: 4px;
    height: 3px;
    background: #ffd200;
    box-shadow: 0 0 0 1px #000;
  }
  .cell .wear.broken {
    width: 36px !important;
    background: #ff3b30;
  }
  .cell.off {
    opacity: 0.22;
  }
  .sum {
    margin: 0 0 0 auto;
    color: var(--text-dim);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  /* As the tables of the Auction House: the headings on a bar of their own that stays on top. */
  th {
    position: sticky;
    top: -14px; /* over the padding of the page */
    z-index: 1;
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--bronze-700);
    background: var(--stone-800);
    text-align: left;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-400);
    white-space: nowrap;
  }
  th button {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
  }
  th.on,
  th button:hover {
    color: var(--gold);
  }
  th svg {
    width: 9px;
    height: 9px;
    margin-left: 5px;
    fill: currentColor;
  }
  td {
    padding: 3px 10px;
    border-bottom: 1px solid #ffffff0a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tbody tr:hover td {
    background: #ffffff08;
  }
  .num {
    text-align: right;
  }
  .dim {
    color: var(--text-dim);
  }
  .none {
    color: var(--text-off);
  }
  .it {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ico {
    flex: none;
    width: 26px;
    height: 26px;
    border: 1px solid #000;
    background: #000;
    box-shadow: 0 0 0 1px var(--bronze-700);
  }
  .ico img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .nm {
    text-shadow: 0 1px 0 #000;
  }
  .other {
    cursor: pointer;
  }
  .other:hover td {
    background: #ffffff0d;
  }
  h2 {
    margin: 22px 0 6px;
    font: var(--t-title);
    color: var(--gold);
  }
  h2 span {
    margin-left: 8px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .foot {
    margin: 10px 0 0;
    font: var(--t-small);
    color: var(--text-off);
  }
</style>
